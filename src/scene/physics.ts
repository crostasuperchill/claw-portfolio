import RAPIER from '@dimforge/rapier3d-compat';
import { CHUTE_GAP, type Spot } from '../game/layout';
import {
  GRAB_ACCEL_TAU,
  GRAB_FOLLOW_TAU,
  GRAB_MAX_ACCEL,
  GRAB_MAX_SPEED,
  GRAB_SOFT_RAMP,
} from '../game/grab';

/* ------------------------------------------------------------------------ *
 * Parametri delle capsule
 *
 * Una capsula gacha vuota da 7,5 cm pesa ~20 g: la massa è proporzionale al
 * volume (densità ~11,3 kg/m³). La plastica è poco rimbalzosa e scorre:
 * restitution 0.14, friction 0.55, damping 0.35/0.55. Il contact skin di
 * 2 mm impedisce compenetrazioni visibili anche a riposo.
 * ------------------------------------------------------------------------ */
const REFERENCE_RADIUS = 0.075;
const REFERENCE_MASS = 0.02; // kg
const CAPSULE_DENSITY = REFERENCE_MASS / ((4 / 3) * Math.PI * REFERENCE_RADIUS ** 3);

const CAPSULE_FRICTION = 0.55;
const CAPSULE_RESTITUTION = 0.14;
const CAPSULE_LINEAR_DAMPING = 0.35;
const CAPSULE_ANGULAR_DAMPING = 0.52;
const CONTACT_SKIN = 0.002;

const FLOOR_FRICTION = 0.55;
const FLOOR_RESTITUTION = 0.02;
const WALL_FRICTION = 0.4;
const CHUTE_FRICTION = 0.9;
const CHUTE_RESTITUTION = 0;

/** 10 iterazioni: pila stabile, zero compenetrazioni e sleep rapido. */
const SOLVER_ITERATIONS = 10;

/** Altezza fisica del divisorio dello chute: allineata al box acrilico visivo (0.19 m). */
export const CHUTE_WALL_HEIGHT = 0.19;

type TrackedCapsule = { body: RAPIER.RigidBody; collider: RAPIER.Collider; radius: number };
type Vec = { x: number; y: number; z: number };

const tracked: TrackedCapsule[] = [];
const field = { y: 0, chuteX: 0, gap: CHUTE_GAP };
let simTime = 0;
let lost = 0;

function quatRotate(q: RAPIER.Rotation, v: Vec): Vec {
  const { x, y, z, w } = q;
  const ix = w * v.x + y * v.z - z * v.y;
  const iy = w * v.y + z * v.x - x * v.z;
  const iz = w * v.z + x * v.y - y * v.x;
  const iw = -x * v.x - y * v.y - z * v.z;
  return {
    x: ix * w + iw * -x + iy * -z - iz * -y,
    y: iy * w + iw * -y + iz * -x - ix * -z,
    z: iz * w + iw * -z + ix * -y - iy * -x,
  };
}

