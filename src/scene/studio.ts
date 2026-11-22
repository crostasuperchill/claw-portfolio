import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { D } from './dims';

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

/**
 * Ombra di contatto a due strati: un nucleo stretto e denso sotto il piede
 * del cabinato, più un alone largo e morbidissimo che stacca la base dal
 * pavimento. Il primo strato deve leggersi come occlusione, il secondo come
 * rimbalzo di luce che si spegne.
 */
function contactShadowTexture(size = 1024) {
  const c = canvas(size);
  const g = c.getContext('2d')!;
  const cx = size / 2;

  // strato largo: alone ambientale
  const wide = g.createRadialGradient(cx, cx, size * 0.02, cx, cx, size * 0.5);
  wide.addColorStop(0, 'rgba(18,14,16,0.30)');
  wide.addColorStop(0.32, 'rgba(18,14,16,0.19)');
  wide.addColorStop(0.62, 'rgba(18,14,16,0.07)');
  wide.addColorStop(1, 'rgba(18,14,16,0)');
  g.fillStyle = wide;
  g.fillRect(0, 0, size, size);

  // strato stretto: contatto vero, ellittico e più denso
  const tight = g.createRadialGradient(cx, cx, 0, cx, cx, size * 0.26);
  tight.addColorStop(0, 'rgba(10,8,9,0.62)');
  tight.addColorStop(0.42, 'rgba(10,8,9,0.46)');
  tight.addColorStop(0.78, 'rgba(10,8,9,0.13)');
  tight.addColorStop(1, 'rgba(10,8,9,0)');
  g.fillStyle = tight;
  g.fillRect(0, 0, size, size);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Fondale da set fotografico: gradiente verticale, pozzo di luce caldo dietro
 * il cabinato e ombra dolce alla base, così il piano non è un rettangolo piatto.
 */
function backdropTexture(size = 1024) {
  const c = canvas(size);
  const g = c.getContext('2d')!;

  const bg = g.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#4e4c49');
  bg.addColorStop(0.35, '#5c5a56');
  bg.addColorStop(0.72, '#474542');
  bg.addColorStop(1, '#2f2e2c');
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);

  // pozzo di luce: alto/centro, come un softbox appena fuori campo
  const pool = g.createRadialGradient(size * 0.5, size * 0.26, size * 0.02, size * 0.5, size * 0.26, size * 0.34);
  pool.addColorStop(0, 'rgba(255,246,232,0.14)');
  pool.addColorStop(0.5, 'rgba(255,244,228,0.06)');
  pool.addColorStop(1, 'rgba(255,244,228,0)');
  g.fillStyle = pool;
  g.fillRect(0, 0, size, size);

  // occlusione dietro il cabinato: ancora il volume al fondo
  const occl = g.createRadialGradient(size * 0.5, size * 0.84, size * 0.01, size * 0.5, size * 0.84, size * 0.2);
  occl.addColorStop(0, 'rgba(24,20,22,0.34)');
  occl.addColorStop(0.5, 'rgba(24,20,22,0.16)');
  occl.addColorStop(1, 'rgba(24,20,22,0)');
  g.save();
  g.translate(size * 0.5, size * 0.84);
  g.scale(0.55, 1);
  g.translate(-size * 0.5, -size * 0.84);
  g.fillStyle = occl;
  g.fillRect(0, 0, size, size);
  g.restore();

  // micro-grana di stampa, evita banding nel gradiente
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  let s = 0x9e3779b9;
  for (let i = 0; i < d.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const n = (s / 4294967296 - 0.5) * 4;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  g.putImageData(img, 0, 0);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ------------------------------------------------------------------ */
/* post: vignette + grain                                              */
/* ------------------------------------------------------------------ */

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    aspect: { value: 1 },
    strength: { value: 0.30 },
    grain: { value: 0.014 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float aspect;
    uniform float strength;
    uniform float grain;
    varying vec2 vUv;

    float hash( vec2 p ) {
      return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
    }

    void main() {
      vec4 texel = texture2D( tDiffuse, vUv );

      // vignettatura ellittica, normalizzata sui quattro angoli
      vec2 q = vUv - 0.5;
      q.x *= aspect;
      float d = length( q ) / ( 0.5 * sqrt( aspect * aspect + 1.0 ) );
      float v = smoothstep( 0.38, 1.0, d );
      float mask = 1.0 - strength * v;

      // grana finissima, solo per rompere i gradienti (display space)
      float n = hash( floor( vUv * vec2( 1920.0, 1080.0 ) ) ) - 0.5;

      gl_FragColor = vec4( texel.rgb * mask + n * grain, 1.0 );
    }
  `,
};

/* ------------------------------------------------------------------ */
/* studio                                                              */
/* ------------------------------------------------------------------ */

export function createStudio(canvasEl: HTMLCanvasElement) {
  const wantPost = !QUERY.has('nopost');
  const autoQuality = !QUERY.has('noauto') && COARSE;
  const maxDpr = COARSE ? 1.75 : 2;

  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.transmissionResolutionScale = 0.85;
  renderer.shadowMap.enabled = !QUERY.has('noshadow');
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // draw call cumulative per frame: il composer fa più pass, vogliamo vederli
  renderer.info.autoReset = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#4a4845');
  // l'ambiente dà solo il rimbalzo: la forma la devono fare le luci
  scene.environmentIntensity = 0.4;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;
  (scene.environment as THREE.Texture).colorSpace = THREE.LinearSRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(23, innerWidth / innerHeight, 0.05, 40);

  /* ---------------- luci ---------------- */

  // rimbalzo ambiente basso e tiepido: pavimento chiaro che rimanda in alto
  const hemi = new THREE.HemisphereLight(0xdce9ff, 0xb09a86, 0.12);
  scene.add(hemi);

  // key: softbox alto a sinistra, calda, è l'unica che fa ombra
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.7);
  sun.position.set(-2.4, 3.2, 1.5);
  sun.target.position.set(0, 0.86, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -1.85;
  sun.shadow.camera.right = 1.85;
  sun.shadow.camera.top = 1.95;
  sun.shadow.camera.bottom = -1.95;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 9;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.022;
  sun.shadow.radius = 3.5;
  scene.add(sun, sun.target);

  // fill fredda da destra: apre le ombre senza spegnerle
  const fill = new THREE.DirectionalLight(0xc4d9ff, 0.26);
  fill.position.set(2.7, 1.15, 2.1);
  scene.add(fill);

  // rim dal fondo: stacca la silhouette destra dallo sfondo
  const rim = new THREE.DirectionalLight(0xdfeeff, 1.65);
  rim.position.set(1.9, 2.75, -2.9);
  scene.add(rim);

  /* ---------------- strip LED dentro la teca ---------------- */
  // due praticabili freddi appena sotto il tetto, allineati ai tubi LED
  // modellati; PointLight invece di RectArea: stesso pooling di luce sui
  // gusci ma un terzo del costo per fragment.
  const ledMat = '#e2f3ff';
  const ledL = new THREE.PointLight(ledMat, 0.3, 1.1, 2);
  ledL.position.set(-0.36, 1.275, 0.02);
  scene.add(ledL);

  const ledR = new THREE.PointLight(ledMat, 0.3, 1.1, 2);
  ledR.position.set(0.36, 1.275, 0.02);
  scene.add(ledR);

  // luce calda dentro il chute: il pozzo di raccolta non è mai nero
  const chute = new THREE.PointLight(0xffa858, 0.2, 0.42, 2);
  chute.position.set(D.chute.x, 0.755, D.chute.z + 0.02);
  scene.add(chute);

  /* ---------------- pavimento + fondale ---------------- */

  const floorMat = new THREE.MeshStandardMaterial({
    color: '#6f6b65',
    roughness: 0.62,
    metalness: 0,
    envMapIntensity: 0.35,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ombra di contatto a due strati
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.35, 1.75),
    new THREE.MeshBasicMaterial({
      map: contactShadowTexture(),
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      color: '#000000',
      toneMapped: false,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0.02, 0.0025, 0.02);
  contact.renderOrder = 1;
  scene.add(contact);

  // fondale: gradiente + pozzo di luce + occlusione, non un pannello piatto.
  // MeshBasic: il fondo è un set stampato, non deve bruciarsi sotto la key.
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 10),
    new THREE.MeshBasicMaterial({ map: backdropTexture() })
  );
  backdrop.position.set(0, 4.2, -3.4);
  scene.add(backdrop);

  const sweep = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.6, 0.02, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, transparent: true, opacity: 0.0 })
  );
  sweep.visible = false;
  scene.add(sweep);

  /* ---------------- camera ---------------- */

  function fitCamera() {
    const aspect = innerWidth / innerHeight;
    camera.aspect = aspect;
    // vista da persona in piedi davanti al cabinato: frontale,
    // leggermente dall'alto, così deck, levetta e pulsante si leggono
    const fov = 23;
    camera.fov = fov;
    const target = new THREE.Vector3(0, 0.78, 0);
    const size = new THREE.Vector3(1.05, 1.74, 0.9);
    const vFov = THREE.MathUtils.degToRad(fov);
    const distV = size.y / (2 * Math.tan(vFov / 2));
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distH = size.x / (2 * Math.tan(hFov / 2));
    const dist = Math.max(distV, distH) * (aspect < 1 ? 1.06 : 1.02);
    camera.position.set(0, target.y + dist * 0.28, target.z + dist);
    camera.lookAt(target.x, target.y, target.z);
    camera.updateProjectionMatrix();
  }
  fitCamera();

  /* ---------------- post-processing ---------------- */

  let composer: EffectComposer | null = null;
  let bloom: UnrealBloomPass | null = null;
  let grade: ShaderPass | null = null;

  if (wantPost) {
    // RT esplicito con MSAA: il composer non eredita l'antialias del canvas
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: COARSE ? 2 : 4,
    });
    composer = new EffectComposer(renderer, rt);
    composer.setSize(innerWidth, innerHeight);

    composer.addPass(new RenderPass(scene, camera));

    // bloom in HDR lineare: soglia 0.85 = solo emissivi e speculari brillanti
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.4, 0.85);
    if (COARSE) {
      // su mobile il bloom lavora a metà risoluzione: i mip partono già dimezzati
      const bloomSetSize = bloom.setSize.bind(bloom);
      bloom.setSize = (w: number, h: number) => bloomSetSize(w * 0.5, h * 0.5);
    }
    composer.addPass(bloom);

    // tone mapping + conversione sRGB
    composer.addPass(new OutputPass());

    // vignettatura e grana, ultimo pass
    grade = new ShaderPass(GradeShader);
    grade.material.toneMapped = false;
    grade.uniforms.tDiffuse.value = null;
    composer.addPass(grade);
  }

  const gradeAspect = () => {
    if (grade) grade.uniforms.aspect.value = innerWidth / innerHeight;
  };
  gradeAspect();

  /* ---------------- adaptive quality (solo touch) ---------------- */

  let fallbackStep = 0;
  let fpsEma = 60;
  let lastFrame = performance.now();
  let frames = 0;
  let slowFrames = 0;
  let checkAfter = 180;

  function lowerQuality() {
    if (fallbackStep === 0 && bloom) {
      bloom.enabled = false;
      fallbackStep = 1;
      return true;
    }
    if (fallbackStep <= 1) {
      const dpr = Math.min(devicePixelRatio, 1.4);
      renderer.setPixelRatio(dpr);
      renderer.setSize(innerWidth, innerHeight, false);
      composer?.setPixelRatio(dpr);
      composer?.setSize(innerWidth, innerHeight);
      fallbackStep = 2;
      return true;
    }
    return false;
  }

  /* ---------------- render hook ---------------- */

  // main.ts chiama renderer.render(scene, camera): qui dirottiamo sul composer.
  // Le pass interne (fullscreen quad) rientrano nella stessa funzione: il flag
  // insideFrame le manda al render originale, evitando la ricorsione.
  const rawRender = renderer.render.bind(renderer);
  let insideFrame = false;
  let sceneRenders = 0;

  const renderFrame = (target: THREE.Object3D, cam: THREE.Camera) => {
    if (insideFrame) {
      sceneRenders++;
      rawRender(target, cam);
      return;
    }
    insideFrame = true;
    try {
      renderer.info.reset();

      const now = performance.now();
      const dt = now - lastFrame;
      lastFrame = now;
      if (dt > 0 && dt < 250) fpsEma = fpsEma * 0.9 + (1000 / dt) * 0.1;
      frames++;
      if (autoQuality && frames > checkAfter) {
        slowFrames = fpsEma < 55 ? slowFrames + 1 : Math.max(0, slowFrames - 3);
        if (slowFrames > 90) {
          if (lowerQuality()) {
            slowFrames = 0;
            checkAfter = frames + 180;
          }
        }
      }

      if (composer && fallbackStep < 2) composer.render();
      else rawRender(target, cam);
    } finally {
      insideFrame = false;
    }
  };

  renderer.render = renderFrame as typeof renderer.render;

  /* ---------------- environment ---------------- */

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
    composer?.setPixelRatio(renderer.getPixelRatio());
    composer?.setSize(innerWidth, innerHeight);
    gradeAspect();
    fitCamera();
  });

  (window as unknown as { __studio?: unknown }).__studio = {
    scene,
    renderer,
    camera,
    sun,
    lights: { hemi, fill, rim, ledL, ledR, chute },
    bloom,
    composer,
    setPost: (on: boolean) => {
      fallbackStep = on ? 0 : 2;
      if (bloom) bloom.enabled = on;
    },
    setLeds: (intensity: number) => {
      ledL.intensity = intensity;
      ledR.intensity = intensity;
    },
    debugStats: () => ({ frames, sceneRenders, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
  };

  return { renderer, scene, camera, sun, loadEnvironment, fitCamera, bloom, composer };
}
