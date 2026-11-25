import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { D } from './dims';
import { GRAB_THRESHOLD, grabScore } from '../game/grab';
import { mergeStatic } from './merge';
import type { BodyRef } from '../contracts';
import type { CharmObstacle } from './charms';

const S = D.clawScale * 1.02;

/* ── vertical layout ─────────────────────────────────────────────────────── */
const RAIL_Y = 1.285;
const BEAM_Y = 1.278;
const CARRIAGE_Y = 1.246;
const CABLE_TOP = 1.202;
const HEAD_TOP = -0.018;

/* ── finger kinematics (head-local) ──────────────────────────────────────── */
const L1 = 0.052;
const L2 = 0.074;
const PIVOT_Z = 0.044;
const A_CLOSED = 0.34;
const C_CLOSED = 1.04;
const A_OPEN = 0.44;
const C_OPEN = 0.36;
const PIVOT_Y = D.grabTipOffset / S + L1 * Math.cos(A_CLOSED) + L2 * Math.cos(C_CLOSED);

const HUB_Y = -0.088;
const HUB_R = 0.014;

/* ── gleaming mirror-chrome palette ──────────────────────────────────────── */
const chrome = new THREE.MeshStandardMaterial({
  color: '#f6f9ff',
  metalness: 0.92,
  roughness: 0.09,
  envMapIntensity: 2.0,
});

const chromeSoft = new THREE.MeshStandardMaterial({
  color: '#dce5f0',
  metalness: 0.84,
  roughness: 0.16,
  envMapIntensity: 1.7,
});

const brushed = new THREE.MeshStandardMaterial({
  color: '#cad4e2',
  metalness: 0.78,
  roughness: 0.24,
  envMapIntensity: 1.55,
});

const brushedLight = new THREE.MeshStandardMaterial({
  color: '#e8eef6',
  metalness: 0.76,
  roughness: 0.2,
  envMapIntensity: 1.7,
});

const darkSteel = new THREE.MeshStandardMaterial({
  color: '#343c48',
  metalness: 0.7,
  roughness: 0.3,
  envMapIntensity: 1.2,
});

const coilBlack = new THREE.MeshStandardMaterial({
  color: '#171a20',
  metalness: 0.18,
  roughness: 0.45,
  envMapIntensity: 0.75,
});

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const cableDir = new THREE.Vector3();
const coilDir = new THREE.Vector3();
const strutDir = new THREE.Vector3();

const M = {
  /* snappier, responsive arcade carriage with crisp inertia */
  xyOmega: 11.8,
  xyZeta: 0.84,
  xyMaxSpeed: 1.52,
  returnOmega: 6.2,
  returnZeta: 0.18,
  returnMaxSpeed: 0.65,
  /* vertical spring: feels weighty when dropping deep and lifting */
  hOmega: 9.6,
  hZeta: 0.48,
  hGain: 1.15,
  hKick: 0.068,
  hKickCool: 1.1,
  /* pendulum */
  swayOmega: 5.4,
  swayZeta: 0.3,
  swayGain: 0.14,
  swayLimit: 0.036,
  swayLoadOmega: 4.3,
  swayLoadZeta: 0.36,
  swayLoadGain: 0.19,
  swayLoadLimit: 0.048,
  tiltGain: 0.56,
  headLever: 0.3,
  leanGain: 0.052,
  leanLimit: 0.028,
  leanOmega: 5.2,
  /* fingers */
  gripOmega: 28,
  gripZeta: 0.38,
  gripLimit: 0.055,
  gripRate: 2.9,
  gripSnap: 1.45,
  fingerDelay: 0.035,
  /* idle breathing */
  idleSwayOmega: 1.35,
  idleSwayAccX: 0.06,
  idleSwayAccZ: 0.044,
};

