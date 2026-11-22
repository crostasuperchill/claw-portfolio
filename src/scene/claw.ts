import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { D } from './dims';
import { GRAB_THRESHOLD, grabScore } from '../game/grab';
import { mergeStatic } from './merge';
import type { BodyRef } from '../contracts';

/** Scala visiva: D.clawScale è la base, 1.4 dà presenza senza toccare il soffitto. */
const S = D.clawScale * 1.12;

const CABLE_TOP = 1.286;
const HEAD_TOP = -0.012;

/** Cinematica delle chele: due falangi, la punta chiusa cade esattamente sul punto di presa. */
const L1 = 0.05;
const L2 = 0.064;
const PIVOT_Z = 0.095;
const A_CLOSED = 0.35;
const C_CLOSED = 1.02;
const A_OPEN = 0.62;
const C_OPEN = 0.3;
const PIVOT_Y = D.grabTipOffset / S + L1 * Math.cos(A_CLOSED) + L2 * Math.cos(C_CLOSED);

const chrome = new THREE.MeshPhysicalMaterial({
  color: '#eef2f7',
  metalness: 1,
  roughness: 0.085,
  envMapIntensity: 2.35,
});

const brushed = new THREE.MeshPhysicalMaterial({
  color: '#7a828d',
  metalness: 1,
  roughness: 0.24,
  envMapIntensity: 1.9,
});

const darkSteel = new THREE.MeshStandardMaterial({
  color: '#343941',
  metalness: 0.9,
  roughness: 0.42,
});

const gunmetal = new THREE.MeshStandardMaterial({
  color: '#1d2026',
  metalness: 0.75,
  roughness: 0.55,
});

const ledBlue = new THREE.MeshBasicMaterial({ color: '#3f63ff', toneMapped: false });

const UP = new THREE.Vector3(0, 1, 0);
const slingDir = new THREE.Vector3();
const cableDir = new THREE.Vector3();

/**
 * Parametri del moto. Le molle sono semplificate (semi-implicito, sottopassi a
 * 1/240 s): il risultato e' un braccio che accelera e frena invece di scattare.
 */
const M = {
  // carrello XY: molla quasi critica, velocita' limitata
  xyOmega: 9.4,
  xyZeta: 0.9,
  xyMaxSpeed: 1.15,
  // ritorno: piu' rapido e con un piccolo assestamento
  returnOmega: 4.2,
  returnZeta: 0.14,
  returnMaxSpeed: 0.45,
  // altezza: offset di massa (inerzia del claw appeso)
  hOmega: 9.0,
  hZeta: 0.5,
  hGain: 1.4,
  hKick: 0.075,
  hKickCool: 1.2,
  // pendolo del cavo (angoli in rad)
  swayOmega: 5.2,
  swayZeta: 0.32,
  swayGain: 0.16,
  swayLimit: 0.03,
  swayLoadOmega: 4.3,
  swayLoadZeta: 0.42,
  swayLoadGain: 0.21,
  swayLoadLimit: 0.042,
  headLever: 0.3,
  tiltGain: 0.6,
  leanGain: 0.045,
  leanLimit: 0.024,
  leanOmega: 5.5,
  // dita: molla sottosmorzata + ritardo meccanico per dito
  gripOmega: 26,
  gripZeta: 0.42,
  gripLimit: 0.06,
  gripRate: 2.0,
  gripSnap: 1.1,
  fingerDelay: 0.04,
};

const cableSteel = new THREE.MeshPhysicalMaterial({
  color: '#23262b',
  metalness: 0.85,
  roughness: 0.34,
  envMapIntensity: 1.6,
  flatShading: true,
});

const lathe = (pts: [number, number][], segments = 48) =>
  new THREE.LatheGeometry(
    pts.map(([r, y]) => new THREE.Vector2(r, y)),
    segments
  );

function bolt(r: number, h: number) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.12, h, 6), darkSteel);
}

