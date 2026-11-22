import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { D } from './dims';
import { chrome, matte } from './materials';
import { GRAB_THRESHOLD, grabScore } from '../game/grab';
import type { BodyRef } from '../contracts';

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
  private fingers: THREE.Group[] = [];
  private bridge: THREE.Mesh;
  private carriage: THREE.Mesh;
  private cable: THREE.Mesh;

  constructor(private world: RAPIER.World, private refs: Map<number, BodyRef>) {
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, D.clawHomeY, 0)
    );
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.05 * D.clawScale, 0.085 * D.clawScale).setFriction(0.7), this.body);

    // rotaie
    const railMat = matte('#c9ccd2');
    for (const z of [-0.36, 0.36]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.016, 0.016), railMat);
      rail.position.set(0, 1.305, z);
      this.root.add(rail);
    }

    this.bridge = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.026, 0.03), matte('#dfe2e7'));
    this.bridge.position.set(0, 1.3, 0);
    this.root.add(this.bridge);

    this.carriage = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.055), matte('#b9bdc4'));
    this.carriage.position.set(0, 1.3, 0);
    this.root.add(this.carriage);

    const cableMat = matte('#3a3a3a');
    this.cable = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 6), cableMat);
    this.cable.position.y = 1.25;
    this.root.add(this.cable);

    // testa
    const headMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.075, 20), chrome());
    headMesh.castShadow = true;
    this.head.add(headMesh);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.05, 12), chrome());
    neck.position.y = 0.06;
    this.head.add(neck);

    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const finger = new THREE.Group();
      finger.rotation.y = angle;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, 0.012), chrome());
      mesh.position.set(0, -0.055, 0.052);
      mesh.castShadow = true;
      finger.add(mesh);
      this.fingers.push(finger);
      this.head.add(finger);
    }
    this.root.add(this.head);
    this.head.scale.setScalar(D.clawScale);
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

    const spread = 0.1 + this.grip * 0.42;
    for (const f of this.fingers) {
      const mesh = f.children[0] as THREE.Mesh;
      mesh.rotation.x = -spread;
    }

    this.bridge.position.x = this.pos.x;
    this.bridge.position.z = this.pos.y;
    this.carriage.position.set(this.pos.x, 1.3, this.pos.y);

    const top = 1.28;
    const bottom = this.height + 0.06;
    const len = Math.max(0.02, top - bottom);
    this.cable.scale.y = len;
    this.cable.position.set(this.pos.x, bottom + len / 2, this.pos.y);
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
