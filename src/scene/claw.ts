import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { D } from './dims';
import { GRAB_THRESHOLD, grabScore } from '../game/grab';
import { mergeStatic } from './merge';
import type { BodyRef } from '../contracts';

const S = D.clawScale * 1.02;

/* ── vertical layout ─────────────────────────────────────────────────────── */
/* the pink window frame starts at y = 1.298: everything above the carriage
   box has to stay below it so the whole rectangle stays visible. */
const RAIL_Y = 1.282;
const BEAM_Y = 1.276;
const CARRIAGE_Y = 1.242; // centre of the brushed carriage box (top = 1.270)
const CABLE_TOP = 1.198; // underside of the carriage neck
const HEAD_TOP = -0.018; // cable anchor, in head-local units

/* ── finger kinematics (head-local) ──────────────────────────────────────── */
const L1 = 0.05;
const L2 = 0.068;
const PIVOT_Z = 0.046;
const A_CLOSED = 0.35;
const C_CLOSED = 1.02;
const A_OPEN = 0.3;
const C_OPEN = 0.6;
const PIVOT_Y = D.grabTipOffset / S + L1 * Math.cos(A_CLOSED) + L2 * Math.cos(C_CLOSED);

/* the lower hub where the diagonal struts are anchored */
const HUB_Y = -0.088;
const HUB_R = 0.014;

/* ── bright, illustrated chrome palette ──────────────────────────────────── */
const chrome = new THREE.MeshStandardMaterial({
  color: '#f4f7fb',
  metalness: 0.86,
  roughness: 0.12,
  envMapIntensity: 1.8,
});

const chromeSoft = new THREE.MeshStandardMaterial({
  color: '#dce3ed',
  metalness: 0.8,
  roughness: 0.2,
  envMapIntensity: 1.55,
});

const brushed = new THREE.MeshStandardMaterial({
  color: '#c7d0dc',
  metalness: 0.74,
  roughness: 0.3,
  envMapIntensity: 1.45,
});

const brushedLight = new THREE.MeshStandardMaterial({
  color: '#e4e9f1',
  metalness: 0.72,
  roughness: 0.26,
  envMapIntensity: 1.6,
});

const darkSteel = new THREE.MeshStandardMaterial({
  color: '#3c4451',
  metalness: 0.66,
  roughness: 0.34,
  envMapIntensity: 1.1,
});

const coilBlack = new THREE.MeshStandardMaterial({
  color: '#1b1e24',
  metalness: 0.2,
  roughness: 0.5,
  envMapIntensity: 0.7,
});

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const cableDir = new THREE.Vector3();
const coilDir = new THREE.Vector3();
const strutDir = new THREE.Vector3();

const M = {
  /* carriage travel: slightly softer than before, so it has visible inertia */
  xyOmega: 8.0,
  xyZeta: 0.86,
  xyMaxSpeed: 1.12,
  returnOmega: 4.8,
  returnZeta: 0.16,
  returnMaxSpeed: 0.5,
  /* vertical spring: a little under-damped so the claw settles with weight */
  hOmega: 8.4,
  hZeta: 0.5,
  hGain: 1.25,
  hKick: 0.062,
  hKickCool: 1.35,
  /* pendulum */
  swayOmega: 5.0,
  swayZeta: 0.28,
  swayGain: 0.17,
  swayLimit: 0.032,
  swayLoadOmega: 4.1,
  swayLoadZeta: 0.36,
  swayLoadGain: 0.22,
  swayLoadLimit: 0.045,
  tiltGain: 0.55,
  headLever: 0.3,
  leanGain: 0.05,
  leanLimit: 0.026,
  leanOmega: 4.8,
  /* fingers */
  gripOmega: 24,
  gripZeta: 0.38,
  gripLimit: 0.055,
  gripRate: 2.2,
  gripSnap: 1.35,
  fingerDelay: 0.045,
  /* idle breathing */
  idleSwayOmega: 1.35,
  idleSwayAccX: 0.07,
  idleSwayAccZ: 0.052,
};

/**
 * Tight black helical power cord. Built at the real length so the tube keeps
 * its round cross-section instead of being squashed by a non-uniform scale.
 * Spans 0 → -length on Y so it can hang from the carriage (DOWN mapped to dir).
 */