function hexPin(r: number, h: number) {
  const m = bolt(r, h);
  m.rotation.z = Math.PI / 2;
  return m;
}

export class Claw {
  root = new THREE.Group();
  head = new THREE.Group();
  target = new THREE.Vector2(0, 0);
  pos = new THREE.Vector2(0, 0);
  height: number = D.clawHomeY;
  grip = 1;
  grabbed: BodyRef | null = null;

  private body: RAPIER.RigidBody;
  private joint: RAPIER.ImpulseJoint | null = null;
  private fingers: { upper: THREE.Group; lower: THREE.Group }[] = [];
  private bridge: THREE.Group;
  private carriage: THREE.Group;
  private cable: THREE.Mesh;
  private slings: THREE.Mesh[] = [];

  // ─── stato del moto ──────────────────────────────────────────────────────
  /** velocita' del carrello (m/s) */
  private vx = 0;
  private vz = 0;
  /** offset dell'altezza visuale rispetto al comando: la massa appesa "pesa" */
  private hVis: number = D.clawHomeY;
  private hOff = 0;
  private hOffV = 0;
  private prevCmd: number = D.clawHomeY;
  private cmdVel = 0;
  private prevCmdVel = 0;
  private hKickCool = 0;
  /** angoli di pendolo del cavo (rad) */
  private swX = 0;
  private swZ = 0;
  private swVX = 0;
  private swVZ = 0;
  private swingKicked = false;
  private loadK = 0;
  private returnK = 0;
  private sinceRelease = 99;
  private clock = 0;
  /** apertura visuale di ogni dito: 1 aperto, 0 chiuso (puo' superare i limiti) */
  private fingerG = [1, 1, 1];
  private fingerV = [0, 0, 0];
  private fingerSnap = [false, false, false];
  private gripCmd = 1;
  private gripHist: { t: number; v: number }[] = [];
  private leanX = 0;
  private leanZ = 0;

