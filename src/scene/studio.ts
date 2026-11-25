import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { REF } from './dims';
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
  wide.addColorStop(0, 'rgba(26, 28, 42, 0.28)');
  wide.addColorStop(0.4, 'rgba(26, 28, 42, 0.16)');
  wide.addColorStop(0.72, 'rgba(26, 28, 42, 0.04)');
  wide.addColorStop(1, 'rgba(26, 28, 42, 0)');
  g.fillStyle = wide;
  g.fillRect(0, 0, size, size);

  const tight = g.createRadialGradient(cx, cx, 0, cx, cx, size * 0.25);
  tight.addColorStop(0, 'rgba(18, 20, 30, 0.62)');
  tight.addColorStop(0.45, 'rgba(18, 20, 30, 0.36)');
  tight.addColorStop(0.8, 'rgba(18, 20, 30, 0.08)');
  tight.addColorStop(1, 'rgba(18, 20, 30, 0)');
  g.fillStyle = tight;
  g.fillRect(0, 0, size, size);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function backdropTexture(size = 512) {
  const c = canvas(size);
  const g = c.getContext('2d')!;

  // Clean bright studio sweep matching reference/target.png.
  const bg = g.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#eef0f6');
  bg.addColorStop(0.42, '#e7eaf2');
  bg.addColorStop(0.78, '#e2e5ed');
  bg.addColorStop(1, '#dce0ea');
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);

  const pool = g.createRadialGradient(size * 0.5, size * 0.32, size * 0.04, size * 0.5, size * 0.32, size * 0.52);
  pool.addColorStop(0, 'rgba(255, 255, 255, 0.38)');
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
  grad.addColorStop(0, 'rgba(8, 16, 36, 0.52)');
  grad.addColorStop(0.55, 'rgba(8, 16, 36, 0.28)');
  grad.addColorStop(1, 'rgba(8, 16, 36, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ */
/* studio (single-pass WebGL render, vivid glossy studio lighting)     */
/* ------------------------------------------------------------------ */

export function createStudio(canvasEl: HTMLCanvasElement) {
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
  // NeutralToneMapping keeps hot pinks / electric blues / neon cyans explosive without hue shifts.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = !QUERY.has('noshadow');
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false;

  setMaxAnisotropy(Math.min(16, renderer.capabilities.getMaxAnisotropy()));

  const rawRender = renderer.render.bind(renderer);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(REF.bg);
  scene.environmentIntensity = 0.72;
  scene.environmentRotation = new THREE.Euler(0, Math.PI * 0.62, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  roomEnv.colorSpace = THREE.LinearSRGBColorSpace;
  scene.environment = roomEnv;

  // Tighter near/far planes (1.2 -> 24) give ~12x higher depth precision at the cabinet.
  const camera = new THREE.PerspectiveCamera(21.5, innerWidth / innerHeight, 1.2, 24);

  /* ---------------- vibrant high-contrast studio lighting ---------------- */

  // Lower ambient fill so cabinet colors stay deeply saturated and 3D shadows carve real depth.
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb8c2da, 0.62);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfffcf6, 1.44);
  sun.position.set(-1.35, 3.55, 3.1);
  sun.target.position.set(0, 0.88, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1.45;
  sun.shadow.camera.right = 1.45;
  sun.shadow.camera.top = 1.95;
  sun.shadow.camera.bottom = -1.25;
  sun.shadow.camera.near = 1.0;
  sun.shadow.camera.far = 9.0;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.015;
  sun.shadow.radius = 2.5;
  sun.shadow.intensity = 0.52;
  scene.add(sun, sun.target);

  const fill = new THREE.DirectionalLight(0xd9eeff, 0.42);
  fill.position.set(2.3, 1.5, 2.8);
  scene.add(fill);

  // Crisp top-rear rim light for chrome claw & glossy acrylic separation.
  const rim = new THREE.DirectionalLight(0xf0f8ff, 0.54);
  rim.position.set(0.9, 2.7, -2.5);
  scene.add(rim);

  // Interior arcade chamber LED light: makes toys & jewel capsules pop with real Z depth falloff.
  const chamberLight = new THREE.PointLight(0xeef8ff, 0.78, 1.85, 1.55);
  chamberLight.position.set(0, 1.24, 0.22);
  scene.add(chamberLight);

  // Gentle warm golden fill above the PLAY button (high enough to illuminate dome without blinding PLAY text).
  const buttonLight = new THREE.PointLight(0xffd23a, 0.14, 0.36, 2.2);
  buttonLight.position.set(0.255, 0.74, 0.46);
  scene.add(buttonLight);

  /* ---------------- floor + cyclorama backdrop ---------------- */

  const floorMat = new THREE.MeshStandardMaterial({
    color: '#e3e6ef',
    roughness: 0.88,
    metalness: 0,
    envMapIntensity: 0.18,
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
      opacity: 0.9,
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
      opacity: 0.92,
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

  /* ---------------- camera (slightly elevated human POV for true Z depth) ---------------- */

  const baseCamPos = new THREE.Vector3();
  const baseTarget = new THREE.Vector3(0, 0.89, 0);
  let parallaxX = 0;
  let parallaxY = 0;

  function applyCamera() {
    camera.position.set(baseCamPos.x + parallaxX, baseCamPos.y + parallaxY, baseCamPos.z);
    camera.lookAt(baseTarget.x, baseTarget.y, baseTarget.z);
  }

  function fitCamera() {
    const aspect = innerWidth / innerHeight;
    camera.aspect = aspect;
    // Natural human-eye arcade perspective (21.5°) looking slightly down into the chamber & deck
    // so Z depth reads effortlessly while filling the frame boldly like reference/target.png.
    const fov = 21.5;
    camera.fov = fov;
    baseTarget.set(0, 0.89, 0);
    const size = new THREE.Vector3(1.09, 1.85, 0.82);
    const vFov = THREE.MathUtils.degToRad(fov);
    const distV = size.y / (2 * Math.tan(vFov / 2));
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distH = size.x / (2 * Math.tan(hFov / 2));
    const dist = Math.max(distV, distH) * (aspect < 1 ? 1.035 : 1.055) + 0.22;
    // ~10.8° elevated POV (moderately tall player standing in front of the cabinet looking slightly down
    // into the prize chamber and control deck).
    baseCamPos.set(0, baseTarget.y + dist * 0.19, baseTarget.z + dist);
    applyCamera();
    camera.updateProjectionMatrix();
  }
  fitCamera();

  function setParallax(ox: number, oy: number) {
    if (Math.abs(ox - parallaxX) < 1e-4 && Math.abs(oy - parallaxY) < 1e-4) return;
    parallaxX = ox;
    parallaxY = oy;
    applyCamera();
  }

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
      scene.environmentIntensity = 0.72;
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

  return { renderer, scene, camera, sun, loadEnvironment, fitCamera, setParallax };
}
