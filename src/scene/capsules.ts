import * as THREE from 'three';
import type { CapsuleOptions } from '../contracts';
import { makeToy } from './toys';

function labelTexture(text: string, color: string) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ffffff';
  g.font = '800 54px Inter, Helvetica, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text.toUpperCase().slice(0, 10), 128, 66, 232);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const halfLower = (r: number) => new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const halfUpper = (r: number) =>
  new THREE.SphereGeometry(r * 0.995, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);

/** Capsule "riempitive" tutte in 4 draw call. */
export class CapsuleField {
  readonly group = new THREE.Group();
  private lower: THREE.InstancedMesh;
  private upper: THREE.InstancedMesh;
  private ring: THREE.InstancedMesh;
  private inner: THREE.InstancedMesh;
  private count: number;

  constructor(count: number, radius: number) {
    this.count = count;
    const r = radius;

    this.lower = new THREE.InstancedMesh(
      halfLower(r),
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0.18,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.1,
      }),
      count
    );
    this.upper = new THREE.InstancedMesh(
      halfUpper(r),
      new THREE.MeshPhysicalMaterial({
        color: '#ffffff',
        roughness: 0.05,
        metalness: 0,
        transmission: 0.85,
        thickness: 0.004,
        ior: 1.45,
        transparent: true,
        side: THREE.DoubleSide,
        envMapIntensity: 1.25,
      }),
      count
    );
    const ringGeo = new THREE.TorusGeometry(r * 0.985, r * 0.055, 6, 22);
    ringGeo.rotateX(Math.PI / 2);
    this.ring = new THREE.InstancedMesh(
      ringGeo,
      new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, clearcoat: 1 }),
      count
    );
    this.inner = new THREE.InstancedMesh(
      new THREE.SphereGeometry(r * 0.42, 10, 8),
      new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.05 }),
      count
    );

    this.lower.castShadow = true;
    this.lower.receiveShadow = true;
    this.group.add(this.lower, this.upper, this.ring, this.inner);

    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < count; i++) {
      this.lower.setMatrixAt(i, zero);
      this.upper.setMatrixAt(i, zero);
      this.ring.setMatrixAt(i, zero);
      this.inner.setMatrixAt(i, zero);
    }
    this.commit();
  }

  setColor(index: number, color: string) {
    this.lower.setColorAt(index, new THREE.Color(color));
    this.inner.setColorAt(index, new THREE.Color(color).offsetHSL(0, -0.1, 0.18));
    if (this.lower.instanceColor) this.lower.instanceColor.needsUpdate = true;
    if (this.inner.instanceColor) this.inner.instanceColor.needsUpdate = true;
  }

  setMatrix(index: number, m: THREE.Matrix4) {
    this.lower.setMatrixAt(index, m);
    this.upper.setMatrixAt(index, m);
    this.ring.setMatrixAt(index, m);
    this.inner.setMatrixAt(index, m);
  }

  hide(index: number) {
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.setMatrix(index, zero);
    this.commit();
  }

  commit() {
    this.lower.instanceMatrix.needsUpdate = true;
    this.upper.instanceMatrix.needsUpdate = true;
    this.ring.instanceMatrix.needsUpdate = true;
    this.inner.instanceMatrix.needsUpdate = true;
  }
}

/** Capsula premio, con giocattolo e etichetta del progetto. */
export function makeCapsule(opts: CapsuleOptions): THREE.Group {
  const { project, radius, tint } = opts;
  const g = new THREE.Group();
  const color = tint ?? project?.color ?? '#f0b6cd';
  const r = radius;

  const lower = new THREE.Mesh(
    halfLower(r),
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.18,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.1,
    })
  );
  lower.castShadow = true;
  g.add(lower);

  const upper = new THREE.Mesh(
    halfUpper(r),
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      roughness: 0.05,
      metalness: 0,
      transmission: 0.85,
      thickness: 0.004,
      ior: 1.45,
      transparent: true,
      side: THREE.DoubleSide,
      envMapIntensity: 1.25,
    })
  );
  g.add(upper);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.985, r * 0.055, 8, 28),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.3, clearcoat: 1 })
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  const toy = makeToy(project?.toy ?? 'charm', project?.color ?? '#ffd0e0');
  toy.scale.setScalar(0.82);
  toy.position.y = -0.006;
  g.add(toy);

  if (project) {
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 1.05, r * 0.5),
      new THREE.MeshBasicMaterial({ map: labelTexture(project.title, project.color), transparent: true })
    );
    label.position.set(0, 0.004, r * 0.93);
    g.add(label);
  }

  g.userData.projectId = project?.id ?? null;
  return g;
}
