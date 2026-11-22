import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { D } from './dims';

const ENV_URL = './env/studio_small_08_1k.hdr';

function radialShadowTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, 'rgba(0,0,0,0.62)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0.28)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function gradientTexture(from: string, to: string, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, from);
  grad.addColorStop(1, to);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createStudio(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.transmissionResolutionScale = 0.85;
  renderer.shadowMap.enabled = !new URLSearchParams(location.search).has('noshadow');
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#c9c8c3');

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;

  const camera = new THREE.PerspectiveCamera(36, innerWidth / innerHeight, 0.05, 40);

  const hemi = new THREE.HemisphereLight(0xfdfdff, 0xc9c4b8, 0.32);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff1dd, 2.9);
  sun.position.set(1.7, 3.1, 2.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1.35;
  sun.shadow.camera.right = 1.35;
  sun.shadow.camera.top = 2.2;
  sun.shadow.camera.bottom = -0.35;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 9;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.015;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  // rim light per staccare i bordi lucidi dallo sfondo
  const rim = new THREE.DirectionalLight(0xeef4ff, 1.5);
  rim.position.set(-2.4, 2.0, -2.2);
  scene.add(rim);

  // fill frontale basso, ammorbidisce il nero
  const fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(-1.2, 0.6, 2.8);
  scene.add(fill);

  const floorMat = new THREE.MeshStandardMaterial({
    color: '#efece7',
    roughness: 0.55,
    metalness: 0,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ombra di contatto: stacca il cabinet dal pavimento
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.6),
    new THREE.MeshBasicMaterial({
      map: radialShadowTexture(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      color: '#000000',
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, 0.003, 0.03);
  scene.add(contact);

  // fondale con gradiente, così lo studio non è piatto
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 10),
    new THREE.MeshStandardMaterial({
      map: gradientTexture('#f1f0ec', '#cfcec9'),
      roughness: 0.95,
      metalness: 0,
    })
  );
  backdrop.position.set(0, 4.2, -3.4);
  scene.add(backdrop);

  const sweep = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.6, 0.02, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, transparent: true, opacity: 0.0 })
  );
  sweep.visible = false;
  scene.add(sweep);

  function fitCamera() {
    const aspect = innerWidth / innerHeight;
    camera.aspect = aspect;
    // vista da persona in piedi davanti al cabinato: leggermente dall'alto,
    // così deck, levetta e pulsante si leggono in prospettiva
    const fov = 23;
    camera.fov = fov;
    const target = new THREE.Vector3(0, 0.76, 0);
    const size = new THREE.Vector3(1.04, 1.72, 0.9);
    const vFov = THREE.MathUtils.degToRad(fov);
    const distV = size.y / (2 * Math.tan(vFov / 2));
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distH = size.x / (2 * Math.tan(hFov / 2));
    const dist = Math.max(distV, distH) * (aspect < 1 ? 1.1 : 1.04);
    camera.position.set(0, target.y + dist * 0.3, target.z + dist);
    camera.lookAt(target.x, target.y, target.z);
    camera.updateProjectionMatrix();
  }
  fitCamera();

  async function loadEnvironment(): Promise<'hdri' | 'room'> {
    try {
      const loader = new HDRLoader();
      const tex = await Promise.race([
        loader.loadAsync(ENV_URL),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      if (!tex) return 'room';
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const env = pmrem.fromEquirectangular(tex).texture;
      scene.environment = env;
      tex.dispose();
      return 'hdri';
    } catch {
      return 'room';
    }
  }

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight, false);
    fitCamera();
  });

  return { renderer, scene, camera, sun, loadEnvironment, fitCamera };
}
