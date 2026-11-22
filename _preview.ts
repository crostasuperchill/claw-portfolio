import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCharms } from './src/scene/charms';
import { makeCapsule } from './src/scene/capsules';
import { makeToy, TOY_TOP } from './src/scene/toys';
import { PROJECTS } from './src/game/roster';
import { D } from './src/scene/dims';

const view = new URLSearchParams(location.search).get('view') ?? 'charms';
const detailToy = new URLSearchParams(location.search).get('toy') ?? 'charm';
const canvas = document.getElementById('stage') as HTMLCanvasElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.02, 20);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;

const hemi = new THREE.HemisphereLight(0xfdfdff, 0x8c8578, 0.35);
const sun = new THREE.DirectionalLight(0xfff1dd, 2.3);
sun.position.set(1.7, 3.1, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -1.2;
sun.shadow.camera.right = 1.2;
sun.shadow.camera.top = 2;
sun.shadow.camera.bottom = 0;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 8;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.012;
sun.shadow.radius = 4;
scene.add(hemi, sun);
const rim = new THREE.DirectionalLight(0xeef4ff, 1.0);
rim.position.set(-2.4, 2.0, -2.2);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffffff, 0.45);
fill.position.set(-1.2, 0.6, 2.8);
scene.add(fill);

// warm product-shot backdrop, so white acrylic/paper has contrast
scene.background = new THREE.Color(view === 'charms' ? '#bdb6aa' : '#f2efea');
const backdrop = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 5),
  new THREE.MeshStandardMaterial({
    color: view === 'charms' ? '#c9c2b5' : '#f7f5f1',
    roughness: 0.95,
  })
);
backdrop.position.set(0, 0.8, -0.9);
backdrop.receiveShadow = true;
scene.add(backdrop);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8),
  new THREE.MeshStandardMaterial({ color: view === 'charms' ? '#b3aca0' : '#efece7', roughness: 0.9 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const box = new THREE.Box3();
const size = new THREE.Vector3();
const bboxes: Record<string, { top: number; bottom: number; w: number; h: number; d: number }> = {};
for (const p of PROJECTS) {
  const toy = makeToy(p.toy, p.color);
  toy.updateMatrixWorld(true);
  box.setFromObject(toy);
  box.getSize(size);
  bboxes[p.toy] = {
    top: +box.max.y.toFixed(4),
    bottom: +box.min.y.toFixed(4),
    w: +size.x.toFixed(4),
    h: +size.y.toFixed(4),
    d: +size.z.toFixed(4),
  };
}
(window as any).__bboxes = bboxes;
(window as any).__toyTop = TOY_TOP;

let charms: ReturnType<typeof buildCharms> | null = null;

if (view === 'charms') {
  charms = buildCharms({
    labels: [
      { text: 'WEB DEV', color: '#ff8fb8' },
      { text: 'FRONT-END', color: '#8ecbff' },
      { text: 'UX/UI', color: '#8fe3c4' },
      { text: '3D ART', color: '#c9b1ff' },
    ],
    topY: 1.3,
    z: -0.18,
    halfWidth: 0.35,
  });
  scene.add(charms.group);

  // simple hanger rail, like a real display rod inside the case
  const rail = new THREE.Mesh(
    new THREE.CylinderGeometry(0.007, 0.007, 0.84, 16),
    new THREE.MeshPhysicalMaterial({ color: '#cfd4da', metalness: 1, roughness: 0.2, envMapIntensity: 1.4 })
  );
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, 1.307, -0.18);
  scene.add(rail);

  camera.fov = 30;
  camera.position.set(0.02, 1.155, 0.82);
  camera.lookAt(0, 1.145, -0.18);
  camera.updateProjectionMatrix();
} else if (view === 'toys') {
  PROJECTS.forEach((p, i) => {
    const toy = makeToy(p.toy, p.color);
    toy.position.set(-0.23 + (i % 3) * 0.23, 0.058 + Math.floor(i / 3) * 0.15, 0.02);
    scene.add(toy);
  });
  camera.fov = 28;
  camera.position.set(0, 0.16, 0.78);
  camera.lookAt(0, 0.15, 0);
  camera.updateProjectionMatrix();
} else if (view === 'detail') {
  const p = PROJECTS.find((x) => x.toy === detailToy) ?? PROJECTS[0];
  const toy = makeToy(p.toy, p.color);
  toy.position.set(0, 0.055, 0);
  scene.add(toy);
  camera.fov = 30;
  camera.position.set(0.02, 0.075, 0.34);
  camera.lookAt(0, 0.06, 0);
  camera.updateProjectionMatrix();
} else {
  PROJECTS.forEach((p, i) => {
    const c = makeCapsule({ project: p, radius: D.capsuleR });
    c.position.set(-0.45 + i * 0.18, D.capsuleR, 0.04);
    scene.add(c);
  });
  camera.fov = 28;
  camera.position.set(0, 0.15, 1.22);
  camera.lookAt(0, 0.075, 0);
  camera.updateProjectionMatrix();
}

const clock = new THREE.Clock();
function frame() {
  const t = clock.getElapsedTime();
  charms?.update(t);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
(window as any).__snap = (t = 1.2) => {
  charms?.update(t);
  renderer.render(scene, camera);
  return canvas.toDataURL('image/png');
};
(window as any).__ready = true;
