import RAPIER from '@dimforge/rapier3d-compat';
import type { Spot } from '../game/layout';

export async function initPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  return world;
}

export function addPlayfield(world: RAPIER.World, w: number, d: number, y: number, chuteX: number) {
  const hw = w / 2;
  const hd = d / 2;
  const gapW = 0.2;
  const gapD = 0.2;
  const gx0 = chuteX - gapW / 2;
  const gx1 = chuteX + gapW / 2;
  const gz0 = -gapD / 2;
  const gz1 = gapD / 2;

  const slab = (cx: number, cz: number, hx: number, hz: number, cy = y - 0.01) => {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, 0.01, hz).setFriction(1), b);
  };

  slab((gx1 + hw) / 2, 0, (hw - gx1) / 2, hd);
  slab((gx0 + gx1) / 2, (gz1 + hd) / 2, gapW / 2, (hd - gz1) / 2);
  slab((gx0 + gx1) / 2, (gz0 - hd) / 2, gapW / 2, (hd + gz0) / 2);

  const wall = (cx: number, cz: number, hx: number, hz: number, cy = y + 0.3, hy = 0.3) => {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.6), b);
  };
  wall(0, hd + 0.01, hw, 0.01);
  wall(0, -hd - 0.01, hw, 0.01);
  wall(-hw - 0.01, 0, 0.01, hd);
  wall(hw + 0.01, 0, 0.01, hd);

  const rim = (cx: number, cz: number, hx: number, hz: number) => {
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(cx, y + 0.045, cz));
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, 0.045, hz).setFriction(0.6), b);
  };
  rim(gx1 + 0.01, 0, 0.01, gapD / 2 + 0.02);
  rim(chuteX, gz1 + 0.01, gapW / 2 + 0.02, 0.01);
  rim(chuteX, gz0 - 0.01, gapW / 2 + 0.02, 0.01);

  wall(gx1 + 0.005, 0, 0.005, gapD / 2, y - 0.16, 0.16);
  wall(gx0 - 0.005, 0, 0.005, gapD / 2, y - 0.16, 0.16);
  wall(chuteX, gz1 + 0.005, gapW / 2, 0.005, y - 0.16, 0.16);
  wall(chuteX, gz0 - 0.005, gapW / 2, 0.005, y - 0.16, 0.16);

  const bottom = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(chuteX, y - 0.3, 0));
  world.createCollider(RAPIER.ColliderDesc.cuboid(gapW / 2, 0.01, gapD / 2).setFriction(0.9), bottom);

  return { hw, hd, chuteX };
}

export function addCapsule(world: RAPIER.World, spot: Spot, r: number) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spot.x, spot.y, spot.z)
      .setLinearDamping(0.35)
      .setAngularDamping(0.55)
      .setCcdEnabled(true)
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.ball(r).setDensity(120).setFriction(1.1).setRestitution(0.04),
    body
  );
  return { body, collider };
}
