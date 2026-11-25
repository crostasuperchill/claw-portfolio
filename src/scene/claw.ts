import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { D } from './dims';
import { GRAB_THRESHOLD, grabScore } from '../game/grab';
import { mergeStatic } from './merge';
import type { BodyRef } from '../contracts';

const S = D.clawScale * 1.02;
const CABLE_TOP = 1.265;
const HEAD_TOP = -0.012;

const L1 = 0.05;
const L2 = 0.068;
const PIVOT_Z = 0.088;
const A_CLOSED = 0.35;
const C_CLOSED = 1.02;
const A_OPEN = 0.62;
const C_OPEN = 0.3;
const PIVOT_Y = D.grabTipOffset / S + L1 * Math.cos(A_CLOSED) + L2 * Math.cos(C_CLOSED);

/* bright gleaming silver materials */
const chrome = new THREE.MeshStandardMaterial({
  color: '#f2f6fb',
  metalness: 0.78,
  roughness: 0.16,
  envMapIntensity: 1.55,
});

const brushed = new THREE.MeshStandardMaterial({
  color: '#cfd6e0',
  metalness: 0.68,
  roughness: 0.28,
  envMapIntensity: 1.35,
});

const darkSteel = new THREE.MeshStandardMaterial({
  color: '#464d57',
  metalness: 0.6,
  roughness: 0.38,
  envMapIntensity: 1.0,
});

const coilBlack = new THREE.MeshStandardMaterial({
  color: '#1e2128',
  metalness: 0.15,
  roughness: 0.55,
});

const UP = new THREE.Vector3(0, 1, 0);
const slingDir = new THREE.Vector3();
const cableDir = new THREE.Vector3();

const M = {
  xyOmega: 9.4,
  xyZeta: 0.9,
  xyMaxSpeed: 1.15,
  returnOmega: 4.2,
  returnZeta: 0.14,
  returnMaxSpeed: 0.45,
  hOmega: 9.0,
  hZeta: 0.5,
  hGain: 1.4,
  hKick: 0.075,
  hKickCool: 1.2,
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
  gripOmega: 26,
  gripZeta: 0.42,
  gripLimit: 0.06,
  gripRate: 2.0,
  gripSnap: 1.1,
  fingerDelay: 0.04,
};

function makeCoiledCableGeo() {
  const pts: THREE.Vector3[] = [];
  const turns = 11;
  const steps = 66;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = 0.011;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.5 - t, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, 64, 0.0028, 5, false);
}

