import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Toy } from '../game/roster';
import { chrome, glow, plastic } from './materials';

/** Canvas helper: sRGB texture from a 2D drawing pass. */
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function screenMat(map: THREE.Texture) {
  return new THREE.MeshStandardMaterial({
    map,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: map,
    emissiveIntensity: 1.05,
    roughness: 0.16,
    metalness: 0,
  });
}

function pocketScreen() {
  return canvasTex(64, 64, (g) => {
    g.fillStyle = '#cdeedb';
    g.fillRect(0, 0, 64, 64);
    const px = (x: number, y: number, w: number, h: number, c: string) => {
      g.fillStyle = c;
      g.fillRect(x, y, w, h);
    };
    // pixel pet: ears, head, body
    const ink = '#20362b';
    px(17, 20, 30, 22, ink);
    px(14, 14, 8, 8, ink);
    px(42, 14, 8, 8, ink);
    px(17, 24, 30, 14, '#eaf9f0');
    px(18, 26, 4, 4, ink);
    px(42, 26, 4, 4, ink);
    px(30, 32, 4, 3, ink);
    px(26, 37, 12, 3, ink);
    px(24, 42, 16, 14, ink);
    px(27, 45, 10, 8, '#eaf9f0');
    px(8, 8, 6, 6, '#ff5f7e');
    px(13, 8, 6, 6, '#ff5f7e');
    px(10, 13, 8, 5, '#ff5f7e');
    px(6, 58, 52, 2, '#9fd3b5');
  });
}

function handheldScreen() {
  return canvasTex(96, 72, (g) => {
    const sky = g.createLinearGradient(0, 0, 0, 54);
    sky.addColorStop(0, '#59b7ff');
    sky.addColorStop(1, '#c9ecff');
    g.fillStyle = sky;
    g.fillRect(0, 0, 96, 72);
    g.fillStyle = '#ffe15c';
    g.beginPath();
    g.arc(77, 14, 8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.fillRect(8, 12, 14, 5);
    g.fillRect(12, 9, 6, 5);
    g.fillStyle = '#46a95b';
    g.fillRect(0, 52, 96, 20);
    g.fillStyle = '#3a8f4c';
    g.beginPath();
    g.arc(20, 58, 20, Math.PI, 0);
    g.fill();
    // runner
    g.fillStyle = '#ffcf9e';
    g.fillRect(44, 37, 6, 6);
    g.fillStyle = '#2b2b3a';
    g.fillRect(43, 43, 8, 8);
    g.fillStyle = '#ff4f6d';
    g.fillRect(42, 44, 2, 5);
    g.fillRect(50, 44, 2, 5);
    g.fillStyle = '#2b2b3a';
    g.fillRect(44, 51, 2, 4);
    g.fillRect(48, 51, 2, 4);
    g.fillStyle = '#1b2b45';
    g.font = '700 7px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.fillText('1UP', 5, 8);
    g.fillText('0420', 5, 16);
    g.fillStyle = '#ff4f6d';
    for (let i = 0; i < 3; i++) g.fillRect(62 + i * 9, 5, 5, 5);
  });
}

function floppyLabel(color: string) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#f4eedd';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#d9d0bb';
    g.lineWidth = 6;
    g.strokeRect(7, 7, 242, 242);
    g.fillStyle = color;
    g.fillRect(18, 18, 220, 46);
    g.fillStyle = '#ffffff';
    g.font = '800 24px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('DAVIDE', 30, 42);
    g.font = '800 18px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'right';
    g.fillText('HD', 224, 42);
    g.fillStyle = '#b9b09b';
    for (let i = 0; i < 3; i++) g.fillRect(30, 92 + i * 18, 196, 3);
    g.fillStyle = '#6f6858';
    g.font = '700 17px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.fillText('1.44 MB', 30, 160);
    g.fillText('IBM FORMAT', 30, 180);
    // barcode
    g.fillStyle = '#221f1a';
    let x = 30;
    const bars = [3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 3, 1, 2];
    bars.forEach((w, i) => {
      g.fillRect(x, 196, w, 34);
      x += w + (i % 2 ? 3 : 2);
    });
    g.fillStyle = color;
    g.beginPath();
    g.arc(214, 208, 17, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = '800 17px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.fillText('D', 214, 216);
  });
}