function makeCoiledCableGeo(length: number) {
  const pts: THREE.Vector3[] = [];
  const turns = 11;
  const steps = 264;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = 0.0105;
    const bow = 0.002 * Math.sin(Math.PI * t);
    pts.push(new THREE.Vector3(Math.cos(a) * r + bow, -t * length, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, 320, 0.0032, 5, false);
}

/**
 * Sleek chrome prong blade. Built in XY (x = outward, y = down) as a closed
 * crescent that bulges just past the knuckle and tapers into a rounded tip
 * that curls back inwards. Then rotated so +X becomes +Z (radially outward).
 */
function makeCurvedClawGeo() {
  const s = new THREE.Shape();
  s.moveTo(0.007, 0.004);
  s.quadraticCurveTo(0.0135, -0.006, 0.0148, -0.02);
  s.quadraticCurveTo(0.0158, -0.034, 0.014, -0.046);
  s.quadraticCurveTo(0.0115, -0.058, 0.005, -0.066);
  s.quadraticCurveTo(0.002, -0.0695, 0.001, -0.0665);
  s.quadraticCurveTo(0.0035, -0.058, 0.005, -0.048);
  s.quadraticCurveTo(0.006, -0.034, 0.0045, -0.02);
  s.quadraticCurveTo(0.003, -0.008, 0.001, 0.001);
  s.quadraticCurveTo(0.0035, 0.0055, 0.007, 0.004);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.012,
    bevelEnabled: true,
    bevelThickness: 0.0016,
    bevelSize: 0.0013,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geo.translate(0, 0, -0.006);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

type Finger = {
  upper: THREE.Group;
  lower: THREE.Group;
  strut: THREE.Mesh;
  angle: number;
};

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
  private fingers: Finger[] = [];
  private bridge: THREE.Group;
  private carriage: THREE.Group;
  private cable: THREE.Mesh;
  private sleeve: THREE.Mesh;
  private coil: THREE.Mesh;
  private coilBuilt = 0;

  private vx = 0;
  private vz = 0;
  private hVis: number = D.clawHomeY;
  private hOff = 0;
  private hOffV = 0;
  private prevCmd: number = D.clawHomeY;
  private cmdVel = 0;
  private prevCmdVel = 0;
  private hKickCool = 0;
  private swX = 0;
  private swZ = 0;
  private swVX = 0;
  private swVZ = 0;
  private swingKicked = false;
  private liftKicked = false;
  private loadK = 0;
  private returnK = 0;
  private sinceRelease = 99;
  private clock = 0;
  private fingerG = [1, 1, 1];
  private fingerV = [0, 0, 0];
  private fingerSnap = [false, false, false];
  private gripCmd = 1;
  private closedTug = false;
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

    // ─── gantry rails ───────────────────────────────────────────────────────
    const gantry = new THREE.Group();
    for (const z of [-0.345, 0.345]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.9, 14), chrome);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, RAIL_Y, z);
      gantry.add(rail);

      const end = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 14), darkSteel);
      end.rotation.z = Math.PI / 2;
      end.position.set(0.45, RAIL_Y, z);
      gantry.add(end);
      const end2 = end.clone();
      end2.position.x = -0.45;
      gantry.add(end2);
    }
    mergeStatic(gantry);
    this.root.add(gantry);

    // ─── sliding bridge ─────────────────────────────────────────────────────
    this.bridge = new THREE.Group();
    const beam = new THREE.Mesh(new RoundedBoxGeometry(0.038, 0.02, 0.72, 2, 0.006), brushed);
    beam.position.y = BEAM_Y;
    this.bridge.add(beam);
    const beamCap = new THREE.Mesh(new RoundedBoxGeometry(0.042, 0.008, 0.72, 2, 0.003), chromeSoft);
    beamCap.position.y = BEAM_Y + 0.012;
    this.bridge.add(beamCap);
    for (const z of [-0.345, 0.345]) {
      const truck = new THREE.Mesh(new RoundedBoxGeometry(0.056, 0.03, 0.046, 2, 0.006), chromeSoft);
      truck.position.set(0, BEAM_Y, z);
      this.bridge.add(truck);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 12), chrome);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(0, BEAM_Y, z);
      this.bridge.add(hub);
    }
    mergeStatic(this.bridge);
    this.root.add(this.bridge);

    // ─── rectangular brushed-aluminium carriage ─────────────────────────────
    this.carriage = new THREE.Group();
    this.carriage.position.set(0, CARRIAGE_Y, 0);

    // top of the box sits at CARRIAGE_Y + 0.028 = 1.270, a clean 28 mm below
    // the pink window frame so the whole rectangle is visible.
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.165, 0.056, 0.098, 4, 0.01), brushed);
    this.carriage.add(box);

    const lid = new THREE.Mesh(new RoundedBoxGeometry(0.146, 0.009, 0.082, 2, 0.0035), brushedLight);
    lid.position.y = 0.024;
    this.carriage.add(lid);

    const seam = new THREE.Mesh(new RoundedBoxGeometry(0.166, 0.003, 0.099, 1, 0.001), chromeSoft);
    seam.position.y = 0.004;
    this.carriage.add(seam);

    // dark bottom collar plus chrome neck
    const collar = new THREE.Mesh(new RoundedBoxGeometry(0.104, 0.011, 0.07, 2, 0.0035), darkSteel);
    collar.position.y = -0.031;
    this.carriage.add(collar);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.016, 18), chrome);
    neck.position.y = -0.041;
    this.carriage.add(neck);

    // front machined bolt heads
    for (const x of [-0.058, 0.058]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 10), chromeSoft);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(x, 0.008, 0.0495);
      this.carriage.add(bolt);
    }
    mergeStatic(this.carriage);
    this.root.add(this.carriage);

    // ─── telescoping shaft + coiled black cable ─────────────────────────────
    const cableGeo = new THREE.CylinderGeometry(0.0078, 0.0088, 1, 12);
    cableGeo.translate(0, 0.5, 0);
    this.cable = new THREE.Mesh(cableGeo, chrome);
    this.root.add(this.cable);

    this.sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0145, 0.026, 14), chromeSoft);
    this.root.add(this.sleeve);

    this.coil = new THREE.Mesh(makeCoiledCableGeo(0.1), coilBlack);
    this.coilBuilt = 0.1;
    this.root.add(this.coil);

    // ─── machined chrome claw head ──────────────────────────────────────────
    const head = this.head;
    head.scale.setScalar(S);

    // vertical stepped cylinder: thin upper shaft → machined barrel →
    // compact clevis hub. Deliberately no wide "flying saucer" flange.
    const headLathe = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          [0, -0.018],
          [0.004, -0.0182],
          [0.0058, -0.0196],
          [0.0058, -0.0222],
          [0.0092, -0.0234],
          [0.0115, -0.0258],
          [0.0115, -0.0318],
          [0.0126, -0.0334],
          [0.017, -0.0348],
          [0.0224, -0.0362],
          [0.0286, -0.0382],
          [0.0308, -0.04],
          [0.0314, -0.0442],
          [0.0314, -0.0596],
          [0.03, -0.062],
          [0.0334, -0.0646],
          [0.034, -0.068],
          [0.034, -0.0752],
          [0.0326, -0.0782],
          [0.0272, -0.0802],
          [0.018, -0.0812],
          [0.012, -0.0816],
          [0, -0.0818],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        32
      ),
      chrome
    );
    head.add(headLathe);

    // two neat machined rings on the barrel
    for (const y of [-0.047, -0.055]) {
      const groove = new THREE.Mesh(new THREE.TorusGeometry(0.0313, 0.0012, 6, 36), brushedLight);
      groove.rotation.x = Math.PI / 2;
      groove.position.y = y;
      head.add(groove);
    }

    // vertical central plunger rod below the hub
    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.0078, 0.0052, 0.032, 16), chromeSoft);
    spindle.position.y = -0.0978;
    head.add(spindle);

    const spindleTip = new THREE.Mesh(new THREE.SphereGeometry(0.0052, 12, 8), chrome);
    spindleTip.position.y = -0.1138;
    head.add(spindleTip);

    // chrome bosses where the three linkage struts meet the plunger
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const boss = new THREE.Mesh(new THREE.SphereGeometry(0.0062, 12, 8), chromeSoft);
      boss.position.set(Math.sin(angle) * HUB_R, HUB_Y, Math.cos(angle) * HUB_R);
      head.add(boss);
    }

    // ─── 3 sleek curved chrome prongs with linkage struts ───────────────────
    const clawBladeGeo = makeCurvedClawGeo();
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;

      // compact chrome clevis ear on the barrel, all bright steel
      const mount = new THREE.Group();
      mount.rotation.y = angle;
      const lug = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.016, 0.022, 2, 0.003), brushedLight);
      lug.position.set(0, PIVOT_Y, 0.037);
      mount.add(lug);
      for (const side of [-1, 1]) {
        const cheek = new THREE.Mesh(new RoundedBoxGeometry(0.0018, 0.016, 0.02, 1, 0.0008), chromeSoft);
        cheek.position.set(side * 0.0065, PIVOT_Y, 0.04);
        mount.add(cheek);
      }
      const lugPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.018, 12), chromeSoft);
      lugPin.rotation.z = Math.PI / 2;
      lugPin.position.set(0, PIVOT_Y, PIVOT_Z);
      mount.add(lugPin);
      head.add(mount);

      // upper link — pivot sits on the clevis ear, rotated round the barrel
      const finger = new THREE.Group();
      finger.rotation.y = angle;
      finger.position.set(Math.sin(angle) * PIVOT_Z, PIVOT_Y, Math.cos(angle) * PIVOT_Z);

      const upper = new THREE.Group();
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 16, 12), chrome);
      upper.add(shoulder);
      const shoulderPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.022, 10), chromeSoft);
      shoulderPin.rotation.z = Math.PI / 2;
      upper.add(shoulderPin);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.007, L1, 12), chrome);
      arm.position.y = -L1 / 2;
      upper.add(arm);
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 14, 10), chromeSoft);
      knuckle.position.y = -L1;
      upper.add(knuckle);
      const knucklePin = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.022, 10), chromeSoft);
      knucklePin.rotation.z = Math.PI / 2;
      knucklePin.position.y = -L1;
      upper.add(knucklePin);
      mergeStatic(upper);
      upper.traverse((o) => (o.userData.noMerge = true));

      // long C-blade
      const lower = new THREE.Group();
      lower.position.y = -L1;
      const blade = new THREE.Mesh(clawBladeGeo, chrome);
      lower.add(blade);
      lower.traverse((o) => (o.userData.noMerge = true));

      upper.add(lower);
      finger.add(upper);
      head.add(finger);

      // inner diagonal strut, updated every frame in head-local space
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 1, 8), chromeSoft);
      strut.userData.noMerge = true;
      head.add(strut);

      this.fingers.push({ upper, lower, strut, angle });
    }

    this.root.add(this.head);
    mergeStatic(this.head, { skip: (m) => m.userData.noMerge === true });

    this.head.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });

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

  private stepPlanar(dt: number) {
    if (dt <= 0) return { x: 0, z: 0 };

    const tx = this.target.x;
    const tz = this.target.y;
    const nearHome = Math.hypot(tx + 0.2, tz - 0.02) < 0.06 || Math.hypot(tx, tz - 0.02) < 0.06;
    const wantReturn = this.sinceRelease < 1.3 && nearHome ? 1 : 0;
    this.returnK += (wantReturn - this.returnK) * Math.min(1, dt * 12);
    const boost = this.returnK;

    const omega = M.xyOmega + M.returnOmega * boost;
    const zeta = M.xyZeta - M.returnZeta * boost;
    const maxSpeed = M.xyMaxSpeed + M.returnMaxSpeed * boost;

    const steps = Math.max(1, Math.ceil(dt * 120));
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

  private stepHeight(dt: number) {
    if (dt > 0) {
      const inst = (this.height - this.prevCmd) / dt;
      this.cmdVel += (inst - this.cmdVel) * Math.min(1, dt * 24);
      const rawAcc = (this.cmdVel - this.prevCmdVel) / dt;
      this.prevCmdVel = this.cmdVel;
      this.prevCmd = this.height;
      const aCmd = THREE.MathUtils.clamp(rawAcc, -6, 6);

      // mechanical engage at the top of a descent
      if (this.cmdVel < -0.004 && this.hKickCool <= 0 && this.height > D.clawDropY + 0.05) {
        this.hOffV += M.hKick;
        this.hKickCool = M.hKickCool;
      }

      // the prize's weight sags the claw as the lift starts
      if (!this.liftKicked && this.grabbed && this.cmdVel > 0.01 && this.height < D.clawDropY + 0.025) {
        this.hOffV -= 0.075;
        this.liftKicked = true;
      }
      if (this.height > D.clawHomeY - 0.02 || !this.grabbed) this.liftKicked = false;

      const steps = Math.max(1, Math.ceil(dt * 120));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const acc = -M.hOmega * M.hOmega * this.hOff - 2 * M.hZeta * M.hOmega * this.hOffV - aCmd * M.hGain;
        this.hOffV += acc * h;
        this.hOff += this.hOffV * h;
      }

      if (!this.swingKicked && this.grabbed && this.cmdVel > 0.012 && this.height < D.clawDropY + 0.03) {
        this.swVX += 0.032;
        this.swVZ -= 0.018;
        this.swingKicked = true;
      }
      if (this.height > D.clawHomeY - 0.015) this.swingKicked = false;
    }

    this.hOff = THREE.MathUtils.clamp(this.hOff, -0.022, 0.022);
    this.hVis = this.height + this.hOff;

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

  private stepSway(dt: number, ax: number, az: number) {
    if (dt <= 0) return;
    const wantLoad = this.grabbed ? 1 : 0;
    this.loadK += (wantLoad - this.loadK) * Math.min(1, dt * 5);

    const omega = M.swayOmega - (M.swayOmega - M.swayLoadOmega) * this.loadK;
    const zeta = M.swayZeta + (M.swayLoadZeta - M.swayZeta) * this.loadK;
    const gain = M.swayGain + (M.swayLoadGain - M.swayGain) * this.loadK;
    const limit = M.swayLimit + (M.swayLoadLimit - M.swayLimit) * this.loadK;

    // idle breathing: tiny pendulum driven acceleration at rest
    const motion = Math.hypot(this.vx, this.vz);
    const idleW = THREE.MathUtils.clamp(1 - motion / 0.05, 0, 1);
    const t = this.clock * M.idleSwayOmega;
    const idleX = Math.sin(t) * M.idleSwayAccX * idleW;
    const idleZ = Math.cos(t * 0.83 + 1.2) * M.idleSwayAccZ * idleW;

    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      const accX = -omega * omega * this.swX - 2 * zeta * omega * this.swVX - ax * gain + idleX;
      const accZ = -omega * omega * this.swZ - 2 * zeta * omega * this.swVZ - az * gain + idleZ;
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

    const leanX = this.grabbed ? THREE.MathUtils.clamp(this.vz * M.leanGain, -M.leanLimit, M.leanLimit) : 0;
    const leanZ = this.grabbed ? THREE.MathUtils.clamp(-this.vx * M.leanGain, -M.leanLimit, M.leanLimit) : 0;
    const k = Math.min(1, dt * M.leanOmega);
    this.leanX += (leanX - this.leanX) * k;
    this.leanZ += (leanZ - this.leanZ) * k;
  }

  private stepFingers(dt: number) {
    if (dt > 0) {
      const want = this.grip;
      const prev = this.gripCmd;
      const maxStep = M.gripRate * dt;
      this.gripCmd += THREE.MathUtils.clamp(want - this.gripCmd, -maxStep, maxStep);

      // the close snaps shut: small upward tug + recoil when the jaws cross
      if (!this.closedTug && prev > 0.5 && this.gripCmd <= 0.5) {
        this.hOffV += 0.05;
        this.swVX += 0.018;
        this.closedTug = true;
      } else if (this.closedTug && this.gripCmd > 0.8) {
        this.closedTug = false;
      }

      this.gripHist.push({ t: this.clock, v: this.gripCmd });
      while (this.gripHist.length > 2 && this.clock - this.gripHist[0].t > M.fingerDelay * 3 + 0.06) {
        this.gripHist.shift();
      }
    }

    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    for (let i = 0; i < this.fingers.length; i++) {
      const target = this.gripAt(this.clock - i * M.fingerDelay);
      let g = this.fingerG[i];
      let v = this.fingerV[i];

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

  private applyVisual() {
    const top = CABLE_TOP;
    const cableLen = Math.max(0.014, top - (this.hVis + HEAD_TOP * S));
    const swingLever = cableLen + 0.3;

    const headX = this.pos.x + Math.sin(this.swX) * swingLever;
    const headZ = this.pos.y + Math.sin(this.swZ) * swingLever;

    this.head.position.set(headX, this.hVis, headZ);
    this.head.rotation.z = this.swX * M.tiltGain + this.leanZ;
    this.head.rotation.x = -this.swZ * M.tiltGain + this.leanX;

    this.body.setNextKinematicTranslation({ x: headX, y: this.hVis, z: headZ });

    // fingers + diagonal linkage struts (head-local coordinates)
    for (let i = 0; i < this.fingers.length; i++) {
      const f = this.fingers[i];
      const g = this.fingerG[i];
      const a = -THREE.MathUtils.lerp(A_CLOSED, A_OPEN, g);
      f.upper.rotation.x = a;
      f.lower.rotation.x = THREE.MathUtils.lerp(C_CLOSED, C_OPEN, g);

      const ky = PIVOT_Y - L1 * Math.cos(a);
      const kz = PIVOT_Z - L1 * Math.sin(a);
      const sx = Math.sin(f.angle);
      const cz = Math.cos(f.angle);
      const p1x = sx * HUB_R;
      const p1z = cz * HUB_R;
      const p2x = sx * kz;
      const p2z = cz * kz;
      strutDir.set(p2x - p1x, ky - HUB_Y, p2z - p1z);
      const len = Math.max(1e-4, strutDir.length());
      f.strut.position.set((p1x + p2x) / 2, (HUB_Y + ky) / 2, (p1z + p2z) / 2);
      f.strut.quaternion.setFromUnitVectors(UP, strutDir.normalize());
      f.strut.scale.set(1, len, 1);
    }

    this.bridge.position.x = this.pos.x;
    this.carriage.position.set(this.pos.x, CARRIAGE_Y, this.pos.y);
    this.carriage.rotation.z = -this.swX * 0.16;
    this.carriage.rotation.x = this.swZ * 0.16;

    // telescoping chrome shaft
    const bottom = this.hVis + HEAD_TOP * S;
    const anchorX = this.pos.x + Math.sin(this.swX) * cableLen;
    const anchorZ = this.pos.y + Math.sin(this.swZ) * cableLen;
    cableDir.set(anchorX - this.pos.x, bottom - top, anchorZ - this.pos.y);
    const len = Math.max(0.014, cableDir.length());
    this.cable.scale.set(1, len, 1);
    this.cable.position.set(this.pos.x, top, this.pos.y);
    this.cable.quaternion.setFromUnitVectors(UP, cableDir.clone().normalize());

    this.sleeve.position.set(this.pos.x, top - 0.013, this.pos.y);

    // black coiled cord: a neat, tight vertical helix just left of the chrome
    // shaft, running from the carriage underside to the top of the cylinder.
    const coilTopX = this.pos.x - 0.052;
    const coilTopY = CARRIAGE_Y - 0.03;
    const coilTopZ = this.pos.y;
    const coilBotX = headX - 0.022 * S;
    const coilBotY = this.hVis - 0.048 * S;
    const coilBotZ = headZ;
    coilDir.set(coilBotX - coilTopX, coilBotY - coilTopY, coilBotZ - coilTopZ);
    const coilLen = Math.max(0.02, coilDir.length());
    if (Math.abs(coilLen - this.coilBuilt) > 0.0035) {
      this.coil.geometry.dispose();
      this.coil.geometry = makeCoiledCableGeo(coilLen);
      this.coilBuilt = coilLen;
    }
    this.coil.position.set(coilTopX, coilTopY, coilTopZ);
    this.coil.quaternion.setFromUnitVectors(DOWN, coilDir.clone().normalize());
  }

  private sample() {
    const lever = Math.max(0.014, CABLE_TOP - (this.hVis + HEAD_TOP * S)) + M.headLever;
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
    this.grip = 1;
    this.sinceRelease = 0;
    this.swingKicked = false;
    this.liftKicked = false;
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
