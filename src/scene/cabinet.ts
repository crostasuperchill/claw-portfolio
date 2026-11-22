import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { D } from './dims';
import { PALETTE, chrome, glow, matte, plastic } from './materials';
import { decalMesh } from './decals';
import type { UvRect } from '../contracts';

function marqueeTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 320;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, '#2b4bff');
  grad.addColorStop(1, '#1b2fbf');
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 320);

  g.fillStyle = '#ffffff';
  g.font = '800 132px Inter, Helvetica, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('DAVIDE', 512, 118);

  g.fillStyle = '#ffc21a';
  g.font = '700 46px Inter, Helvetica, Arial, sans-serif';
  g.letterSpacing = '14px';
  g.fillText('PRIZE CATCHER', 512, 216);

  g.fillStyle = 'rgba(255,255,255,.55)';
  g.font = '600 34px "Hiragino Sans", Inter, sans-serif';
  g.fillText('けんびき', 512, 278);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function glassMaterial() {
  const cheap = new URLSearchParams(location.search).has('notrans');
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.03,
    transmission: cheap ? 0 : 1,
    opacity: cheap ? 0.14 : 1,
    thickness: 0.012,
    ior: 1.46,
    transparent: true,
    side: THREE.DoubleSide,
    envMapIntensity: 1.2,
  });
}