function makeCurvedClawGeo() {
  // Curved crescent blade in XY, rotated so X maps to +Z (outward)
  const s = new THREE.Shape();
  s.moveTo(-0.004, 0.004);
  s.quadraticCurveTo(0.022, -0.024, 0.014, -0.048);
  s.quadraticCurveTo(0.006, -0.062, -0.003, -L2);
  s.quadraticCurveTo(0.002, -0.052, 0.006, -0.042);
  s.quadraticCurveTo(0.012, -0.022, -0.008, -0.004);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.007,
    bevelEnabled: true,
    bevelThickness: 0.0018,
    bevelSize: 0.0018,
    bevelSegments: 1,
    curveSegments: 8,
  });
  geo.translate(0, 0, -0.0035);
  geo.rotateY(-Math.PI / 2);
  return geo;
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
  private coil: THREE.Mesh;
  private slings: THREE.Mesh[] = [];

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
  private loadK = 0;
  private returnK = 0;
  private sinceRelease = 99;
  private clock = 0;
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

    // ─── gantry rails ───────────────────────────────────────────────────────
    const gantry = new THREE.Group();
    for (const z of [-0.345, 0.345]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.9, 10), chrome);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, 1.304, z);
      gantry.add(rail);
    }
    mergeStatic(gantry);
    this.root.add(gantry);

    // ─── sliding bridge ─────────────────────────────────────────────────────
    this.bridge = new THREE.Group();
    const beam = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.02, 0.72, 2, 0.005), brushed);
    beam.position.y = 1.298;
    this.bridge.add(beam);
    for (const z of [-0.345, 0.345]) {
      const truck = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.026, 0.044, 2, 0.005), darkSteel);
      truck.position.set(0, 1.3, z);
      this.bridge.add(truck);
    }
    mergeStatic(this.bridge);
    this.root.add(this.bridge);

    // ─── motor carriage ─────────────────────────────────────────────────────
    this.carriage = new THREE.Group();
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.092, 0.048, 0.092, 2, 0.008), brushed);
    box.position.y = 1.278;
    this.carriage.add(box);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.018, 16), chrome);
    collar.position.y = 1.248;
    this.carriage.add(collar);
    mergeStatic(this.carriage);
    this.root.add(this.carriage);

    // ─── telescoping shaft + coiled black cable ─────────────────────────────
    this.cable = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 10), chrome);
    this.root.add(this.cable);

    this.coil = new THREE.Mesh(makeCoiledCableGeo(), coilBlack);
    this.root.add(this.coil);

    for (let i = 0; i < 2; i++) {
      const sling = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 1, 6), brushed);
      this.slings.push(sling);
      this.root.add(sling);
    }

    // ─── silver machined claw head ──────────────────────────────────────────
    const head = this.head;
    head.scale.setScalar(S);

    const headLathe = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          [0.012, -0.008],
          [0.02, -0.012],
          [0.024, -0.024],
          [0.072, -0.03],
          [0.078, -0.036],
          [0.078, -0.048],
          [0.068, -0.055],
          [0.036, -0.064],
          [0.022, -0.068],
          [0, -0.068],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        24
      ),
      chrome
    );
    head.add(headLathe);

    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.007, 24), brushed);
    flange.position.y = -0.038;
    head.add(flange);

    for (const side of [-1, 1]) {
      const eyelet = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.008, 10), chrome);
      eyelet.position.set(side * 0.074, -0.028, 0);
      head.add(eyelet);
    }

    // ─── 3 sleek curved prongs ──────────────────────────────────────────────
    const clawBladeGeo = makeCurvedClawGeo();
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;

      const mount = new THREE.Group();
      mount.rotation.y = angle;
      const lug = new THREE.Mesh(new RoundedBoxGeometry(0.024, 0.018, 0.024, 1, 0.003), brushed);
      lug.position.set(0, PIVOT_Y, 0.082);
      mount.add(lug);
      head.add(mount);

      const finger = new THREE.Group();
      finger.rotation.y = angle;
      finger.position.set(0, PIVOT_Y, PIVOT_Z);

      const upper = new THREE.Group();
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), chrome);
      upper.add(shoulder);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.007, L1, 10), chrome);
      arm.position.y = -L1 / 2;
      upper.add(arm);
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), brushed);
      knuckle.position.y = -L1;
      upper.add(knuckle);
      mergeStatic(upper);
      upper.traverse((o) => (o.userData.noMerge = true));

      const lower = new THREE.Group();
      lower.position.y = -L1;
      const blade = new THREE.Mesh(clawBladeGeo, chrome);
      lower.add(blade);
      lower.traverse((o) => (o.userData.noMerge = true));

      upper.add(lower);
      finger.add(upper);
      this.fingers.push({ upper, lower });
      head.add(finger);
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
    const nearHome = Math.hypot(tx, tz - 0.02) < 0.06;
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

      if (this.cmdVel < -0.004 && this.hKickCool <= 0 && this.height > D.clawDropY + 0.05) {
        this.hOffV += M.hKick;
        this.hKickCool = M.hKickCool;
      }

      const steps = Math.max(1, Math.ceil(dt * 120));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const acc = -M.hOmega * M.hOmega * this.hOff - 2 * M.hZeta * M.hOmega * this.hOffV - aCmd * M.hGain;
        this.hOffV += acc * h;
        this.hOff += this.hOffV * h;
      }

      if (!this.swingKicked && this.grabbed && this.cmdVel > 0.012 && this.height < D.clawDropY + 0.03) {
        this.swVX += 0.035;
        this.swVZ -= 0.02;
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

    const steps = Math.max(1, Math.ceil(dt * 120));
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

    const leanX = this.grabbed ? THREE.MathUtils.clamp(this.vz * M.leanGain, -M.leanLimit, M.leanLimit) : 0;
    const leanZ = this.grabbed ? THREE.MathUtils.clamp(-this.vx * M.leanGain, -M.leanLimit, M.leanLimit) : 0;
    const k = Math.min(1, dt * M.leanOmega);
    this.leanX += (leanX - this.leanX) * k;
    this.leanZ += (leanZ - this.leanZ) * k;
  }

  private stepFingers(dt: number) {
    if (dt > 0) {
      const want = this.grip;
      const maxStep = M.gripRate * dt;
      this.gripCmd += THREE.MathUtils.clamp(want - this.gripCmd, -maxStep, maxStep);
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
    const cableLen = Math.max(0.012, top - (this.hVis + HEAD_TOP * S));
    const lever = cableLen + M.headLever;

    const headX = this.pos.x + Math.sin(this.swX) * lever;
    const headZ = this.pos.y + Math.sin(this.swZ) * lever;

    this.head.position.set(headX, this.hVis, headZ);
    this.head.rotation.z = this.swX * M.tiltGain + this.leanZ;
    this.head.rotation.x = -this.swZ * M.tiltGain + this.leanX;

    this.body.setNextKinematicTranslation({ x: headX, y: this.hVis, z: headZ });

    for (let i = 0; i < this.fingers.length; i++) {
      const g = this.fingerG[i];
      this.fingers[i].upper.rotation.x = -THREE.MathUtils.lerp(A_CLOSED, A_OPEN, g);
      this.fingers[i].lower.rotation.x = THREE.MathUtils.lerp(C_CLOSED, C_OPEN, g);
    }

    this.bridge.position.x = this.pos.x;
    this.carriage.position.set(this.pos.x, 0, this.pos.y);

    const anchorX = this.pos.x + Math.sin(this.swX) * cableLen;
    const anchorZ = this.pos.y + Math.sin(this.swZ) * cableLen;
    const bottom = this.hVis + HEAD_TOP * S;
    cableDir.set(anchorX - this.pos.x, bottom - top, anchorZ - this.pos.y);
    const len = Math.max(0.012, cableDir.length());
    this.cable.scale.set(1, len, 1);
    this.cable.position.set((this.pos.x + anchorX) / 2, (top + bottom) / 2, (this.pos.y + anchorZ) / 2);
    this.cable.quaternion.setFromUnitVectors(UP, cableDir.normalize());

    this.coil.scale.set(1, Math.max(0.03, len * 0.9), 1);
    this.coil.position.set(this.cable.position.x - 0.02, this.cable.position.y, this.cable.position.z);
    this.coil.quaternion.copy(this.cable.quaternion);

    const anchorY = this.hVis - 0.028 * S;
    for (let i = 0; i < this.slings.length; i++) {
      const sling = this.slings[i];
      const bx = headX + (i === 0 ? -1 : 1) * 0.074 * S;
      slingDir.set(bx - this.pos.x, anchorY - top, headZ - this.pos.y);
      const slen = Math.max(0.02, slingDir.length());
      sling.position.set((this.pos.x + bx) / 2, (top + anchorY) / 2, (this.pos.y + headZ) / 2);
      sling.scale.set(1, slen, 1);
      sling.quaternion.setFromUnitVectors(UP, slingDir.normalize());
    }
  }

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
