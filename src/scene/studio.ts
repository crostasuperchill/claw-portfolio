import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
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
  wide.addColorStop(0, 'rgba(16,12,14,0.34)');
  wide.addColorStop(0.32, 'rgba(16,12,14,0.22)');
  wide.addColorStop(0.62, 'rgba(16,12,14,0.08)');
  wide.addColorStop(1, 'rgba(16,12,14,0)');
  g.fillStyle = wide;
  g.fillRect(0, 0, size, size);

  // strato stretto: contatto vero, ellittico e più denso
  const tight = g.createRadialGradient(cx, cx, 0, cx, cx, size * 0.22);
  tight.addColorStop(0, 'rgba(8,6,7,0.74)');
  tight.addColorStop(0.38, 'rgba(8,6,7,0.54)');
  tight.addColorStop(0.76, 'rgba(8,6,7,0.16)');
  tight.addColorStop(1, 'rgba(8,6,7,0)');
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

  // il fondo parte dal tono del pavimento e si scurisce verso l'alto:
  // il raccordo del ciclorama resta invisibile
  const bg = g.createLinearGradient(0, 0, 0, size);
  bg.addColorStop(0, '#333230');
  bg.addColorStop(0.2, '#3c3a38');
  bg.addColorStop(0.45, '#484543');
  bg.addColorStop(0.7, '#54514e');
  bg.addColorStop(0.9, '#625e59');
  bg.addColorStop(1, '#6f6b65');
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

/**
 * Ciclorama da studio: piano verticale che si raccorda al pavimento con un
 * quarto di cerchio. Elimina la linea d'orizzonte fra fondale e floor.
 */