export async function initPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  world.numSolverIterations = SOLVER_ITERATIONS;

  type GrabLink = {
    parent: RAPIER.RigidBody;
    child: RAPIER.RigidBody;
    anchor1: Vec;
    anchor2: Vec;
    age: number;
    prev: Vec;
  };
  const grabs = new Map<number, GrabLink>();

  const targetOf = (link: GrabLink): Vec => {
    const p = link.parent.translation();
    const a = quatRotate(link.parent.rotation(), link.anchor1);
    const c = link.child.rotation();
    const b = quatRotate(c, link.anchor2);
    return { x: p.x + a.x - b.x, y: p.y + a.y - b.y, z: p.z + a.z - b.z };
  };

  const follow = (link: GrabLink, dt: number) => {
    const body = link.child;
    const m = body.mass();
    if (!(m > 0) || !Number.isFinite(m)) return;

    const target = targetOf(link);
    let vtx = (target.x - link.prev.x) / dt;
    let vty = (target.y - link.prev.y) / dt;
    let vtz = (target.z - link.prev.z) / dt;
    const vtLen = Math.hypot(vtx, vty, vtz);
    if (vtLen > 3.5) {
      const s = 3.5 / vtLen;
      vtx *= s;
      vty *= s;
      vtz *= s;
    }
    link.prev = target;
    link.age += dt;

    const p = body.translation();
    const v = body.linvel();

    let dx = (target.x - p.x) / (GRAB_FOLLOW_TAU * 0.85);
    let dy = (target.y - p.y) / (GRAB_FOLLOW_TAU * 0.85);
    let dz = (target.z - p.z) / (GRAB_FOLLOW_TAU * 0.85);
    const dLen = Math.hypot(dx, dy, dz);
    if (dLen > GRAB_MAX_SPEED * 1.25) {
      const s = (GRAB_MAX_SPEED * 1.25) / dLen;
      dx *= s;
      dy *= s;
      dz *= s;
    }
    dx += vtx;
    dy += vty;
    dz += vtz;

    let ax = (dx - v.x) / GRAB_ACCEL_TAU;
    let ay = (dy - v.y) / GRAB_ACCEL_TAU;
    let az = (dz - v.z) / GRAB_ACCEL_TAU;
    const ramp = Math.min(1, link.age / Math.max(GRAB_SOFT_RAMP * 0.75, 1e-3));
    const aMax = GRAB_MAX_ACCEL * 1.35 * ramp;
    const aLen = Math.hypot(ax, ay, az);
    if (aLen > aMax) {
      const s = aMax / Math.max(aLen, 1e-9);
      ax *= s;
      ay *= s;
      az *= s;
    }

    body.applyImpulse(
      { x: ax * m * dt, y: (ay + 9.81) * m * dt, z: az * m * dt },
      true
    );
  };

  const step = world.step.bind(world);
  world.step = (eventQueue?: RAPIER.EventQueue, hooks?: RAPIER.PhysicsHooks) => {
    simTime += world.timestep;
    for (const link of grabs.values()) follow(link, world.timestep);
    step(eventQueue, hooks);
  };

  const removeBody = world.removeRigidBody.bind(world);
  world.removeRigidBody = (body: RAPIER.RigidBody) => {
    const i = tracked.findIndex((c) => c.body.handle === body.handle);
    if (i >= 0) {
      tracked.splice(i, 1);
      lost++;
    }
    for (const [handle, link] of grabs) {
      if (link.child.handle === body.handle) grabs.delete(handle);
    }
    removeBody(body);
  };

  const createJoint = world.createImpulseJoint.bind(world);
  world.createImpulseJoint = (
    params: RAPIER.JointData,
    parent1: RAPIER.RigidBody,
    parent2: RAPIER.RigidBody,
    wakeUp: boolean
  ) => {
    const softClawGrab =
      params.jointType === RAPIER.JointType.Fixed &&
      parent1.isKinematic() &&
      parent2.isDynamic();
    if (!softClawGrab) return createJoint(params, parent1, parent2, wakeUp);

    const handle = createJoint(
      RAPIER.JointData.rope(10, params.anchor1, params.anchor2),
      parent1,
      parent2,
      wakeUp
    );
    const link: GrabLink = {
      parent: parent1,
      child: parent2,
      anchor1: { x: params.anchor1.x, y: params.anchor1.y, z: params.anchor1.z },
      anchor2: { x: params.anchor2.x, y: params.anchor2.y, z: params.anchor2.z },
      age: 0,
      prev: { x: 0, y: 0, z: 0 },
    };
    link.prev = targetOf(link);
    grabs.set(handle.handle, link);
    return handle;
  };

  const removeJoint = world.removeImpulseJoint.bind(world);
  world.removeImpulseJoint = (joint: RAPIER.ImpulseJoint, wakeUp: boolean) => {
    grabs.delete(joint.handle);
    removeJoint(joint, wakeUp);
  };

  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__physics = {
      time: () => simTime,
      capsules: () =>
        tracked.map(({ body, collider, radius }) => {
          const t = body.translation();
          const v = body.linvel();
          const w = body.angvel();
          return {
            x: t.x,
            y: t.y,
            z: t.z,
            vx: v.x,
            vy: v.y,
            vz: v.z,
            wx: w.x,
            wy: w.y,
            wz: w.z,
            sleeping: body.isSleeping(),
            radius,
            handle: collider.handle,
          };
        }),
      penetration: () => {
        let pair = 0;
        let floor = 0;
        for (let i = 0; i < tracked.length; i++) {
          const a = tracked[i];
          const p = a.body.translation();
          for (let j = i + 1; j < tracked.length; j++) {
            const q = tracked[j].body.translation();
            const d = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
            pair = Math.max(pair, a.radius + tracked[j].radius - d);
          }
          const overGap =
            Math.abs(p.x - field.chuteX) < field.gap / 2 &&
            Math.abs(p.z) < field.gap / 2;
          if (!overGap && p.y > field.y - 0.2) {
            floor = Math.max(floor, a.radius - (p.y - field.y));
          }
        }
        return { pair: Math.max(0, pair), floor: Math.max(0, floor) };
      },
      fallen: () =>
        tracked.filter(({ body }) => body.translation().y < field.y - 0.08).length,
      lost: () => lost,
      sleeping: () => tracked.filter(({ body }) => body.isSleeping()).length,
      total: () => tracked.length,
    };
  }

  return world;
}

