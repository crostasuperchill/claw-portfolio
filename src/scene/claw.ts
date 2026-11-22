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
    if (dt > 0) {
      const k = 1 - Math.exp(-18 * dt);
      this.pos.x += (this.target.x - this.pos.x) * k;
      this.pos.y += (this.target.y - this.pos.y) * k;
    }

    this.head.position.set(this.pos.x, this.height, this.pos.y);
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.height, z: this.pos.y });

    const a = THREE.MathUtils.lerp(A_CLOSED, A_OPEN, this.grip);
    const c = THREE.MathUtils.lerp(C_CLOSED, C_OPEN, this.grip);
    for (const f of this.fingers) {
      f.upper.rotation.x = -a;
      f.lower.rotation.x = c;
    }

    this.bridge.position.x = this.pos.x;
    this.carriage.position.set(this.pos.x, 0, this.pos.y);

    const top = CABLE_TOP;
    const bottom = this.height + HEAD_TOP * S;
    const len = Math.max(0.012, top - bottom);
    this.cable.scale.y = len;
    this.cable.position.set(this.pos.x, bottom + len / 2, this.pos.y);

    // tiranti a V dal carrello agli occhielli del collare
    const anchorY = this.height - 0.0255 * S;
    for (let i = 0; i < this.slings.length; i++) {
      const sling = this.slings[i];
      const bx = this.pos.x + (i === 0 ? -1 : 1) * 0.088 * S;
      slingDir.set(bx - this.pos.x, anchorY - top, 0);
      const slen = Math.max(0.02, slingDir.length());
      sling.position.set((this.pos.x + bx) / 2, (top + anchorY) / 2, this.pos.y);
      sling.scale.set(1, slen, 1);
      sling.quaternion.setFromUnitVectors(UP, slingDir.normalize());
    }
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