function cartLabel(color: string) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#f6f0df';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = color;
    g.fillRect(0, 0, 256, 150);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(0, 0, 256, 10);
    // pixel star badge
    g.fillStyle = '#fffdf5';
    g.font = '800 30px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('★', 128, 54);
    g.font = '800 34px "Helvetica Neue", Arial, sans-serif';
    g.fillText('PLAY', 128, 108);
    g.fillStyle = '#2a241c';
    g.font = '800 22px "Helvetica Neue", Arial, sans-serif';
    g.fillText('8-BIT EDITION', 128, 190);
    g.fillStyle = '#b9af99';
    g.fillRect(36, 214, 184, 3);
    g.fillStyle = '#7b7362';
    g.font = '700 14px "Helvetica Neue", Arial, sans-serif';
    g.fillText('DAVIDE.FYI', 128, 234);
  });
}

function cartEdge() {
  return canvasTex(128, 32, (g) => {
    g.fillStyle = '#1c3a2a';
    g.fillRect(0, 0, 128, 32);
    g.fillStyle = '#d8b45a';
    for (let i = 0; i < 8; i++) g.fillRect(5 + i * 15, 9, 8, 14);
  });
}

function starShape(outer: number, inner: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

/** Prize miniature, sized to fit through the capsule mouth (6–8 cm). */
export function makeToy(kind: Toy, color: string): THREE.Group {
  const g = new THREE.Group();
  const shell = plastic(color, { roughness: 0.15, clearcoatRoughness: 0.03 });
  const dark = plastic('#1b1e24', { roughness: 0.2, clearcoatRoughness: 0.04 });

  if (kind === 'pocketpet') {
    // egg-shaped pocket pet
    const R = 0.0335;
    const H = 0.074;
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const r = R * Math.pow(Math.sin(Math.PI * t), 0.62) * (1 - 0.17 * t);
      pts.push(new THREE.Vector2(Math.max(r, 0.0004), (t - 0.5) * H));
    }
    const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 36), shell);
    body.castShadow = true;
    g.add(body);

    const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.038, 0.028, 0.014, 3, 0.005), dark);
    bezel.position.set(0, 0.001, 0.0225);
    g.add(bezel);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.0295, 0.0205), screenMat(pocketScreen()));
    screen.position.set(0, 0.001, 0.0299);
    g.add(screen);

    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.0038, 12, 8), chrome());
      b.scale.set(1, 1, 0.55);
      b.position.set(-0.011 + i * 0.011, -0.019, i === 1 ? 0.0255 : 0.0232);
      g.add(b);
    }

    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.0062, 0.0017, 8, 18), chrome());
    loop.position.set(0, 0.0385, 0);
    g.add(loop);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.006, 8), chrome());
    neck.position.set(0, 0.0345, 0);
    g.add(neck);
  } else if (kind === 'handheld') {
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.066, 0.094, 0.016, 4, 0.009), shell);
    body.castShadow = true;
    g.add(body);

    const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.044, 0.005, 3, 0.003), dark);
    bezel.position.set(0, 0.0145, 0.0095);
    g.add(bezel);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.043, 0.034), screenMat(handheldScreen()));
    screen.position.set(0, 0.015, 0.0122);
    g.add(screen);

    // power led
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0018, 8, 6), glow('#55ff9a', 2.4));
    led.position.set(-0.0255, 0.0368, 0.0092);
    g.add(led);

    // d-pad
    const dpadMat = plastic('#242830', { roughness: 0.28 });
    const dh = new THREE.Mesh(new RoundedBoxGeometry(0.021, 0.0078, 0.0038, 2, 0.002), dpadMat);
    dh.position.set(-0.0195, -0.0285, 0.0092);
    g.add(dh);
    const dv = new THREE.Mesh(new RoundedBoxGeometry(0.0078, 0.021, 0.0038, 2, 0.002), dpadMat);
    dv.position.set(-0.0195, -0.0285, 0.0092);
    g.add(dv);

    // A / B buttons
    const ba = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.004, 16),
      plastic('#e8384f', { roughness: 0.16 })
    );
    ba.rotation.x = Math.PI / 2;
    ba.position.set(0.0145, -0.0225, 0.0105);
    g.add(ba);
    const bb = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.004, 16),
      plastic('#ffc21a', { roughness: 0.16 })
    );
    bb.rotation.x = Math.PI / 2;
    bb.position.set(0.0275, -0.0315, 0.0105);
    g.add(bb);

    // start / select
    for (let i = 0; i < 2; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.003, 10), dark);
      s.rotation.x = Math.PI / 2;
      s.position.set(0.0035 + i * 0.008, -0.0385, 0.0092);
      g.add(s);
    }

    // speaker slots
    for (let i = 0; i < 4; i++) {
      const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.0016, 0.0075), dark);
      slot.position.set(0.0205 + i * 0.004, -0.0385, 0.0086);
      g.add(slot);
    }
  } else if (kind === 'floppy') {
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(0.076, 0.076, 0.005, 3, 0.0035),
      plastic('#26282d', { roughness: 0.34, clearcoat: 0.7, clearcoatRoughness: 0.12 })
    );
    body.castShadow = true;
    g.add(body);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.058, 0.05),
      new THREE.MeshStandardMaterial({ map: floppyLabel(color), roughness: 0.72, metalness: 0 })
    );
    label.position.set(0, -0.0105, 0.0028);
    g.add(label);

    const shutter = new THREE.Mesh(
      new RoundedBoxGeometry(0.028, 0.0215, 0.0018, 2, 0.0012),
      chrome()
    );
    shutter.position.set(0.012, 0.0272, 0.0029);
    g.add(shutter);
    const slot = new THREE.Mesh(new THREE.PlaneGeometry(0.013, 0.0042), dark);
    slot.position.set(0.0145, 0.0305, 0.004);
    g.add(slot);

    // write-protect notch
    const notch = new THREE.Mesh(new THREE.PlaneGeometry(0.006, 0.004), dark);
    notch.position.set(-0.031, -0.0335, 0.0027);
    g.add(notch);
  } else if (kind === 'charm') {
    // opaca di proposito: un materiale transmissivo verrebbe escluso
    // dal transmission buffer della calotta e sparirebbe dentro la capsula
    const acrylic = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.04,
      roughness: 0.055,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.6,
      iridescence: 0.55,
      iridescenceIOR: 1.3,
      iridescenceThicknessMinimum: 120,
      iridescenceThicknessMaximum: 380,
    });
    const starGeo = new THREE.ExtrudeGeometry(starShape(0.033, 0.0155), {
      depth: 0.005,
      bevelEnabled: true,
      bevelThickness: 0.0012,
      bevelSize: 0.0012,
      bevelSegments: 2,
      curveSegments: 2,
    });
    starGeo.center();
    const star = new THREE.Mesh(starGeo, acrylic);
    star.rotation.z = 0.05;
    g.add(star);

    const printGeo = new THREE.ShapeGeometry(starShape(0.0145, 0.0065));
    const print = new THREE.Mesh(
      printGeo,
      new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.4, metalness: 0 })
    );
    print.position.set(0, 0, 0.0042);
    print.rotation.z = 0.05;
    g.add(print);

    const jump = new THREE.Mesh(new THREE.TorusGeometry(0.0058, 0.0016, 8, 20), chrome());
    jump.position.set(0, 0.0305, 0);
    g.add(jump);
  } else if (kind === 'cartridge') {
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.076, 0.016, 3, 0.006), shell);
    body.castShadow = true;
    g.add(body);

    // top grip ridge
    const grip = new THREE.Mesh(
      new RoundedBoxGeometry(0.036, 0.006, 0.003, 2, 0.0015),
      plastic(color, { roughness: 0.25 })
    );
    grip.position.set(0, 0.0335, 0.0082);
    g.add(grip);

    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(0.056, 0.05),
      new THREE.MeshStandardMaterial({ map: cartLabel(color), roughness: 0.5, metalness: 0 })
    );
    label.position.set(0, 0.004, 0.0086);
    g.add(label);

    const edge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.052, 0.009),
      new THREE.MeshStandardMaterial({ map: cartEdge(), roughness: 0.4, metalness: 0.5 })
    );
    edge.position.set(0, -0.032, 0.0086);
    g.add(edge);
  } else {
    // oracle ball: glossy lacquer with emissive constellation
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.034, 36, 24),
      new THREE.MeshPhysicalMaterial({
        color: '#0a0a0e',
        roughness: 0.055,
        metalness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.025,
        envMapIntensity: 1.5,
      })
    );
    ball.castShadow = true;
    g.add(ball);

    const dots: THREE.BufferGeometry[] = [];
    const n = 9;
    const front = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const rad = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * 2.399963;
      const dir = new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad).normalize();
      const size = 0.0022 + (i % 3) * 0.00055;
      const dot = new THREE.CircleGeometry(size, 12);
      const q = new THREE.Quaternion().setFromUnitVectors(front, dir);
      const m = new THREE.Matrix4().compose(
        dir.clone().multiplyScalar(0.03405),
        q,
        new THREE.Vector3(1, 1, 1)
      );
      dot.applyMatrix4(m);
      dots.push(dot);
    }
    const dotMesh = new THREE.Mesh(
      mergeGeometries(dots, false)!,
      new THREE.MeshBasicMaterial({ color, toneMapped: false })
    );
    g.add(dotMesh);
  }

  return g;
}