export function buildCabinet(atlas: THREE.Texture, rects: Record<string, UvRect>) {
  const root = new THREE.Group();

  const pink = plastic(PALETTE.pink);
  const blue = plastic(PALETTE.blue, { roughness: 0.2 });
  const white = plastic(PALETTE.white, { roughness: 0.3, clearcoatRoughness: 0.12 });
  const dark = matte('#1d1b18');
  const glass = glassMaterial();

  // plinth
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.62, 0.78, 4, 0.045), white);
  plinth.position.y = 0.31;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  root.add(plinth);

  // pannello frontale rosa
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.46), pink);
  panel.position.set(0, 0.37, 0.392);
  root.add(panel);

  // bocca premio
  const chuteFrame = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.2, 0.03, 3, 0.03), blue);
  chuteFrame.position.set(-0.27, 0.34, 0.392);
  root.add(chuteFrame);
  const chuteHole = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.14), matte('#0d0d0f'));
  chuteHole.position.set(-0.27, 0.34, 0.405);
  root.add(chuteHole);
  const chuteGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), glow('#ffd7a1', 0.55));
  chuteGlow.position.set(-0.27, 0.325, 0.404);
  root.add(chuteGlow);

  // console che sporge dal frontale, sotto la vetrina
  const consoleBody = new THREE.Mesh(new RoundedBoxGeometry(0.99, 0.2, 0.3, 3, 0.03), white);
  consoleBody.position.set(0, 0.5, 0.45);
  consoleBody.castShadow = true;
  root.add(consoleBody);
  const consoleFace = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.16), pink);
  consoleFace.position.set(0, 0.505, 0.602);
  root.add(consoleFace);

  // deck
  const deck = new THREE.Group();
  deck.position.set(0, 0.585, 0.47);
  deck.rotation.x = -0.14;
  root.add(deck);

  const deckPanel = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.08, 0.34, 3, 0.035), white);
  deckPanel.castShadow = true;
  deckPanel.receiveShadow = true;
  deck.add(deckPanel);

  const deckTrim = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.03, 0.36, 3, 0.014), blue);
  deckTrim.position.y = -0.04;
  deck.add(deckTrim);

  // joystick
  const joyBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.02, 24), dark);
  joyBase.position.set(-0.3, 0.05, 0.03);
  deck.add(joyBase);
  const joyRod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.075, 12), chrome());
  joyRod.position.set(-0.3, 0.095, 0.03);
  deck.add(joyRod);
  const joyBall = new THREE.Mesh(new THREE.SphereGeometry(0.026, 24, 16), plastic(PALETTE.red, { roughness: 0.12 }));
  joyBall.position.set(-0.3, 0.135, 0.03);
  joyBall.castShadow = true;
  deck.add(joyBall);

  // bottone
  const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.06, 0.032, 32), glow(PALETTE.yellow, 0.35));
  btn.position.set(0.22, 0.062, 0.02);
  btn.castShadow = true;
  deck.add(btn);
  const btnRing = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.007, 10, 32), chrome());
  btnRing.rotation.x = Math.PI / 2;
  btnRing.position.set(0.22, 0.05, 0.02);
  deck.add(btnRing);
  const btnBase = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.072, 0.014, 28), plastic(PALETTE.yellow, { roughness: 0.35 }));
  btnBase.position.set(0.22, 0.044, 0.02);
  deck.add(btnBase);

  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const buttonHit = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.2), hitMat);
  buttonHit.position.set(0.22, 0.06, 0.02);
  deck.add(buttonHit);

  // camera di gioco
  const chamberBack = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.66), matte('#f4efe4'));
  chamberBack.position.set(0, 0.98, -0.375);
  chamberBack.receiveShadow = true;
  root.add(chamberBack);

  const sideL = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.7, 0.78, 3, 0.02), pink);
  sideL.position.set(-0.485, 0.99, 0);
  sideL.castShadow = true;
  root.add(sideL);
  const sideR = sideL.clone();
  sideR.position.x = 0.485;
  root.add(sideR);

  const topCap = new THREE.Mesh(new RoundedBoxGeometry(1.06, 0.06, 0.82, 3, 0.02), blue);
  topCap.position.y = 1.355;
  topCap.castShadow = true;
  root.add(topCap);

  const chamberFloor = new THREE.Mesh(new RoundedBoxGeometry(0.99, 0.03, 0.7, 3, 0.012), white);
  chamberFloor.position.y = 0.705;
  chamberFloor.receiveShadow = true;
  root.add(chamberFloor);

  // vetro
  const glassFront = new THREE.Mesh(new THREE.PlaneGeometry(0.93, 0.62), glass);
  glassFront.position.set(0, 1.03, 0.392);
  root.add(glassFront);

  // cornice del vetro: senza, la lastra sembra non esserci
  const frameMat = plastic(PALETTE.blue, { roughness: 0.24 });
  const railH = new THREE.BoxGeometry(1.0, 0.028, 0.05);
  const railV = new THREE.BoxGeometry(0.03, 0.62, 0.05);
  const railTop = new THREE.Mesh(railH, frameMat);
  railTop.position.set(0, 1.33, 0.395);
  root.add(railTop);
  const railBottom = new THREE.Mesh(railH, frameMat);
  railBottom.position.set(0, 0.724, 0.395);
  root.add(railBottom);
  for (const x of [-0.49, 0.49]) {
    const r = new THREE.Mesh(railV, frameMat);
    r.position.set(x, 1.03, 0.395);
    root.add(r);
  }

  // riflesso diagonale sul vetro: trucco classico da product shot
  const reflCanvas = document.createElement('canvas');
  reflCanvas.width = 512;
  reflCanvas.height = 128;
  const rg = reflCanvas.getContext('2d')!;
  const rgrad = rg.createLinearGradient(0, 0, 512, 128);
  rgrad.addColorStop(0, 'rgba(255,255,255,0)');
  rgrad.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  rgrad.addColorStop(1, 'rgba(255,255,255,0)');
  rg.fillStyle = rgrad;
  rg.fillRect(0, 0, 512, 128);
  const reflTex = new THREE.CanvasTexture(reflCanvas);
  reflTex.colorSpace = THREE.SRGBColorSpace;
  const reflection = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.22),
    new THREE.MeshBasicMaterial({
      map: reflTex,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  reflection.position.set(-0.04, 1.16, 0.397);
  reflection.rotation.z = 0.42;
  reflection.renderOrder = 3;
  root.add(reflection);

  const glassL = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.66), glass);
  glassL.position.set(-0.512, 0.99, 0);
  glassL.rotation.y = -Math.PI / 2;
  root.add(glassL);
  const glassR = glassL.clone();
  glassR.position.x = 0.512;
  glassR.rotation.y = Math.PI / 2;
  root.add(glassR);

  // LED
  const ledMat = glow('#fff3d6', 2.2);
  for (const x of [-0.45, 0.45]) {
    const led = new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.56, 4, 8), ledMat);
    led.position.set(x, 1.0, 0.33);
    root.add(led);
    const glowSprite = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.7),
      new THREE.MeshBasicMaterial({
        color: '#fff3d6',
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    glowSprite.position.set(x * 0.97, 1.0, 0.345);
    root.add(glowSprite);
  }

  // marquee
  const marquee = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.32, 0.12, 3, 0.03), blue);
  marquee.position.set(0, 1.53, 0.26);
  marquee.castShadow = true;
  root.add(marquee);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.94, 0.28),
    new THREE.MeshStandardMaterial({
      map: marqueeTexture(),
      emissive: new THREE.Color('#ffffff'),
      emissiveMap: marqueeTexture(),
      emissiveIntensity: 0.55,
      roughness: 0.5,
    })
  );
  face.position.set(0, 1.53, 0.322);
  root.add(face);

  // decal
  const decals: [string, number, number, number, number][] = [
    ['ゲット', 0.2, 0.09, -0.28, 0.5],
    ['CAUTION', 0.16, 0.07, 0.3, 0.5],
    ['プライズ', 0.18, 0.08, 0.08, 0.16],
    ['FRAGILE', 0.13, 0.055, 0.42, 0.16],
    ['けんびき', 0.16, 0.07, -0.4, 0.16],
    ['NO STEP', 0.12, 0.05, 0.0, 0.6],
  ];
  for (const [label, w, h, x, y] of decals) {
    const rect = rects[label];
    if (!rect) continue;
    const d = decalMesh(atlas, rect, w, h);
    d.position.set(x, y, 0.394);
    root.add(d);
  }
  const sideDecal = decalMesh(atlas, rects['HANDLE WITH CARE'], 0.3, 0.1);
  sideDecal.position.set(-0.513, 0.78, 0.02);
  sideDecal.rotation.y = -Math.PI / 2;
  root.add(sideDecal);

  // piedini
  for (const [x, z] of [
    [-0.42, 0.3],
    [0.42, 0.3],
    [-0.42, -0.3],
    [0.42, -0.3],
  ]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), dark);
    foot.position.set(x, 0.01, z);
    root.add(foot);
  }

  // animazione bottone
  let press = 0;
  let enabled = true;
  const btnBaseY = btn.position.y;

  function pressButton() {
    press = 1;
  }
  function setButtonEnabled(on: boolean) {
    enabled = on;
    (btn.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 0.35 : 0.05;
  }
  function update(dt: number) {
    if (press > 0) {
      press = Math.max(0, press - dt * 4.5);
      btn.position.y = btnBaseY - 0.008 * Math.sin(press * Math.PI);
    }
    const pulse = enabled ? 0.3 + Math.sin(performance.now() * 0.003) * 0.12 : 0.05;
    (btn.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
  }

  return { root, glass, buttonHit, pressButton, setButtonEnabled, update };
}