function makeDropShadowTex(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const cx = size / 2;
  const grad = g.createRadialGradient(cx, cx, size * 0.04, cx, cx, size * 0.5);
  grad.addColorStop(0, 'rgba(10, 18, 38, 0.52)');
  grad.addColorStop(0.45, 'rgba(10, 18, 38, 0.28)');
  grad.addColorStop(0.8, 'rgba(10, 18, 38, 0.07)');
  grad.addColorStop(1, 'rgba(10, 18, 38, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Tight black helical power cord curving neatly from carriage to claw head.
 * Dynamically scales turn count when extending deep into the pile.
 */
function makeCoiledCableGeo(length: number) {
  const pts: THREE.Vector3[] = [];
  const turns = Math.max(10, Math.round(11 + length * 26));
  const steps = Math.min(420, turns * 20);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = 0.0102;
    const bow = -0.008 * Math.sin(Math.PI * t);
    pts.push(new THREE.Vector3(Math.cos(a) * r + bow, -t * length, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, Math.min(420, steps + 40), 0.0033, 5, false);
}

/**
 * Sleek, graceful mirror-chrome prong blade matching the wider, refined
 * C-curved silhouette in reference/target.png.
 */
function makeCurvedClawGeo() {
  const s = new THREE.Shape();
  s.moveTo(0.006, 0.004);
  s.quadraticCurveTo(0.0155, -0.008, 0.019, -0.024);
  s.quadraticCurveTo(0.021, -0.04, 0.0175, -0.055);
  s.quadraticCurveTo(0.013, -0.068, 0.0035, -0.074);
  s.quadraticCurveTo(0.0005, -0.076, 0.0, -0.0725);
  s.quadraticCurveTo(0.006, -0.064, 0.0095, -0.052);
  s.quadraticCurveTo(0.012, -0.038, 0.0105, -0.024);
  s.quadraticCurveTo(0.008, -0.01, 0.001, 0.001);
  s.quadraticCurveTo(0.003, 0.005, 0.006, 0.004);
  s.closePath();

  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.0068,
    bevelEnabled: true,
    bevelThickness: 0.0012,
    bevelSize: 0.001,
    bevelSegments: 2,
    curveSegments: 14,
  });
  geo.translate(0, 0, -0.0034);
  geo.rotateY(-Math.PI / 2);
  return geo;
}

type Finger = {
  upper: THREE.Group;
  lower: THREE.Group;
  strut: THREE.Mesh;
  angle: number;
  tipBody: RAPIER.RigidBody;
};

export class Claw {
  root = new THREE.Group();
  head = new THREE.Group();
  target = new THREE.Vector2(0, 0);
  pos = new THREE.Vector2(0, 0);
  height: number = D.clawHomeY;
  grip = 1;
  grabbed: BodyRef | null = null;
  /** Currently computed target drop height for the active descent. */
  dropTargetY: number = D.clawDropY;

  private body: RAPIER.RigidBody;
  private joint: RAPIER.ImpulseJoint | null = null;
  private fingers: Finger[] = [];
  private bridge: THREE.Group;
  private carriage: THREE.Group;
  private cable: THREE.Mesh;
  private sleeve: THREE.Mesh;
  private coil: THREE.Mesh;
  private coilBuilt = 0;

  /* depth-cue vertical shadow + subtle aim ring projected on surface below claw */
  private aimShadow: THREE.Mesh;
  private aimRing: THREE.Mesh;
  private aimRingMat: THREE.MeshBasicMaterial;
  private aimFade = 0;

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
    // Compact hub kinematic body positioned on the claw barrel (not blocking prong tips)
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, D.clawHomeY, 0)
    );
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(0.032 * D.clawScale, 0.038 * D.clawScale)
        .setTranslation(0, -0.055 * D.clawScale, 0)
        .setFriction(0.6),
      this.body
    );

    // ─── gantry rails ───────────────────────────────────────────────────────
    const gantry = new THREE.Group();
    for (const z of [-0.345, 0.345]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 14), chrome);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, RAIL_Y, z);
      gantry.add(rail);

      const end = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.014, 14), darkSteel);
      end.rotation.z = Math.PI / 2;
      end.position.set(0.45, RAIL_Y, z);
      gantry.add(end);
      const end2 = end.clone();
      end2.position.x = -0.45;
      gantry.add(end2);
    }
    mergeStatic(gantry);
    this.root.add(gantry);

    // ─── sliding bridge (front-to-back bar that makes Z position obvious) ───
    this.bridge = new THREE.Group();
    const beam = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.022, 0.72, 2, 0.006), brushed);
    beam.position.y = BEAM_Y;
    this.bridge.add(beam);
    const beamCap = new THREE.Mesh(new RoundedBoxGeometry(0.044, 0.009, 0.72, 2, 0.003), chromeSoft);
    beamCap.position.y = BEAM_Y + 0.012;
    this.bridge.add(beamCap);
    for (const z of [-0.345, 0.345]) {
      const truck = new THREE.Mesh(new RoundedBoxGeometry(0.058, 0.03, 0.048, 2, 0.006), chromeSoft);
      truck.position.set(0, BEAM_Y, z);
      this.bridge.add(truck);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.062, 12), chrome);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(0, BEAM_Y, z);
      this.bridge.add(hub);
    }
    mergeStatic(this.bridge);
    this.root.add(this.bridge);

    // ─── rectangular brushed-aluminium carriage ─────────────────────────────
    this.carriage = new THREE.Group();
    this.carriage.position.set(0, CARRIAGE_Y, 0);

    const box = new THREE.Mesh(new RoundedBoxGeometry(0.165, 0.056, 0.1, 4, 0.01), brushed);
    this.carriage.add(box);

    const lid = new THREE.Mesh(new RoundedBoxGeometry(0.146, 0.009, 0.084, 2, 0.0035), brushedLight);
    lid.position.y = 0.024;
    this.carriage.add(lid);

    const seam = new THREE.Mesh(new RoundedBoxGeometry(0.166, 0.003, 0.101, 1, 0.001), chromeSoft);
    seam.position.y = 0.004;
    this.carriage.add(seam);

    const collar = new THREE.Mesh(new RoundedBoxGeometry(0.104, 0.011, 0.072, 2, 0.0035), darkSteel);
    collar.position.y = -0.031;
    this.carriage.add(collar);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.016, 18), chrome);
    neck.position.y = -0.041;
    this.carriage.add(neck);

    for (const x of [-0.058, 0.058]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.004, 10), chromeSoft);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(x, 0.008, 0.0505);
      this.carriage.add(bolt);
    }
    mergeStatic(this.carriage);
    this.root.add(this.carriage);

    // ─── telescoping shaft + coiled black cable ─────────────────────────────
    const cableGeo = new THREE.CylinderGeometry(0.0076, 0.0086, 1, 12);
    cableGeo.translate(0, 0.5, 0);
    this.cable = new THREE.Mesh(cableGeo, chrome);
    this.root.add(this.cable);

    this.sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.028, 14), chromeSoft);
    this.root.add(this.sleeve);

    this.coil = new THREE.Mesh(makeCoiledCableGeo(0.1), coilBlack);
    this.coilBuilt = 0.1;
    this.root.add(this.coil);

    // ─── machined chrome claw head ──────────────────────────────────────────
    const head = this.head;
    head.scale.setScalar(S);

    const headLathe = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          [0, -0.018],
          [0.0045, -0.0182],
          [0.0064, -0.0196],
          [0.0064, -0.0222],
          [0.0102, -0.0234],
          [0.0124, -0.026],
          [0.0124, -0.032],
          [0.014, -0.0338],
          [0.0185, -0.0352],
          [0.024, -0.0368],
          [0.0295, -0.0388],
          [0.0315, -0.041],
          [0.032, -0.045],
          [0.032, -0.06],
          [0.03, -0.0622],
          [0.034, -0.065],
          [0.0345, -0.0685],
          [0.0345, -0.0755],
          [0.0326, -0.0785],
          [0.0272, -0.0804],
          [0.018, -0.0812],
          [0.012, -0.0816],
          [0, -0.0818],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        32
      ),
      chrome
    );
    head.add(headLathe);

    for (const y of [-0.047, -0.055]) {
      const groove = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0013, 6, 36), brushedLight);
      groove.rotation.x = Math.PI / 2;
      groove.position.y = y;
      head.add(groove);
    }

    const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.0078, 0.0052, 0.034, 16), chromeSoft);
    spindle.position.y = -0.098;
    head.add(spindle);

    const spindleTip = new THREE.Mesh(new THREE.SphereGeometry(0.0054, 12, 8), chrome);
    spindleTip.position.y = -0.115;
    head.add(spindleTip);

    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const boss = new THREE.Mesh(new THREE.SphereGeometry(0.0064, 12, 8), chromeSoft);
      boss.position.set(Math.sin(angle) * HUB_R, HUB_Y, Math.cos(angle) * HUB_R);
      head.add(boss);
    }

    // ─── 3 sleek curved chrome prongs + kinematic tip colliders ─────────────
    const clawBladeGeo = makeCurvedClawGeo();
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;

      const mount = new THREE.Group();
      mount.rotation.y = angle;
      const lug = new THREE.Mesh(new RoundedBoxGeometry(0.011, 0.016, 0.022, 2, 0.003), brushedLight);
      lug.position.set(0, PIVOT_Y, 0.036);
      mount.add(lug);
      for (const side of [-1, 1]) {
        const cheek = new THREE.Mesh(new RoundedBoxGeometry(0.0018, 0.016, 0.02, 1, 0.0008), chromeSoft);
        cheek.position.set(side * 0.006, PIVOT_Y, 0.039);
        mount.add(cheek);
      }
      const lugPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.017, 12), darkSteel);
      lugPin.rotation.z = Math.PI / 2;
      lugPin.position.set(0, PIVOT_Y, PIVOT_Z);
      mount.add(lugPin);
      head.add(mount);

      const finger = new THREE.Group();
      finger.rotation.y = angle;
      finger.position.set(Math.sin(angle) * PIVOT_Z, PIVOT_Y, Math.cos(angle) * PIVOT_Z);

      const upper = new THREE.Group();
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.0098, 16, 12), chrome);
      upper.add(shoulder);
      const shoulderPin = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, 0.02, 10), darkSteel);
      shoulderPin.rotation.z = Math.PI / 2;
      upper.add(shoulderPin);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0076, 0.0062, L1, 12), chrome);
      arm.position.y = -L1 / 2;
      upper.add(arm);
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.0088, 14, 10), chromeSoft);
      knuckle.position.y = -L1;
      upper.add(knuckle);
      const knucklePin = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.02, 10), darkSteel);
      knucklePin.rotation.z = Math.PI / 2;
      knucklePin.position.y = -L1;
      upper.add(knucklePin);
      mergeStatic(upper);
      upper.traverse((o) => (o.userData.noMerge = true));

      const lower = new THREE.Group();
      lower.position.y = -L1;
      const blade = new THREE.Mesh(clawBladeGeo, chrome);
      lower.add(blade);
      lower.traverse((o) => (o.userData.noMerge = true));

      upper.add(lower);
      finger.add(upper);
      head.add(finger);

      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 8), chromeSoft);
      strut.userData.noMerge = true;
      head.add(strut);

      // Articulated kinematic prong-tip collider so open prongs physically part capsules on descent
      const tipBody = world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, D.clawHomeY - 0.14, 0)
      );
      world.createCollider(
        RAPIER.ColliderDesc.ball(0.013).setFriction(0.45).setRestitution(0.05),
        tipBody
      );

      this.fingers.push({ upper, lower, strut, angle, tipBody });
    }

    this.root.add(this.head);
    mergeStatic(this.head, { skip: (m) => m.userData.noMerge === true });

    this.head.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });

    // ─── depth-perception vertical drop shadow + subtle aim ring ────────────
    this.aimShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.15),
      new THREE.MeshBasicMaterial({
        map: makeDropShadowTex(),
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        toneMapped: false,
      })
    );
    this.aimShadow.rotation.x = -Math.PI / 2;
    this.aimShadow.renderOrder = 2;
    this.root.add(this.aimShadow);

    this.aimRingMat = new THREE.MeshBasicMaterial({
      color: '#5ef2ff',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.aimRing = new THREE.Mesh(new THREE.RingGeometry(0.044, 0.054, 32), this.aimRingMat);
    this.aimRing.rotation.x = -Math.PI / 2;
    this.aimRing.renderOrder = 3;
    this.root.add(this.aimRing);

    this.update(0);

    if (typeof window !== 'undefined') {
      (window as unknown as { __clawArm?: () => unknown }).__clawArm = () => this.sample();
    }
  }

  aim(dx: number, dz: number) {
    const limX = D.playfield.w / 2 - 0.085;
    const limZ = D.playfield.d / 2 - 0.085;
    this.target.x = THREE.MathUtils.clamp(this.target.x + dx, -limX, limX);
    this.target.y = THREE.MathUtils.clamp(this.target.y + dz, -limZ, limZ);
  }

  setHeight(y: number) {
    this.height = y;
  }

  setGrip(g: number) {
    this.grip = THREE.MathUtils.clamp(g, 0, 1);
  }

  /**
   * Computes a realistic drop target height beneath the current claw (x, z):
   * descends all the way down until the prongs wrap around the top capsule/prize
   * directly below, or all the way to near-floor (`D.clawDropY = 0.89`) when
   * over an open spot — while respecting the acrylic chute divider wall.
   */
  computeDropHeight(): number {
    const x = this.pos.x;
    const z = this.pos.y;
    let highestCenterY = -Infinity;

    for (const ref of this.refs.values()) {
      if (ref.collected) continue;
      const t = ref.body.translation();
      const d = Math.hypot(t.x - x, t.z - z);
      if (d <= D.grabRadius * 0.92 && t.y > highestCenterY) {
        highestCenterY = t.y;
      }
    }

    // Check if the claw is sitting over the acrylic chute divider rim (height 0.19 m above floor = 0.91)
    const inChuteOuter =
      Math.abs(x - D.chute.x) < 0.145 && Math.abs(z - D.chute.z) < 0.145;
    const inChuteInner =
      Math.abs(x - D.chute.x) < 0.055 && Math.abs(z - D.chute.z) < 0.055;
    const overChuteWall = inChuteOuter && !inChuteInner;

    let targetY: number;
    if (highestCenterY > -Infinity) {
      // Settle so the prong tips reach slightly below the capsule's equator for a real deep wrap!
      targetY = highestCenterY - D.grabTipOffset - 0.018;
    } else {
      // No capsule underneath: drop all the way down close to the playfield floor.
      targetY = D.clawDropY;
    }

    if (overChuteWall) {
      // Keep tips above the 0.19 m acrylic chute divider wall (top at 0.913)
      targetY = Math.max(targetY, 0.925 - D.grabTipOffset);
    }

    this.dropTargetY = THREE.MathUtils.clamp(targetY, D.clawDropY, D.clawHomeY - 0.06);
    return this.dropTargetY;
  }

  /** Bounding spheres covering carriage, shaft, head, and prongs for charm collision. */
  getCharmObstacles(): CharmObstacle[] {
    const headX = this.head.position.x;
    const headY = this.head.position.y;
    const headZ = this.head.position.z;
    const midY = (CARRIAGE_Y + headY) * 0.5;
    return [
      { x: this.pos.x, y: CARRIAGE_Y, z: this.pos.y, r: 0.088 },
      { x: (this.pos.x + headX) * 0.5, y: midY, z: (this.pos.y + headZ) * 0.5, r: 0.036 },
      { x: headX, y: headY - 0.065, z: headZ, r: 0.068 },
      { x: headX, y: headY - 0.145, z: headZ, r: 0.072 },
    ];
  }

  /** True when the carriage, head, or fingers have meaningful motion (used to drive dynamic shadows). */
  get isMoving(): boolean {
    return (
      Math.hypot(this.vx, this.vz) > 0.004 ||
      Math.abs(this.cmdVel) > 0.004 ||
      Math.abs(this.hOffV) > 0.004 ||
      Math.hypot(this.swVX, this.swVZ) > 0.01
    );
  }

  update(dt: number, activelyAiming = false) {
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
    this.applyVisual(step, activelyAiming);
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

    const limX = D.playfield.w / 2 - 0.075;
    const limZ = D.playfield.d / 2 - 0.075;
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
      const aCmd = THREE.MathUtils.clamp(rawAcc, -7, 7);

      // mechanical engage kick at the start of a descent
      if (this.cmdVel < -0.008 && this.hKickCool <= 0 && this.height > this.dropTargetY + 0.05) {
        this.hOffV += M.hKick;
        this.hKickCool = M.hKickCool;
      }

      // prize weight sags the claw when lifting off the pile
      if (!this.liftKicked && this.grabbed && this.cmdVel > 0.015 && this.height < this.dropTargetY + 0.04) {
        this.hOffV -= 0.085;
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

      if (!this.swingKicked && this.grabbed && this.cmdVel > 0.015 && this.height < this.dropTargetY + 0.045) {
        this.swVX += 0.034;
        this.swVZ -= 0.02;
        this.swingKicked = true;
      }
      if (this.height > D.clawHomeY - 0.015) this.swingKicked = false;
    }

    this.hOff = THREE.MathUtils.clamp(this.hOff, -0.026, 0.026);
    this.hVis = this.height + this.hOff;

    const lo = D.clawDropY - 0.008;
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

      if (!this.closedTug && prev > 0.5 && this.gripCmd <= 0.5) {
        this.hOffV += 0.055;
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

  private updateAimCue(dt: number, headX: number, headZ: number, activelyAiming: boolean) {
    // Find surface height directly below the claw tips (capsule pile or floor)
    let surfaceY = D.playfield.y + 0.004;
    let overPrize = false;
    let overAny = false;
    for (const ref of this.refs.values()) {
      if (ref.collected || ref === this.grabbed) continue;
      const t = ref.body.translation();
      const d = Math.hypot(t.x - headX, t.z - headZ);
      if (d < D.capsuleR * 1.15) {
        const top = t.y + Math.sqrt(Math.max(0, (D.capsuleR * 1.15) ** 2 - d * d)) + 0.004;
        if (top > surfaceY) surfaceY = top;
      }
      if (d < D.grabRadius * 0.78) {
        overAny = true;
        if (ref.projectId) overPrize = true;
      }
    }

    const tipY = this.hVis + D.grabTipOffset;
    const heightAbove = Math.max(0, tipY - surfaceY);
    const shadowScale = THREE.MathUtils.clamp(0.72 + heightAbove * 1.4, 0.72, 1.35);

    this.aimShadow.position.set(headX, surfaceY + 0.002, headZ);
    this.aimShadow.scale.setScalar(shadowScale);
    (this.aimShadow.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(
      0.55 - heightAbove * 0.75,
      0.2,
      0.52
    );

    const movingPlanar = activelyAiming || Math.hypot(this.vx, this.vz) > 0.035;
    const wantRing = movingPlanar && !this.grabbed ? 1 : 0;
    this.aimFade += (wantRing - this.aimFade) * Math.min(1, (dt || 0.016) * 10);

    this.aimRing.position.set(headX, surfaceY + 0.005, headZ);
    const pulse = 1 + Math.sin(this.clock * 7) * 0.04;
    const ringScale = (overPrize ? 0.92 : overAny ? 1.0 : 1.08) * pulse;
    this.aimRing.scale.setScalar(ringScale);
    this.aimRingMat.color.set(overPrize ? '#ff4da6' : overAny ? '#5ef2ff' : '#e6f6ff');
    this.aimRingMat.opacity = this.aimFade * (overPrize ? 0.85 : 0.62);
    this.aimRing.visible = this.aimFade > 0.01;
  }

  private applyVisual(dt: number, activelyAiming: boolean) {
    const top = CABLE_TOP;
    const cableLen = Math.max(0.014, top - (this.hVis + HEAD_TOP * S));
    const swingLever = cableLen + 0.3;

    const headX = this.pos.x + Math.sin(this.swX) * swingLever;
    const headZ = this.pos.y + Math.sin(this.swZ) * swingLever;

    this.head.position.set(headX, this.hVis, headZ);
    this.head.rotation.z = this.swX * M.tiltGain + this.leanZ;
    this.head.rotation.x = -this.swZ * M.tiltGain + this.leanX;

    this.body.setNextKinematicTranslation({ x: headX, y: this.hVis, z: headZ });

    // Fingers + diagonal linkage struts + articulated kinematic prong-tip colliders.
    // Only engage tip colliders while descending open into the pile; keep parked during
    // grab/lift/carry/release so released prizes always fall cleanly into the chute!
    const tipsActive =
      !this.grabbed &&
      this.sinceRelease > 0.75 &&
      this.height < D.clawHomeY - 0.03 &&
      this.fingerG[0] > 0.65;
    const prongParkY = tipsActive ? null : D.clawHomeY + 0.45;
    for (let i = 0; i < this.fingers.length; i++) {
      const f = this.fingers[i];
      const g = this.fingerG[i];
      const a = -THREE.MathUtils.lerp(A_CLOSED, A_OPEN, g);
      const c = THREE.MathUtils.lerp(C_CLOSED, C_OPEN, g);
      f.upper.rotation.x = a;
      f.lower.rotation.x = c;

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

      // Update kinematic prong tip collider in world space (parked cleanly while holding a grabbed capsule
      // so prong tips never fight the soft-servo joint, active during descent/open nudge!)
      if (prongParkY !== null) {
        f.tipBody.setNextKinematicTranslation({ x: headX, y: prongParkY, z: headZ });
      } else {
        const lowerAng = a + c;
        const tipR = (kz - L2 * Math.sin(lowerAng) + 0.008) * S;
        const tipLocalY = (ky - L2 * Math.cos(lowerAng)) * S;
        f.tipBody.setNextKinematicTranslation({
          x: headX + sx * tipR,
          y: this.hVis + tipLocalY,
          z: headZ + cz * tipR,
        });
      }
    }

    this.bridge.position.x = this.pos.x;
    this.carriage.position.set(this.pos.x, CARRIAGE_Y, this.pos.y);
    this.carriage.rotation.z = -this.swX * 0.16;
    this.carriage.rotation.x = this.swZ * 0.16;

    // Telescoping chrome shaft
    const bottom = this.hVis + HEAD_TOP * S;
    const anchorX = this.pos.x + Math.sin(this.swX) * cableLen;
    const anchorZ = this.pos.y + Math.sin(this.swZ) * cableLen;
    cableDir.set(anchorX - this.pos.x, bottom - top, anchorZ - this.pos.y);
    const len = Math.max(0.014, cableDir.length());
    this.cable.scale.set(1, len, 1);
    this.cable.position.set(this.pos.x, top, this.pos.y);
    this.cable.quaternion.setFromUnitVectors(UP, cableDir.clone().normalize());

    this.sleeve.position.set(this.pos.x, top - 0.013, this.pos.y);

    // Black coiled cord curving neatly down left side of shaft
    const coilTopX = this.pos.x - 0.052;
    const coilTopY = CARRIAGE_Y - 0.028;
    const coilTopZ = this.pos.y;
    const coilBotX = headX - 0.022 * S;
    const coilBotY = this.hVis - 0.048 * S;
    const coilBotZ = headZ;
    coilDir.set(coilBotX - coilTopX, coilBotY - coilTopY, coilBotZ - coilTopZ);
    const coilLen = Math.max(0.02, coilDir.length());
    if (Math.abs(coilLen - this.coilBuilt) > 0.006) {
      this.coil.geometry.dispose();
      this.coil.geometry = makeCoiledCableGeo(coilLen);
      this.coilBuilt = coilLen;
    }
    this.coil.position.set(coilTopX, coilTopY, coilTopZ);
    this.coil.quaternion.setFromUnitVectors(DOWN, coilDir.clone().normalize());

    this.updateAimCue(dt, headX, headZ, activelyAiming);
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
        if (Math.abs(t.y - tipY) > 0.115) return true;
        hits.push({ ref, d: Math.hypot(t.x - this.pos.x, t.z - this.pos.y) });
        return true;
      }
    );

    if (!hits.length) return false;
    hits.sort((a, b) => a.d - b.d);
    const best = hits[0];
    if (grabScore(best.d, 0) < GRAB_THRESHOLD) return false;

    const t = best.ref.body.translation();
    // Anchor gently inside the claw pocket (centred under the hub at grabTipOffset + 0.025)
    const jd = RAPIER.JointData.fixed(
      {
        x: THREE.MathUtils.clamp(t.x - this.pos.x, -0.025, 0.025),
        y: THREE.MathUtils.clamp(t.y - this.height, D.grabTipOffset - 0.015, D.grabTipOffset + 0.05),
        z: THREE.MathUtils.clamp(t.z - this.pos.y, -0.025, 0.025),
      },
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