function cycGeometry(width = 20, height = 10, radius = 1.4, segs = 64) {
  const geo = new THREE.PlaneGeometry(width, height, 2, segs);
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

/**
 * Occlusione sotto la pila di capsule: l'interno della teca non ha shadow map,
 * e senza questo velo le calotte sembrano appoggiate sul nulla.
 */
function pileShadowTexture(size = 512) {
  const c = canvas(size);
  const g = c.getContext('2d')!;
  const cx = size / 2;
  const grad = g.createRadialGradient(cx, cx, size * 0.015, cx, cx, size * 0.5);
  grad.addColorStop(0, 'rgba(6,9,14,0.52)');
  grad.addColorStop(0.42, 'rgba(6,9,14,0.36)');
  grad.addColorStop(0.72, 'rgba(6,9,14,0.10)');
  grad.addColorStop(1, 'rgba(6,9,14,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ------------------------------------------------------------------ */
/* post: bloom selettivo, vignette, grain                              */
/* ------------------------------------------------------------------ */

/**
 * Renders only the objects tagged on layer 1 (emissive materials) over black.
 * Used as the source for the bloom so lit plastic and the pale back wall never
 * bleed into halos: only real light sources glow.
 */
class EmissivePass extends Pass {
  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private renderScene: (scene: THREE.Object3D, camera: THREE.Camera) => void
  ) {
    super();
    this.needsSwap = true;
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget) {
    const bg = this.scene.background;
    const mask = this.camera.layers.mask;
    const oldAutoClear = renderer.autoClear;
    const oldColor = renderer.getClearColor(new THREE.Color());
    const oldAlpha = renderer.getClearAlpha();

    this.scene.background = null;
    this.camera.layers.set(1);
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    renderer.autoClear = false;
    this.renderScene(this.scene, this.camera);
    renderer.autoClear = oldAutoClear;
    this.camera.layers.mask = mask;
    this.scene.background = bg;
    renderer.setClearColor(oldColor, oldAlpha);
  }
}

const BloomMixShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tBloom: { value: null as THREE.Texture | null },
    weight: { value: 0.6 },
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
    uniform sampler2D tBloom;
    uniform float weight;
    varying vec2 vUv;
    void main() {
      vec4 base = texture2D( tDiffuse, vUv );
      vec3 glow = texture2D( tBloom, vUv ).rgb;
      gl_FragColor = vec4( base.rgb + glow * weight, base.a );
    }
  `,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    aspect: { value: 1 },
    strength: { value: 0.30 },
    grain: { value: 0.022 },
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
  const wantBloom = !QUERY.has('nobloom');
  const wantMsaa = !QUERY.has('nomsaa');
  const autoQuality = !QUERY.has('noauto') && COARSE;
  const maxDpr = COARSE ? 1.2 : 2;

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
  // render originale: le pass interne (fullscreen quad) devono passare da qui,
  // altrimenti il composer chiamerebbe se stesso
  const rawRender = renderer.render.bind(renderer);

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
  sun.shadow.radius = 40;
  sun.shadow.intensity = 0.85;
  scene.add(sun, sun.target);

  // fill fredda da destra: apre le ombre senza spegnerle
  const fill = new THREE.DirectionalLight(0xc4d9ff, 0.26);
  fill.position.set(2.7, 1.15, 2.1);
  scene.add(fill);

  // rim dal fondo: stacca la silhouette destra dallo sfondo
  const rim = new THREE.DirectionalLight(0xdfeeff, 2.0);
  rim.position.set(1.9, 2.75, -2.9);
  scene.add(rim);

  /* ---------------- strip LED dentro la teca ---------------- */
  // due praticabili freddi appena sotto il tetto, allineati ai tubi LED
  // modellati; PointLight invece di RectArea: stesso pooling di luce sui
  // gusci ma un terzo del costo per fragment.
  const ledMat = '#e2f3ff';
  const ledL = new THREE.PointLight(ledMat, 0.22, 1.1, 2);
  ledL.position.set(-0.36, 1.275, 0.02);
  scene.add(ledL);

  const ledR = new THREE.PointLight(ledMat, 0.22, 1.1, 2);
  ledR.position.set(0.36, 1.275, 0.02);
  scene.add(ledR);

  // luce dall'alto al centro della teca: dà il pooling sulle calotte
  const ledTop = new THREE.PointLight('#eef8ff', 0.24, 1.05, 2);
  ledTop.position.set(0, 1.29, -0.04);
  scene.add(ledTop);

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

  // finta occlusione sotto la pila: ancora le capsule al piano di gioco
  const pileAo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.8, 0.5),
    new THREE.MeshBasicMaterial({
      map: pileShadowTexture(),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      color: '#000000',
      toneMapped: false,
    })
  );
  pileAo.rotation.x = -Math.PI / 2;
  pileAo.position.set(0.045, 0.7218, 0.03);
  pileAo.renderOrder = 1;
  scene.add(pileAo);

  // fondale: ciclorama, non un pannello piatto. Il gradiente stampato parte
  // dal tono del pavimento, così non c'è orizzonte.
  const backdrop = new THREE.Mesh(
    cycGeometry(),
    new THREE.MeshStandardMaterial({
      map: backdropTexture(),
      roughness: 0.82,
      metalness: 0,
      envMapIntensity: 0.35,
    })
  );
  backdrop.position.set(0, 0, -3.4);
  backdrop.receiveShadow = true;
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
  let bloomComposer: EffectComposer | null = null;
  let bloomMix: ShaderPass | null = null;
  let fxaa: ShaderPass | null = null;
  let grade: ShaderPass | null = null;

  const updateFxaa = () => {
    if (!fxaa) return;
    const dpr = renderer.getPixelRatio();
    fxaa.uniforms.resolution.value.set(1 / (innerWidth * dpr), 1 / (innerHeight * dpr));
  };

  if (wantPost) {
    // RT esplicito con MSAA: il composer non eredita l'antialias del canvas
    const useMsaa = wantMsaa && !COARSE;
    const rt = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: useMsaa ? 4 : 0,
    });
    composer = new EffectComposer(renderer, rt);
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));

    if (wantBloom) {
      // bloom selettivo: la sorgente è solo lo strato emissivo, a metà risoluzione
      const bloomRt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
      bloomComposer = new EffectComposer(renderer, bloomRt);
      bloomComposer.renderToScreen = false;
      bloomComposer.addPass(new EmissivePass(scene, camera, rawRender));
      bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.4, 0.85);
      bloomComposer.addPass(bloom);
      bloomComposer.setPixelRatio(renderer.getPixelRatio() * (COARSE ? 0.5 : 1));
      bloomComposer.setSize(innerWidth, innerHeight);

      bloomMix = new ShaderPass(BloomMixShader);
      bloomMix.material.toneMapped = false;
      composer.addPass(bloomMix);
    }

    // tone mapping + conversione sRGB
    composer.addPass(new OutputPass());

    // su mobile niente MSAA (costoso su RT half-float): FXAA in display space
    if (!useMsaa) {
      fxaa = new ShaderPass(FXAAShader);
      fxaa.material.toneMapped = false;
      composer.addPass(fxaa);
      updateFxaa();
    }

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
  let checkAfter = 90;

  function lowerQuality() {
    if (fallbackStep === 0 && bloom) {
      bloom.enabled = false;
      fallbackStep = 1;
      return true;
    }
    if (fallbackStep <= 1) {
      const dpr = Math.min(devicePixelRatio, 1.1);
      renderer.setPixelRatio(dpr);
      renderer.setSize(innerWidth, innerHeight, false);
      composer?.setPixelRatio(dpr);
      composer?.setSize(innerWidth, innerHeight);
      bloomComposer?.setPixelRatio(dpr * 0.5);
      bloomComposer?.setSize(innerWidth, innerHeight);
      updateFxaa();
      fallbackStep = 2;
      return true;
    }
    return false;
  }

  /* ---------------- render hook ---------------- */

  // main.ts chiama renderer.render(scene, camera): qui dirottiamo sul composer.
  // Le pass interne (fullscreen quad) rientrano nella stessa funzione: il flag
  // insideFrame le manda al render originale, evitando la ricorsione.
  let insideFrame = false;

  // Tag emissivo: una sola passata dopo che la scena è popolata.
  // Gli oggetti restano anche sul layer 0, quindi si vedono nel render principale.
  let emissiveTagged = false;
  function tagEmissive() {
    if (emissiveTagged) return;
    emissiveTagged = true;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!(mesh as unknown as { isMesh?: boolean }).isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const lit = mats.some((m) => {
        const s = m as THREE.MeshStandardMaterial;
        return !!s?.emissive && s.emissive.getHex() !== 0 && (s.emissiveIntensity ?? 1) > 0.1;
      });
      if (lit) mesh.layers.enable(1);
    });
  }

  const renderFrame = (target: THREE.Object3D, cam: THREE.Camera) => {
    if (insideFrame) {
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
      if (frames === 1) tagEmissive();
      if (autoQuality && frames > checkAfter) {
        slowFrames = fpsEma < 55 ? slowFrames + 1 : Math.max(0, slowFrames - 3);
        if (slowFrames > 45) {
          if (lowerQuality()) {
            slowFrames = 0;
            checkAfter = frames + 90;
          }
        }
      }

      // niente shadow pass interno: le ombre di contatto sono cotte nel decal

      if (composer && fallbackStep < 2) {
        if (bloomComposer && bloomMix && bloom && bloom.enabled) {
          bloomComposer.render();
          bloomMix.uniforms.tBloom.value = bloomComposer.readBuffer.texture;
          bloomMix.enabled = true;
        } else if (bloomMix) {
          bloomMix.enabled = false;
        }
        composer.render();
      } else {
        rawRender(target, cam);
      }
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
    bloomComposer?.setPixelRatio(renderer.getPixelRatio() * (COARSE ? 0.5 : 1));
    bloomComposer?.setSize(innerWidth, innerHeight);
    updateFxaa();
    gradeAspect();
    fitCamera();
  });

  return { renderer, scene, camera, sun, loadEnvironment, fitCamera };
}
