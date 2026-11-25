import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { D, REF } from './dims';
import { setMaxAnisotropy } from './materials';

const ENV_URL = './env/studio_small_08_1k.hdr';

const QUERY = new URLSearchParams(location.search);
const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/* ------------------------------------------------------------------ */
/* canvas textures                                                     */
/* ------------------------------------------------------------------ */

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function contactShadowTexture(size = 512) {
  const c = canvas(size);
  const g = c.getContext('2d')!;
  const cx = size / 2;

  const wide = g.createRadialGradient(cx, cx, size * 0.04, cx, cx, size * 0.5);
  wide.addColorStop(0, 'rgba(32, 34, 46, 0.24)');
  wide.addColorStop(0.4, 'rgba(32, 34, 46, 0.14)');
  wide.addColorStop(0.72, 'rgba(32, 34, 46, 0.04)');
  wide.addColorStop(1, 'rgba(32, 34, 46, 0)');
  g.fillStyle = wide;
  g.fillRect(0, 0, size, size);

  const tight = g.createRadialGradient(cx, cx, 0, cx, cx, size * 0.24);
  tight.addColorStop(0, 'rgba(20, 22, 32, 0.55)');
  tight.addColorStop(0.45, 'rgba(20, 22, 32, 0.32)');
  tight.addColorStop(0.8, 'rgba(20, 22, 32, 0.08)');
  tight.addColorStop(1, 'rgba(20, 22, 32, 0)');
  g.fillStyle = tight;
  g.fillRect(0, 0, size, size);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function backdropTexture(size = 512) {
  const c = canvas(size);
  const g = c.getContext('2d')!;

  // Flat illustrated studio backdrop that blends into REF.bg (#ced1da).
  const bg = g.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#d7dae3');
  bg.addColorStop(0.42, '#d2d5df');
  bg.addColorStop(0.78, '#ced1da');
  bg.addColorStop(1, '#ced1da');
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);

  const pool = g.createRadialGradient(size * 0.5, size * 0.32, size * 0.04, size * 0.5, size * 0.32, size * 0.5);
  pool.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  pool.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.fillStyle = pool;
  g.fillRect(0, 0, size, size);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cycGeometry(width = 18, height = 9, radius = 1.4, segs = 28) {
  const geo = new THREE.PlaneGeometry(width, height, 1, segs);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + height / 2;
    pos.setY(i, y);
    const z = y < radius ? radius - Math.sqrt(Math.max(0, radius * radius - (radius - y) * (radius - y))) : radius;
    pos.setZ(i, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

function pileShadowTexture(size = 256) {
  const c = canvas(size);
  const g = c.getContext('2d')!;
  const cx = size / 2;
  const grad = g.createRadialGradient(cx, cx, size * 0.02, cx, cx, size * 0.5);
  grad.addColorStop(0, 'rgba(18, 42, 76, 0.28)');
  grad.addColorStop(0.5, 'rgba(18, 42, 76, 0.14)');
  grad.addColorStop(1, 'rgba(18, 42, 76, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ */
/* studio (single-pass WebGL render, bright studio lighting)           */
/* ------------------------------------------------------------------ */

export function createStudio(canvasEl: HTMLCanvasElement) {
  // Full sharpness on Retina/iPhone (DPR 3) and desktop (DPR 2). No soft caps.
  const maxDpr = COARSE ? Math.min(devicePixelRatio || 1, 3) : Math.min(devicePixelRatio || 1, 2.5);
  const MIN_DPR = 1.5;
  const DPR_STEP = 0.25;
  let currentDpr = maxDpr;

  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(currentDpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral mapping keeps pastel pinks / sky blues / neon cyans true to their hex.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !QUERY.has('noshadow');
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;

  // Share the GPU max anisotropy with texture-building helpers.
  setMaxAnisotropy(Math.min(16, renderer.capabilities.getMaxAnisotropy()));

  const rawRender = renderer.render.bind(renderer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(REF.bg);
  scene.environmentIntensity = 0.45;
  scene.environmentRotation = new THREE.Euler(0, Math.PI * 0.65, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  roomEnv.colorSpace = THREE.LinearSRGBColorSpace;
  scene.environment = roomEnv;

  const camera = new THREE.PerspectiveCamera(13, innerWidth / innerHeight, 0.1, 40);

  /* ---------------- soft, flat, frontal illustrated key/fill ---------------- */

  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8dce8, 1.15);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfffaf2, 1.15);
  sun.position.set(-1.4, 2.8, 3.6);
  sun.target.position.set(0, 0.88, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1.6;
  sun.shadow.camera.right = 1.6;
  sun.shadow.camera.top = 1.9;
  sun.shadow.camera.bottom = -1.4;
  sun.shadow.camera.near = 0.8;
  sun.shadow.camera.far = 9.5;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 2;
  sun.shadow.intensity = 0.32;
  scene.add(sun, sun.target);

  const fill = new THREE.DirectionalLight(0xeaf3ff, 0.65);
  fill.position.set(2.2, 1.6, 3.0);
  scene.add(fill);

  // Very subtle edge separation; intentionally weak for the flat look.
  const rim = new THREE.DirectionalLight(0xffffff, 0.25);
  rim.position.set(1.6, 2.4, -2.6);
  scene.add(rim);

  /* ---------------- floor + cyclorama backdrop ---------------- */

  const floorMat = new THREE.MeshStandardMaterial({
    color: '#d5d8e2',
    roughness: 0.9,
    metalness: 0,
    envMapIntensity: 0.15,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.6),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      toneMapped: false,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0.02, 0.002, 0.02);
  contact.renderOrder = 1;
  scene.add(contact);

  const pileAo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.48),
    new THREE.MeshBasicMaterial({
      map: pileShadowTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      toneMapped: false,
    })
  );
  pileAo.rotation.x = -Math.PI / 2;
  pileAo.position.set(0.05, 0.7215, 0.03);
  pileAo.renderOrder = 1;
  scene.add(pileAo);

  const backdrop = new THREE.Mesh(
    cycGeometry(),
    new THREE.MeshBasicMaterial({
      map: backdropTexture(),
      toneMapped: false,
    })
  );
  backdrop.position.set(0, 0, -3.4);
  scene.add(backdrop);

  /* ---------------- camera ---------------- */

  function fitCamera() {
    const aspect = innerWidth / innerHeight;
    camera.aspect = aspect;
    // Narrow telephoto FOV => nearly orthographic / illustrated 2D framing.
    const fov = 13.5;
    camera.fov = fov;
    const target = new THREE.Vector3(0, 0.895, 0);
    const size = new THREE.Vector3(1.13, 1.82, 0.82);
    const vFov = THREE.MathUtils.degToRad(fov);
    const distV = size.y / (2 * Math.tan(vFov / 2));
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distH = size.x / (2 * Math.tan(hFov / 2));
    // Tight framing; keeps the outer pink trim and ~4% side margins on screen.
    const dist = Math.max(distV, distH) * (aspect < 1 ? 1.03 : 1.05);
    // Slight top-front pitch (~5.5 deg) so the blue control deck and PLAY label read clearly.
    camera.position.set(0, target.y + dist * 0.095, target.z + dist);
    camera.lookAt(target.x, target.y, target.z);
    camera.updateProjectionMatrix();
  }
  fitCamera();

  /* ---------------- adaptive DPR (only when genuinely GPU-bound) ---------------- */

  let lastRenderAt = 0;
  let fpsRolling = 60;
  let slowSince: number | null = null;
  let firstFrameAt = 0;
  const WARMUP_MS = 3000;
  const LOW_FPS = 48;
  const SUSTAIN_MS = 1500;

  function adaptPixelRatio(now: number) {
    if (!firstFrameAt) firstFrameAt = now;
    if (lastRenderAt) {
      const delta = now - lastRenderAt;
      if (delta > 0 && delta < 500) {
        const inst = 1000 / delta;
        fpsRolling = fpsRolling * 0.9 + inst * 0.1;
      }
    }
    lastRenderAt = now;

    if (now - firstFrameAt < WARMUP_MS) return;

    if (fpsRolling < LOW_FPS) {
      if (slowSince === null) slowSince = now;
      else if (now - slowSince > SUSTAIN_MS && currentDpr > MIN_DPR) {
        currentDpr = Math.max(MIN_DPR, currentDpr - DPR_STEP);
        renderer.setPixelRatio(currentDpr);
        renderer.setSize(innerWidth, innerHeight, false);
        // Give the new ratio a fresh window before considering another step.
        slowSince = now;
      }
    } else {
      slowSince = null;
    }
  }

  /* ---------------- render hook ---------------- */

  const renderFrame = (target: THREE.Object3D, cam: THREE.Camera) => {
    adaptPixelRatio(performance.now());
    renderer.info.reset();
    rawRender(target, cam);
  };

  renderer.render = renderFrame as typeof renderer.render;

  /* ---------------- environment ---------------- */

  async function loadEnvironment(): Promise<'hdri' | 'room'> {
    try {
      const loader = new HDRLoader();
      const tex = await Promise.race([
        loader.loadAsync(ENV_URL),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]);
      if (!tex) return 'room';
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const env = pmrem.fromEquirectangular(tex).texture;
      scene.environment = env;
      scene.environmentIntensity = 0.45;
      tex.dispose();
      roomEnv.dispose();
      return 'hdri';
    } catch {
      return 'room';
    }
  }

  addEventListener('resize', () => {
    renderer.setPixelRatio(currentDpr);
    renderer.setSize(innerWidth, innerHeight, false);
    fitCamera();
  });

  return { renderer, scene, camera, sun, loadEnvironment, fitCamera };
}