  constructor(private world: RAPIER.World, private refs: Map<number, BodyRef>) {
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, D.clawHomeY, 0)
    );
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.05 * D.clawScale, 0.085 * D.clawScale).setFriction(0.7),
      this.body
    );

    // ─── gantry ────────────────────────────────────────────────────────────
    const railMat = new THREE.MeshPhysicalMaterial({
      color: '#4c525b',
      metalness: 1,
      roughness: 0.36,
      envMapIntensity: 1.5,
    });

    const beamMat = new THREE.MeshPhysicalMaterial({
      color: '#5d646e',
      metalness: 1,
      roughness: 0.3,
      envMapIntensity: 1.6,
    });

    for (const z of [-0.355, 0.355]) {
      const rail = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.018, 0.018, 2, 0.004), railMat);
      rail.position.set(0, 1.302, z);
      rail.castShadow = true;
      this.root.add(rail);

      // staffe di fissaggio alle estremità
      for (const x of [-0.435, 0.435]) {
        const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.03, 0.034, 2, 0.004), darkSteel);
        shoe.position.set(x, 1.3, z);
        this.root.add(shoe);
        const b = bolt(0.0055, 0.005);
        b.position.set(x, 1.286, z);
        this.root.add(b);
      }
    }

    // trave di scorrimento (corre tra le due rotaie, si muove in X)
    this.bridge = new THREE.Group();
    const beam = new THREE.Mesh(new RoundedBoxGeometry(0.046, 0.026, 0.752, 2, 0.006), beamMat);
    beam.position.y = 1.292;
    beam.castShadow = true;
    this.bridge.add(beam);

    const beamLip = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.006, 0.752, 2, 0.002), chrome);
    beamLip.position.y = 1.307;
    this.bridge.add(beamLip);

    for (const z of [-0.355, 0.355]) {
      const truck = new THREE.Mesh(new RoundedBoxGeometry(0.062, 0.03, 0.052, 2, 0.006), darkSteel);
      truck.position.set(0, 1.298, z);
      truck.castShadow = true;
      this.bridge.add(truck);

      const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.007, 18), gunmetal);
      roller.rotation.x = Math.PI / 2;
      roller.position.set(0, 1.298, z + Math.sign(z) * 0.029);
      this.bridge.add(roller);

      const hubCap = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.009, 8), chrome);
      hubCap.rotation.x = Math.PI / 2;
      hubCap.position.set(0, 1.298, z + Math.sign(z) * 0.03);
      this.bridge.add(hubCap);
    }
    this.root.add(this.bridge);

    // carrello: motore + puleggia, appeso alla trave
    this.carriage = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.078, 0.034, 0.084, 2, 0.008), darkSteel);
    body.position.y = 1.302;
    body.castShadow = true;
    this.carriage.add(body);

    const band = new THREE.Mesh(new RoundedBoxGeometry(0.082, 0.009, 0.088, 2, 0.003), chrome);
    band.position.y = 1.29;
    this.carriage.add(band);

    const face = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.022, 0.004, 2, 0.003), gunmetal);
    face.position.set(0, 1.302, 0.043);
    this.carriage.add(face);

    const status = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 10, 8), ledBlue);
    status.position.set(0.017, 1.306, 0.046);
    this.carriage.add(status);

    for (const x of [-0.019, 0.019]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.003, 6), chrome);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(x, 1.297, 0.046);
      this.carriage.add(screw);
    }

    const bushing = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.008, 16), gunmetal);
    bushing.position.y = 1.283;
    this.carriage.add(bushing);

    const bushingRing = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0022, 6, 18), chrome);
    bushingRing.rotation.x = Math.PI / 2;
    bushingRing.position.y = 1.279;
    this.carriage.add(bushingRing);
    this.root.add(this.carriage);

    // cavo d'acciaio
    this.cable = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 1, 6), cableSteel);
    this.cable.castShadow = false;
    this.root.add(this.cable);

    // due tiranti laterali: rendono leggibile la sospensione dal carrello
    for (let i = 0; i < 2; i++) {
      const sling = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 1, 6), cableSteel);
      sling.castShadow = false;
      this.slings.push(sling);
      this.root.add(sling);
    }

    // ─── testa ─────────────────────────────────────────────────────────────
    const head = this.head;
    head.scale.setScalar(S);

    const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.0145, 0.014, 18), chrome);
    clamp.position.y = -0.019;
    head.add(clamp);

    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.003, 8, 20), gunmetal);
    eye.rotation.x = Math.PI / 2;
    eye.position.y = -0.0105;
    head.add(eye);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.038, 0.014, 24), brushed);
    neck.position.y = -0.02;
    head.add(neck);

    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.096, 0.012, 48), chrome);
    collar.position.y = -0.0325;
    head.add(collar);

    // filo LED blu sul bordo del collare
    const led = new THREE.Mesh(new THREE.TorusGeometry(0.0938, 0.0022, 6, 64), ledBlue);
    led.rotation.x = Math.PI / 2;
    led.position.y = -0.0335;
    head.add(led);

    // occhielli dei tiranti laterali
    for (const side of [-1, 1]) {
      const eyelet = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.009, 0.006, 12), chrome);
      eyelet.position.set(side * 0.088, -0.0255, 0);
      head.add(eyelet);
    }

    // viti sul collare
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const b = bolt(0.0048, 0.004);
      b.position.set(Math.cos(a) * 0.068, -0.0258, Math.sin(a) * 0.068);
      head.add(b);
    }

    // corpo campaniforme, basso e largo: le chele restano lunghe
    const hub = new THREE.Mesh(
      lathe([
        [0.034, -0.066],
        [0.05, -0.064],
        [0.066, -0.061],
        [0.076, -0.056],
        [0.081, -0.051],
        [0.085, -0.045],
        [0.086, -0.041],
        [0.08, -0.038],
        [0.07, -0.036],
      ]),
      brushed
    );
    hub.castShadow = true;
    hub.receiveShadow = true;
    head.add(hub);

    const hubBand = new THREE.Mesh(new THREE.TorusGeometry(0.0812, 0.003, 6, 48), darkSteel);
    hubBand.rotation.x = Math.PI / 2;
    hubBand.position.y = -0.0505;
    head.add(hubBand);

    const belly = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.007, 32), gunmetal);
    belly.position.y = -0.066;
    head.add(belly);

    const bellyCap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.004, 32), chrome);
    bellyCap.position.y = -0.069;
    head.add(bellyCap);

    // spine di giunzione tra collare e corpo
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.022, 0.005), darkSteel);
      rib.position.set(Math.cos(a) * 0.0805, -0.052, Math.sin(a) * 0.0805);
      rib.rotation.y = -a;
      head.add(rib);
    }

    // luce LED che rimbalza sull'acciaio
    const glow = new THREE.PointLight('#4a6cff', 0.55, 0.17, 2);
    glow.position.y = -0.05;
    head.add(glow);

    // ─── chele ─────────────────────────────────────────────────────────────
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;

      // supporto a forcella avvitato sotto il collare
      const mount = new THREE.Group();
      mount.rotation.y = angle;
      const lug = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.026, 0.034, 2, 0.005), chrome);
      lug.position.set(0, PIVOT_Y, 0.088);
      mount.add(lug);
      const pin = hexPin(0.0065, 0.055);
      pin.position.set(0, PIVOT_Y, PIVOT_Z);
      mount.add(pin);
      for (const x of [-0.0295, 0.0295]) {
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.005, 6), chrome);
        cap.rotation.z = Math.PI / 2;
        cap.position.set(x, PIVOT_Y, PIVOT_Z);
        mount.add(cap);
      }
      head.add(mount);

      const finger = new THREE.Group();
      finger.rotation.y = angle;
      finger.position.set(0, PIVOT_Y, PIVOT_Z);

      const upper = new THREE.Group();
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.0195, 18, 14), chrome);
      shoulder.scale.set(0.92, 0.94, 1);
      upper.add(shoulder);

      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.02, 4, 14), chrome);
      arm.position.y = -L1 / 2;
      arm.scale.set(1.18, 1, 0.82);
      upper.add(arm);

      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.0182, 16, 12), chrome);
      knuckle.position.y = -L1;
      upper.add(knuckle);

      const knucklePin = hexPin(0.005, 0.04);
      knucklePin.position.y = -L1;
      upper.add(knucklePin);

      const lower = new THREE.Group();
      lower.position.y = -L1;
      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.0135, 0.023, 4, 14), chrome);
      forearm.position.y = -0.025;
      forearm.scale.set(1.15, 1, 0.8);
      lower.add(forearm);

      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0115, 0.02, 14), chrome);
      tip.rotation.x = Math.PI;
      tip.position.y = -0.054;
      lower.add(tip);

      upper.add(lower);
      finger.add(upper);
      finger.traverse((o) => {
        o.userData.noMerge = true;
      });
      this.fingers.push({ upper, lower });
      head.add(finger);
    }
    this.root.add(this.head);
    mergeStatic(this.head, { skip: (m) => m.userData.noMerge === true });

    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.castShadow = true;
    });
    this.cable.castShadow = false;

    this.update(0);

    if (typeof window !== 'undefined') {
      (window as unknown as { __clawArm?: () => unknown }).__clawArm = () => this.sample();
    }
  }

  aim(dx: number, dz: number) {
    const limX = D.playfield.w / 2 - 0.1;
    const limZ = D.playfield.d / 2 - 0.1;
    this.target.x = THREE.MathUtils.clamp(this.target.x + dx, -limX, limX);
    this.target.y = THREE.MathUtils.clamp(this.target.y + dz, -limZ, limZ);
  }

  setHeight(y: number) {
    this.height = y;
  }

  setGrip(g: number) {
    this.grip = THREE.MathUtils.clamp(g, 0, 1);
  }

  update(dt: number) {
    const step = Math.min(0.05, Math.max(0, dt));
    if (step > 0) {
      this.clock += step;
      this.sinceRelease += step;
      this.hKickCool = Math.max(0, this.hKickCool - step);
    }

    const acc = this.stepPlanar(step);
    this.stepHeight(step);
    this.stepSway(step, acc.x, acc.z);
    this.stepFingers(step);
    this.applyVisual();
  }

  // ─── carrello XY: molla smorzata + limite di velocita' ────────────────────
  private stepPlanar(dt: number) {
    if (dt <= 0) return { x: 0, z: 0 };

    // se il claw e' appena stato rilasciato ed e' diretto a casa, il ritorno
    // e' piu' deciso dell'andata (e si assesta con un piccolo overshoot)
    const tx = this.target.x;
    const tz = this.target.y;
    const nearHome = Math.hypot(tx, tz - 0.02) < 0.06;
    const wantReturn = this.sinceRelease < 1.3 && nearHome ? 1 : 0;
    this.returnK += (wantReturn - this.returnK) * Math.min(1, dt * 12);
    const boost = this.returnK;

    const omega = M.xyOmega + M.returnOmega * boost;
    const zeta = M.xyZeta - M.returnZeta * boost;
    const maxSpeed = M.xyMaxSpeed + M.returnMaxSpeed * boost;

    const steps = Math.max(1, Math.ceil(dt * 240));
    const h = dt / steps;
    let accX = 0;
    let accZ = 0;
    for (let i = 0; i < steps; i++) {
      accX = omega * omega * (tx - this.pos.x) - 2 * zeta * omega * this.vx;
      accZ = omega * omega * (tz - this.pos.y) - 2 * zeta * omega * this.vz;
      this.vx += accX * h;
      this.vz += accZ * h;
      const speed = Math.hypot(this.vx, this.vz);
      if (speed > maxSpeed) {
        const s = maxSpeed / speed;
        this.vx *= s;
        this.vz *= s;
      }
      this.pos.x += this.vx * h;
      this.pos.y += this.vz * h;
    }

    const limX = D.playfield.w / 2 - 0.08;
    const limZ = D.playfield.d / 2 - 0.08;
    if (Math.abs(this.pos.x) > limX) {
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -limX, limX);
      this.vx *= -0.15;
    }
    if (Math.abs(this.pos.y) > limZ) {
      this.pos.y = THREE.MathUtils.clamp(this.pos.y, -limZ, limZ);
      this.vz *= -0.15;
    }
    return { x: accX, z: accZ };
  }

  // ─── altezza: offset di massa + anticipazione + stop secco in fondo ───────
  private stepHeight(dt: number) {
    if (dt > 0) {
      const inst = (this.height - this.prevCmd) / dt;
      this.cmdVel += (inst - this.cmdVel) * Math.min(1, dt * 24);
      const rawAcc = (this.cmdVel - this.prevCmdVel) / dt;
      this.prevCmdVel = this.cmdVel;
      this.prevCmd = this.height;
      const aCmd = THREE.MathUtils.clamp(rawAcc, -6, 6);

      // stacco: un soffio verso l'alto prima di scendere
      if (this.cmdVel < -0.004 && this.hKickCool <= 0 && this.height > D.clawDropY + 0.05) {
        this.hOffV += M.hKick;
        this.hKickCool = M.hKickCool;
      }

      // il claw e' appeso: quando il carrello accelera resta indietro, quando
      // frena scende. Nessun ritardo a velocita' costante, solo inerzia.
      const steps = Math.max(1, Math.ceil(dt * 240));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const acc = -M.hOmega * M.hOmega * this.hOff - 2 * M.hZeta * M.hOmega * this.hOffV - aCmd * M.hGain;
        this.hOffV += acc * h;
        this.hOff += this.hOffV * h;
      }

      // risalita con carico: il peso si stacca e il pendolo riparte
      if (!this.swingKicked && this.grabbed && this.cmdVel > 0.012 && this.height < D.clawDropY + 0.03) {
        this.swVX += 0.035;
        this.swVZ -= 0.02;
        this.swingKicked = true;
      }
      if (this.height > D.clawHomeY - 0.015) this.swingKicked = false;
    }

    this.hOff = THREE.MathUtils.clamp(this.hOff, -0.022, 0.022);
    this.hVis = this.height + this.hOff;

    // il fondo corsa e' netto: la molla non affonda nelle capsule
    const lo = D.clawDropY - 0.006;
    const hi = D.clawHomeY + 0.018;
    if (this.hVis < lo) {
      this.hVis = lo;
      this.hOff = lo - this.height;
      this.hOffV = Math.max(0, this.hOffV);
    } else if (this.hVis > hi) {
      this.hVis = hi;
      this.hOff = hi - this.height;
      this.hOffV = Math.min(0, this.hOffV);
    }
  }

  // ─── pendolo del cavo: insegue l'accelerazione del carrello ───────────────
  private stepSway(dt: number, ax: number, az: number) {
    if (dt <= 0) return;
    const wantLoad = this.grabbed ? 1 : 0;
    this.loadK += (wantLoad - this.loadK) * Math.min(1, dt * 5);

    const omega = M.swayOmega - (M.swayOmega - M.swayLoadOmega) * this.loadK;
    const zeta = M.swayZeta + (M.swayLoadZeta - M.swayZeta) * this.loadK;
    const gain = M.swayGain + (M.swayLoadGain - M.swayGain) * this.loadK;
    const limit = M.swayLimit + (M.swayLoadLimit - M.swayLimit) * this.loadK;

    const steps = Math.max(1, Math.ceil(dt * 240));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const accX = -omega * omega * this.swX - 2 * zeta * omega * this.swVX - ax * gain;
      const accZ = -omega * omega * this.swZ - 2 * zeta * omega * this.swVZ - az * gain;
      this.swVX += accX * h;
      this.swVZ += accZ * h;
      this.swX += this.swVX * h;
      this.swZ += this.swVZ * h;
    }
    if (Math.abs(this.swX) > limit) {
      this.swX = Math.sign(this.swX) * limit;
      this.swVX *= 0.55;
    }
    if (Math.abs(this.swZ) > limit) {
      this.swZ = Math.sign(this.swZ) * limit;
      this.swVZ *= 0.55;
    }

    // con un premio attaccato il claw si inclina nella direzione del moto
    const leanX = this.grabbed ? THREE.MathUtils.clamp(this.vz * M.leanGain, -M.leanLimit, M.leanLimit) : 0;
    const leanZ = this.grabbed ? THREE.MathUtils.clamp(-this.vx * M.leanGain, -M.leanLimit, M.leanLimit) : 0;
    const k = Math.min(1, dt * M.leanOmega);
    this.leanX += (leanX - this.leanX) * k;
    this.leanZ += (leanZ - this.leanZ) * k;
  }

  // ─── dita: ritardo meccanico di 40 ms l'una dall'altra + molla ────────────
  private stepFingers(dt: number) {
    if (dt > 0) {
      // il comando di presa ha una velocita' massima: niente scatti anche
      // quando il rilascio apre le chele in un colpo solo
      const want = this.grip;
      const maxStep = M.gripRate * dt;
      this.gripCmd += THREE.MathUtils.clamp(want - this.gripCmd, -maxStep, maxStep);
      this.gripHist.push({ t: this.clock, v: this.gripCmd });
      while (this.gripHist.length > 2 && this.clock - this.gripHist[0].t > M.fingerDelay * 3 + 0.06) {
        this.gripHist.shift();
      }
    }

    const steps = Math.max(1, Math.ceil(dt * 240));
    const h = dt / steps;
    for (let i = 0; i < this.fingers.length; i++) {
      const target = this.gripAt(this.clock - i * M.fingerDelay);
      let g = this.fingerG[i];
      let v = this.fingerV[i];

      // scatto meccanico: la molla supera la chiusura e torna, dito per dito
      if (!this.fingerSnap[i] && target < 0.02 && g > 0.02) {
        v -= M.gripSnap;
        this.fingerSnap[i] = true;
      } else if (target > 0.35) {
        this.fingerSnap[i] = false;
      }
      for (let s = 0; s < steps; s++) {
        const acc = M.gripOmega * M.gripOmega * (target - g) - 2 * M.gripZeta * M.gripOmega * v;
        v += acc * h;
        g += v * h;
      }
      if (g < -M.gripLimit) {
        g = -M.gripLimit;
        v = Math.max(0, v);
      } else if (g > 1 + M.gripLimit) {
        g = 1 + M.gripLimit;
        v = Math.min(0, v);
      }
      this.fingerG[i] = g;
      this.fingerV[i] = v;
    }
  }

  /** valore del comando di presa `delay` secondi fa (interpolato, ritardo per dito) */
  private gripAt(t: number) {
    const hist = this.gripHist;
    if (!hist.length) return this.grip;
    if (t <= hist[0].t) return hist[0].v;
    for (let i = 0; i < hist.length - 1; i++) {
      if (t <= hist[i + 1].t) {
        const span = Math.max(1e-6, hist[i + 1].t - hist[i].t);
        return hist[i].v + (hist[i + 1].v - hist[i].v) * ((t - hist[i].t) / span);
      }
    }
    return hist[hist.length - 1].v;
  }

  // ─── trasformazioni ───────────────────────────────────────────────────────
  private applyVisual() {
    const top = CABLE_TOP;
    const cableLen = Math.max(0.012, top - (this.hVis + HEAD_TOP * S));
    const lever = cableLen + M.headLever;

    const headX = this.pos.x + Math.sin(this.swX) * lever;
    const headZ = this.pos.y + Math.sin(this.swZ) * lever;

    this.head.position.set(headX, this.hVis, headZ);
    this.head.rotation.z = this.swX * M.tiltGain + this.leanZ;
    this.head.rotation.x = -this.swZ * M.tiltGain + this.leanX;

    // il corpo cinematico segue la testa visuale: il premio trattenuto dal joint
    // resta agganciato alle chele anche quando il claw ondeggia
    this.body.setNextKinematicTranslation({ x: headX, y: this.hVis, z: headZ });

    for (let i = 0; i < this.fingers.length; i++) {
      const g = this.fingerG[i];
      this.fingers[i].upper.rotation.x = -THREE.MathUtils.lerp(A_CLOSED, A_OPEN, g);
      this.fingers[i].lower.rotation.x = THREE.MathUtils.lerp(C_CLOSED, C_OPEN, g);
    }

    this.bridge.position.x = this.pos.x;
    this.carriage.position.set(this.pos.x, 0, this.pos.y);

    // cavo dritto dal carrello alla testa, inclinato dal pendolo
    const anchorX = this.pos.x + Math.sin(this.swX) * cableLen;
    const anchorZ = this.pos.y + Math.sin(this.swZ) * cableLen;
    const bottom = this.hVis + HEAD_TOP * S;
    cableDir.set(anchorX - this.pos.x, bottom - top, anchorZ - this.pos.y);
    const len = Math.max(0.012, cableDir.length());
    this.cable.scale.set(1, len, 1);
    this.cable.position.set((this.pos.x + anchorX) / 2, (top + bottom) / 2, (this.pos.y + anchorZ) / 2);
    this.cable.quaternion.setFromUnitVectors(UP, cableDir.normalize());

    // tiranti a V dal carrello agli occhielli del collare
    const anchorY = this.hVis - 0.0255 * S;
    for (let i = 0; i < this.slings.length; i++) {
      const sling = this.slings[i];
      const bx = headX + (i === 0 ? -1 : 1) * 0.088 * S;
      slingDir.set(bx - this.pos.x, anchorY - top, headZ - this.pos.y);
      const slen = Math.max(0.02, slingDir.length());
      sling.position.set((this.pos.x + bx) / 2, (top + anchorY) / 2, (this.pos.y + headZ) / 2);
      sling.scale.set(1, slen, 1);
      sling.quaternion.setFromUnitVectors(UP, slingDir.normalize());
    }
  }

  /** probe read-only per gli script di verifica (nessuna scrittura) */
  private sample() {
    const lever = Math.max(0.012, CABLE_TOP - (this.hVis + HEAD_TOP * S)) + M.headLever;
    return {
      y: this.height,
      yVis: this.hVis,
      open: (this.fingerG[0] + this.fingerG[1] + this.fingerG[2]) / 3,
      f: [this.fingerG[0], this.fingerG[1], this.fingerG[2]],
      x: this.pos.x,
      z: this.pos.y,
      swayX: Math.sin(this.swX) * lever,
      swayZ: Math.sin(this.swZ) * lever,
      tiltX: this.head.rotation.x,
      tiltZ: this.head.rotation.z,
      vy: this.hOffV,
      grabbed: this.grabbed !== null,
    };
  }


  tryGrab(): boolean {
    if (this.grabbed) return true;
    const tipY = this.height + D.grabTipOffset;
    const tip = { x: this.pos.x, y: tipY, z: this.pos.y };
    const hits: { ref: BodyRef; d: number }[] = [];

    this.world.intersectionsWithShape(
      tip,
      { w: 1, x: 0, y: 0, z: 0 },
      new RAPIER.Ball(D.grabRadius),
      (collider) => {
        const ref = this.refs.get(collider.handle);
        if (!ref || ref.collected) return true;
        const t = ref.body.translation();
        if (Math.abs(t.y - tipY) > 0.11) return true;
        hits.push({ ref, d: Math.hypot(t.x - this.pos.x, t.z - this.pos.y) });
        return true;
      }
    );

    if (!hits.length) return false;
    hits.sort((a, b) => a.d - b.d);
    const best = hits[0];
    if (grabScore(best.d, 0) < GRAB_THRESHOLD) return false;

    const t = best.ref.body.translation();
    const jd = RAPIER.JointData.fixed(
      { x: t.x - this.pos.x, y: t.y - this.height, z: t.z - this.pos.y },
      { w: 1, x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { w: 1, x: 0, y: 0, z: 0 }
    );
    this.joint = this.world.createImpulseJoint(jd, this.body, best.ref.body, true);
    this.grabbed = best.ref;
    return true;
  }

  release() {
    if (this.joint) {
      this.world.removeImpulseJoint(this.joint, true);
      this.joint = null;
    }
    this.grabbed = null;
    // le chele si aprono gia' durante il rilascio, non a scatto quando torna idle
    this.grip = 1;
    this.sinceRelease = 0;
    this.swingKicked = false;
  }

  get hasJoint() {
    return this.joint !== null;
  }

  probe() {
    const tipY = this.height + D.grabTipOffset;
    const found: { y: number; dx: number; dz: number; project: string | null }[] = [];
    this.world.intersectionsWithShape(
      { x: this.pos.x, y: tipY, z: this.pos.y },
      { w: 1, x: 0, y: 0, z: 0 },
      new RAPIER.Ball(D.grabRadius),
      (collider) => {
        const ref = this.refs.get(collider.handle);
        if (ref) {
          const t = ref.body.translation();
          found.push({
            y: +t.y.toFixed(3),
            dx: +(t.x - this.pos.x).toFixed(3),
            dz: +(t.z - this.pos.y).toFixed(3),
            project: ref.projectId,
          });
        }
        return true;
      }
    );
    return { tipY: +tipY.toFixed(3), x: +this.pos.x.toFixed(3), z: +this.pos.y.toFixed(3), found };
  }
}
