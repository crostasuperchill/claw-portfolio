import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Toy } from '../game/roster';
import { chrome, glow, matte, plastic } from './materials';

export function makeToy(kind: Toy, color: string): THREE.Group {
  const g = new THREE.Group();
  const shell = plastic(color, { roughness: 0.28 });

  if (kind === 'pocketpet') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 16), shell);
    body.scale.set(1, 1.18, 0.8);
    g.add(body);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.026), glow('#9ff2c9', 1.2));
    screen.position.set(0, 0.006, 0.026);
    g.add(screen);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.003, 10), chrome());
      b.rotation.x = Math.PI / 2;
      b.position.set(-0.012 + i * 0.012, -0.018, 0.024);
      g.add(b);
    }
  } else if (kind === 'handheld') {
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.062, 0.09, 0.014, 3, 0.008), shell);
    g.add(body);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.035), glow('#7fd0ff', 0.8));
    screen.position.set(0, 0.014, 0.0075);
    g.add(screen);
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.003, 10), matte('#222'));
      b.rotation.x = Math.PI / 2;
      b.position.set(0.014 + i * 0.012, -0.026, 0.0075);
      g.add(b);
    }
  } else if (kind === 'floppy') {
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.075, 0.004, 2, 0.003), plastic('#2a2d33'));
    g.add(body);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.04), matte('#f4f1e8'));
    label.position.set(0, 0.006, 0.0025);
    g.add(label);
    const shutter = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.03), chrome());
    shutter.position.set(0.014, 0.006, 0.003);
    g.add(shutter);
  } else if (kind === 'charm') {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.026, 0.009, 12, 28),
      new THREE.MeshPhysicalMaterial({
        color,
        transmission: 0.6,
        thickness: 0.01,
        roughness: 0.06,
        metalness: 0,
        ior: 1.49,
        transparent: true,
      })
    );
    g.add(ring);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.012, 0), glow(color, 0.7));
    star.position.y = 0.034;
    g.add(star);
  } else if (kind === 'cartridge') {
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.075, 0.016, 2, 0.006), shell);
    g.add(body);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.045), matte('#f7f4ea'));
    label.position.set(0, 0.004, 0.0085);
    g.add(label);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.008), matte('#1a1a1a'));
    slot.position.set(0, -0.03, 0.0085);
    g.add(slot);
  } else {
    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.03, 1),
      new THREE.MeshPhysicalMaterial({ color: '#121216', roughness: 0.08, metalness: 0.2, clearcoat: 1 })
    );
    g.add(ball);
    for (let i = 0; i < 5; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 6), glow(color, 1.4));
      const a = (i / 5) * Math.PI * 2;
      dot.position.set(Math.cos(a) * 0.024, Math.sin(a * 1.7) * 0.018, Math.sin(a) * 0.024);
      g.add(dot);
    }
  }

  return g;
}