export function addPlayfield(world: RAPIER.World, w: number, d: number, y: number, chuteX: number) {
  const hw = w / 2;
  const hd = d / 2;
  const gapW = CHUTE_GAP;
  const gapD = CHUTE_GAP;
  field.y = y;
  field.chuteX = chuteX;
  field.gap = gapW;

  const gx0 = chuteX - gapW / 2;
  const gx1 = chuteX + gapW / 2;
  const gz0 = -gapD / 2;
  const gz1 = gapD / 2;

  const slab = (cx: number, cz: number, hx: number, hz: number, cy = y - 0.01) => {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, 0.01, hz)
        .setFriction(FLOOR_FRICTION)
        .setRestitution(FLOOR_RESTITUTION),
      b
    );
  };

  slab((gx1 + hw) / 2, 0, (hw - gx1) / 2, hd);
  slab((gx0 + gx1) / 2, (gz1 + hd) / 2, gapW / 2, (hd - gz1) / 2);
  slab((gx0 + gx1) / 2, (gz0 - hd) / 2, gapW / 2, (hd + gz0) / 2);

  const wall = (cx: number, cz: number, hx: number, hz: number, cy = y + 0.3, hy = 0.3) => {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setFriction(WALL_FRICTION)
        .setRestitution(FLOOR_RESTITUTION),
      b
    );
  };
  wall(0, hd + 0.01, hw, 0.01);
  wall(0, -hd - 0.01, hw, 0.01);
  wall(-hw - 0.01, 0, 0.01, hd);
  wall(hw + 0.01, 0, 0.01, hd);

  // Divisorio acrilico alto 0.19 m attorno allo chute: impedisce alle capsule della pila
  // di rotolare dentro il pozzo di consegna, combaciando con la teca visiva di cabinet.ts.
  const rimHy = CHUTE_WALL_HEIGHT / 2;
  const rim = (cx: number, cz: number, hx: number, hz: number) => {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, y + rimHy, cz));
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, rimHy, hz)
        .setFriction(CAPSULE_FRICTION)
        .setRestitution(FLOOR_RESTITUTION),
      b
    );
  };
  rim(gx1 + 0.008, 0, 0.008, gapD / 2 + 0.016);
  rim(chuteX, gz1 + 0.008, gapW / 2 + 0.016, 0.008);
  rim(chuteX, gz0 - 0.008, gapW / 2 + 0.016, 0.008);

  // Pareti interne del pozzo di caduta.
  wall(gx1 + 0.005, 0, 0.005, gapD / 2, y - 0.16, 0.16);
  wall(gx0 - 0.005, 0, 0.005, gapD / 2, y - 0.16, 0.16);
  wall(chuteX, gz1 + 0.005, gapW / 2, 0.005, y - 0.16, 0.16);
  wall(chuteX, gz0 - 0.005, gapW / 2, 0.005, y - 0.16, 0.16);

  // Fondo dello chute.
  const bottom = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(chuteX, y - 0.3, 0));
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(gapW / 2, 0.01, gapD / 2)
      .setFriction(CHUTE_FRICTION)
      .setRestitution(CHUTE_RESTITUTION),
    bottom
  );

  return { hw, hd, chuteX };
}

export function addCapsule(world: RAPIER.World, spot: Spot, r: number) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spot.x, spot.y, spot.z)
      .setLinearDamping(CAPSULE_LINEAR_DAMPING)
      .setAngularDamping(CAPSULE_ANGULAR_DAMPING)
      .setCcdEnabled(true)
      .setCanSleep(true)
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.ball(r)
      .setDensity(CAPSULE_DENSITY)
      .setFriction(CAPSULE_FRICTION)
      .setRestitution(CAPSULE_RESTITUTION)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setContactSkin(CONTACT_SKIN),
    body
  );
  tracked.push({ body, collider, radius: r });
  return { body, collider };
}
