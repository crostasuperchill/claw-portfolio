import './styles.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { BodyRef } from './contracts';
import { D } from './scene/dims';
import { createStudio } from './scene/studio';
import { buildDecalAtlas } from './scene/decals';
import { buildCabinet } from './scene/cabinet';
import { mergeStatic } from './scene/merge';
import { CapsuleField, makeCapsule } from './scene/capsules';
import { buildCharms } from './scene/charms';
import { addCapsule, addPlayfield, initPhysics } from './scene/physics';
import { Claw } from './scene/claw';
import { spawnLayout } from './game/layout';
import { PROJECTS, byId } from './game/roster';
import { Cycle, type Phase } from './game/machine';
import { createControls } from './ui/controls';
import { createPrizeCard } from './ui/prizeCard';
import { createAudio } from './ui/audio';
import { createHud } from './ui/hud';

// Vivid jewel-toned candy palette matching reference/target.png
const FILL_TINTS = ['#f43292', '#14c45c', '#f8c214', '#149cf8', '#8c42f2', '#f43854', '#18ccb8'];
const HOME = D.clawHomeY;

// Reference left-to-right hero showcase order:
// pink Tamagotchi -> silver GBA -> red Tamagotchi -> blue Front-end floppy -> pink 3D Art floppy -> grey Game Boy
const SHOWCASE_ORDER = ['jollycat', 'magicwall', 'zora', 'polaroids', 'contact', 'oracle'] as const;
const SHOWCASE_TILT_Z = [0.22, 0.24, -0.18, -0.2, -0.14, -0.26];
const SHOWCASE_TILT_Y = [0.14, 0.04, -0.02, -0.08, -0.04, -0.16];

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

async function boot() {
  const canvas = document.getElementById('stage') as HTMLCanvasElement;
  const bootEl = document.getElementById('boot') as HTMLElement;
  const bootFill = document.getElementById('boot-fill') as HTMLElement;
  const bootLabel = document.getElementById('boot-label') as HTMLElement;

  const studio = createStudio(canvas);
  bootFill.style.width = '20%';

  const atlas = buildDecalAtlas();
  const cabinet = buildCabinet(atlas.texture, atlas.rects);
  mergeStatic(cabinet.root, {
    skip: (mesh) => {
      let node: THREE.Object3D | null = mesh;
      while (node) {
        if (node.userData.noMerge) return true;
        node = node.parent;
      }
      return false;
    },
  });
  studio.scene.add(cabinet.root);
  bootFill.style.width = '42%';
  bootLabel.textContent = 'lighting the cabinet';

  void studio.loadEnvironment().then((kind) => console.log('env:', kind));

  const world = await initPhysics();
  addPlayfield(world, D.playfield.w, D.playfield.d, D.playfield.y, D.chute.x);
  bootFill.style.width = '62%';

  const spots = spawnLayout({
    seed: 20261122,
    count: 42,
    width: D.playfield.w,
    depth: D.playfield.d,
    radius: D.capsuleR,
    floorY: D.playfield.y,
    exclude: { x: D.chute.x, z: D.chute.z, w: 0.24, d: 0.24 },
  });
  // Pick 6 prominent top-layer spots spread across X and biased toward the front so all 6 hero toys are clearly visible
  const topLayer = [...spots].sort((a, b) => b.y - a.y).slice(0, 14);
  const byX = [...topLayer].sort((a, b) => a.x - b.x);
  const prizeSpots: typeof spots = [];
  for (let i = 0; i < PROJECTS.length; i++) {
    const bandStart = Math.floor((i * byX.length) / PROJECTS.length);
    const bandEnd = Math.max(bandStart + 1, Math.floor(((i + 1) * byX.length) / PROJECTS.length));
    const band = byX.slice(bandStart, bandEnd).filter((s) => !prizeSpots.includes(s));
    const pick = (band.length ? band : topLayer.filter((s) => !prizeSpots.includes(s))).sort(
      (a, b) => b.y * 2 + b.z * 1.4 - (a.y * 2 + a.z * 1.4)
    )[0];
    if (pick) prizeSpots.push(pick);
  }
  prizeSpots.sort((a, b) => a.x - b.x);
  // Within the middle pair [2, 3], put the frontmost spot in slot 2 (red Tamagotchi) and back/higher in slot 3 (blue floppy).
  if (prizeSpots.length >= 5 && prizeSpots[3].z > prizeSpots[2].z) {
    [prizeSpots[2], prizeSpots[3]] = [prizeSpots[3], prizeSpots[2]];
  }
  // Ensure slot 4 (pink 3D Art floppy) gets the higher spot between [3, 4] if needed.
  if (prizeSpots.length >= 5 && prizeSpots[3].y > prizeSpots[4].y + 0.02) {
    [prizeSpots[3], prizeSpots[4]] = [prizeSpots[4], prizeSpots[3]];
  }

  // Hanging charms suspended from the rear chrome rail so they sit cleanly behind the main claw plane
  // and physically swing/deflect if the claw moves near them.
  const charms = buildCharms({
    labels: [
      { text: 'Web Dev', color: '#ff82b8' },
      { text: 'UX/UI', color: '#4cd8d0' },
      { text: 'Front-end', color: '#4468ec' },
    ],
    topY: 1.288,
    z: -0.19,
    halfWidth: 0.34,
  });

  const refs = new Map<number, BodyRef>();
  const heroInitQuats = new Map<number, THREE.Quaternion>();
  const heroTumbleBlend = new Map<number, number>();
  const prizeRoot = new THREE.Group();
  studio.scene.add(prizeRoot);

  const orderedProjects = SHOWCASE_ORDER.map((id) => byId(id)).filter(
    (p): p is (typeof PROJECTS)[number] => Boolean(p)
  );
  const heroProjects = orderedProjects.length === PROJECTS.length ? orderedProjects : PROJECTS;

  heroProjects.forEach((p, i) => {
    const spot = prizeSpots[i];
    const mesh = makeCapsule({ project: p, radius: D.capsuleR });
    mergeStatic(mesh);
    mesh.position.set(spot.x, spot.y, spot.z);
    const initEuler = new THREE.Euler(
      -0.06,
      SHOWCASE_TILT_Y[i] ?? (i - 2.5) * 0.08,
      SHOWCASE_TILT_Z[i] ?? (i % 2 === 0 ? 1 : -1) * 0.18
    );
    const initQ = new THREE.Quaternion().setFromEuler(initEuler);
    mesh.quaternion.copy(initQ);
    prizeRoot.add(mesh);
    const { body, collider } = addCapsule(world, spot, D.capsuleR);
    heroInitQuats.set(collider.handle, initQ);
    heroTumbleBlend.set(collider.handle, 0);
    refs.set(collider.handle, { body, collider, projectId: p.id, mesh });
  });

  const fillSpots = spots.filter((s) => !prizeSpots.includes(s));
  const field = new CapsuleField(fillSpots.length, D.capsuleR);
  studio.scene.add(field.group);
  studio.scene.add(charms.group);
  const tmpMatrix = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpWobble = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler();
  const boxScale = new THREE.Vector3(1, 1, 1);
  fillSpots.forEach((spot, i) => {
    const { body, collider } = addCapsule(world, spot, D.capsuleR);
    field.setColor(i, FILL_TINTS[i % FILL_TINTS.length]);
    tmpPos.set(spot.x, spot.y, spot.z);
    tmpQuat.identity();
    field.setMatrix(i, tmpMatrix.compose(tmpPos, tmpQuat, boxScale));
    refs.set(collider.handle, { body, collider, projectId: null, instance: i });
  });
  field.commit();

  const claw = new Claw(world, refs);
  claw.target.set(-0.2, 0.02);
  claw.pos.set(-0.2, 0.02);
  claw.update(0, false);
  studio.scene.add(claw.root);

  bootFill.style.width = '84%';
  bootLabel.textContent = 'stocking the prizes';

  const cycle = new Cycle();
  const audio = createAudio();
  const hud = createHud();

  let collection = new Set<string>();
  try {
    collection = new Set(JSON.parse(localStorage.getItem('claw.collection') || '[]') as string[]);
  } catch {
    collection = new Set();
  }
  hud.set(collection);

  let cardOpen = false;
  const card = createPrizeCard({
    onClose: () => {
      cardOpen = false;
      cabinet.setButtonEnabled(true);
    },
  });

  let grabTried = false;
  let pendingPrize: BodyRef | null = null;
  let activeDropY: number = D.clawDropY;
  let fpsAvg = 60;

  const hint = document.getElementById('hint') as HTMLElement;
  setTimeout(() => hint.classList.add('show'), 900);

  function startCycle() {
    if (cycle.phase !== 'idle' || cardOpen) return;
    grabTried = false;
    pendingPrize = null;
    claw.release();
    claw.setGrip(1);
    claw.setHeight(HOME);
    // Compute full realistic drop depth beneath current (x, z) — down to prize equator or near-floor
    activeDropY = claw.computeDropHeight();
    cycle.start();
    cabinet.pressButton();
    cabinet.setButtonEnabled(false);
    hint.classList.remove('show');
    audio.button();
    audio.drop(1.0);
  }

  function enter(phase: Phase) {
    if (phase === 'close') {
      audio.clawClose();
    } else if (phase === 'carry') {
      claw.target.set(D.chute.x, D.chute.z);
      audio.motor(0.9);
    } else if (phase === 'lift') {
      if (claw.grabbed) audio.motor(0.8);
      else audio.fail();
    } else if (phase === 'release') {
      if (claw.grabbed) pendingPrize = claw.grabbed;
      claw.release();
      audio.release(!!claw.grabbed);
    } else if (phase === 'return') {
      claw.target.set(-0.2, 0.02);
      audio.motor(1.0);
    } else if (phase === 'idle') {
      cabinet.setButtonEnabled(true);
      claw.setHeight(HOME);
      claw.setGrip(1);
    }
  }

  function applyPhase() {
    if (cycle.phase === 'drop') {
      claw.setHeight(lerp(HOME, activeDropY, easeInOut(cycle.k)));
    } else if (cycle.phase === 'close') {
      claw.setGrip(1 - cycle.k);
      if (!grabTried && cycle.k > 0.52) {
        grabTried = true;
        claw.tryGrab();
        if (claw.grabbed) audio.grabSuccess();
      }
    } else if (cycle.phase === 'lift') {
      claw.setHeight(lerp(activeDropY, HOME, easeInOut(cycle.k)));
    }
  }

  function deliver(ref: BodyRef) {
    if (!ref.projectId) return;
    ref.collected = true;
    if (ref.mesh) ref.mesh.visible = false;
    if (ref.instance !== undefined) field.hide(ref.instance);
    const project = byId(ref.projectId);
    if (!project) return;
    const isNew = !collection.has(project.id);
    collection.add(project.id);
    localStorage.setItem('claw.collection', JSON.stringify([...collection]));
    hud.set(collection);
    cardOpen = true;
    card.show(project, isNew);
    cabinet.setButtonEnabled(false);
    audio.cardOpen();
    audio.deliver(isNew, collection.size >= PROJECTS.length);
    pendingPrize = null;
  }

  const stickWorld = new THREE.Vector3();
  function project(worldPos: THREE.Vector3) {
    const v = worldPos.clone().project(studio.camera);
    const r = canvas.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height };
  }
  function stickCenter() {
    const node = (cabinet as unknown as { stick?: THREE.Object3D }).stick;
    if (node) {
      node.getWorldPosition(stickWorld);
      stickWorld.y += 0.1;
    } else {
      stickWorld.set(-0.3, 0.16, 0.34);
    }
    return project(stickWorld);
  }
  function buttonCenter() {
    cabinet.buttonHit.getWorldPosition(stickWorld);
    return project(stickWorld);
  }

  let stickX = 0;
  let stickY = 0;
  let camOffX = 0;
  let camOffY = 0;

  createControls({
    canvas,
    camera: studio.camera,
    stickCenter,
    buttonCenter,
    canDrop: () => cycle.phase === 'idle' && !cardOpen,
    onStick: (x, y) => {
      audio.stick(x, y);
      stickX = x;
      stickY = y;
    },
    onPress: () => cabinet.pressButton(),
    onDrop: startCycle,
    onFirstGesture: () => audio.unlock(),
    onDragStart: () => hint.classList.remove('show'),
  });

  document.getElementById('btn-mute')?.addEventListener('click', (e) => {
    const muted = audio.toggle();
    (e.currentTarget as HTMLButtonElement).setAttribute('aria-pressed', String(muted));
  });

  let last = performance.now();
  let acc = 0;
  let shadowFrames = 0;

  function frame(now: number) {
    const dtRaw = (now - last) / 1000;
    last = now;
    const dt = Math.min(0.05, dtRaw);
    fpsAvg = fpsAvg * 0.94 + (1 / Math.max(dtRaw, 0.0001)) * 0.06;

    acc += dt;
    const canAim = cycle.phase === 'idle' && !cardOpen;
    const activelyAiming = canAim && Math.hypot(stickX, stickY) > 0.05;
    if (canAim) claw.aim(stickX * 0.58 * dt, -stickY * 0.48 * dt);

    // Subtle stick-driven camera parallax while aiming so Z depth reads intuitively
    const wantCamX = activelyAiming ? stickX * 0.14 : 0;
    const wantCamY = activelyAiming ? -stickY * 0.07 : 0;
    const camK = Math.min(1, dt * 6);
    camOffX += (wantCamX - camOffX) * camK;
    camOffY += (wantCamY - camOffY) * camK;
    studio.setParallax(camOffX, camOffY);

    // Fixed joystick tilt: pushing UP (stickY > 0 -> claw goes -Z into cabinet) tilts top of stick BACKWARD (-X rotation)
    const stick = (cabinet as unknown as { stick?: THREE.Object3D }).stick;
    if (stick) {
      const k = Math.min(1, dt * 18);
      stick.rotation.z += (-stickX * 0.52 - stick.rotation.z) * k;
      stick.rotation.x += (-stickY * 0.42 - stick.rotation.x) * k;
    }

    let steps = 0;
    while (acc >= 1 / 60 && steps < 3) {
      world.step();
      acc -= 1 / 60;
      steps++;
    }
    if (acc > 0.2) acc = 0.2;

    const before = cycle.phase;
    cycle.tick(dt);
    if (cycle.phase !== before) enter(cycle.phase);
    applyPhase();

    claw.update(dt, activelyAiming);
    cabinet.update(dt);
    charms.update(now / 1000, dt, claw.getCharmObstacles());

    const forceSync = shadowFrames < 3;
    let anyInstDirty = forceSync;
    let anyBodyAwake = false;
    for (const ref of refs.values()) {
      if (ref.collected) continue;
      if (!forceSync && ref.body.isSleeping()) continue;
      anyBodyAwake = true;
      const t = ref.body.translation();
      const r = ref.body.rotation();
      if (ref.instance !== undefined) {
        tmpPos.set(t.x, t.y, t.z);
        tmpQuat.set(r.x, r.y, r.z, r.w);
        field.setMatrix(ref.instance, tmpMatrix.compose(tmpPos, tmpQuat, boxScale));
        anyInstDirty = true;
      } else if (ref.mesh) {
        ref.mesh.position.set(t.x, t.y, t.z);
        const initQ = heroInitQuats.get(ref.collider.handle);
        const isFree = ref === claw.grabbed || ref === pendingPrize;
        const prevBlend = heroTumbleBlend.get(ref.collider.handle) ?? 0;
        const nextBlend = prevBlend + ((isFree ? 1 : 0) - prevBlend) * Math.min(1, dt * 8);
        heroTumbleBlend.set(ref.collider.handle, nextBlend);

        if (initQ) {
          // While resting on the capsule pile, keep the hero gadget facing forward (never rolled
          // face-down by the underlying sphere collider) with subtle real-time velocity wobble.
          // Once grabbed or falling into the chute, smoothly blend to full 3D Rapier rigid-body tumble!
          const av = ref.body.angvel();
          tmpEuler.set(
            THREE.MathUtils.clamp(av.x * 0.08, -0.22, 0.22),
            THREE.MathUtils.clamp(av.y * 0.06, -0.18, 0.18),
            THREE.MathUtils.clamp(av.z * 0.08, -0.22, 0.22)
          );
          tmpWobble.setFromEuler(tmpEuler).multiply(initQ);
          if (nextBlend > 0.01) {
            tmpQuat.set(r.x, r.y, r.z, r.w).multiply(initQ);
            ref.mesh.quaternion.copy(tmpWobble).slerp(tmpQuat, nextBlend);
          } else {
            ref.mesh.quaternion.copy(tmpWobble);
          }
        } else {
          ref.mesh.quaternion.set(r.x, r.y, r.z, r.w);
        }
      }
    }
    if (anyInstDirty) field.commit();

    if (pendingPrize) {
      const t = pendingPrize.body.translation();
      if (t.y < 0.56) deliver(pendingPrize);
    }

    const lost: BodyRef[] = [];
    for (const ref of refs.values()) {
      if (ref.collected || ref === pendingPrize) continue;
      if (ref.body.translation().y < 0.62) lost.push(ref);
    }
    for (const ref of lost) {
      ref.collected = true;
      if (ref.mesh) ref.mesh.visible = false;
      if (ref.instance !== undefined) field.hide(ref.instance);
      refs.delete(ref.collider.handle);
      world.removeRigidBody(ref.body);
    }

    // Keep shadow map crisp and live whenever the claw or any capsule is moving,
    // without wasting GPU work while the scene is completely still.
    if (shadowFrames >= 2 && (claw.isMoving || anyBodyAwake)) {
      studio.sun.shadow.needsUpdate = true;
    }

    studio.renderer.render(studio.scene, studio.camera);
    shadowFrames++;
    if (shadowFrames === 2) studio.sun.shadow.autoUpdate = false;
    requestAnimationFrame(frame);
  }

  studio.renderer.compile(studio.scene, studio.camera);

  const api = {
    ready: false,
    state: () => cycle.phase,
    aim: (x: number, z: number) => claw.target.set(x, z),
    drop: startCycle,
    fps: () => fpsAvg,
    info: () => ({
      calls: studio.renderer.info.render.calls,
      tris: studio.renderer.info.render.triangles,
    }),
    stats: () => {
      const out: Record<string, number> = {};
      let meshes = 0;
      studio.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!(m as unknown as { isMesh?: boolean }).isMesh) return;
        meshes++;
        const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material | undefined;
        const key = `${mat?.type ?? 'none'}:${(mat as THREE.MeshStandardMaterial)?.color?.getHexString?.() ?? ''}`;
        out[key] = (out[key] ?? 0) + 1;
      });
      return { meshes, buckets: Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 12) };
    },
    probe: () => claw.probe(),
    target: () => ({ x: claw.target.x, z: claw.target.y }),
    stickScreen: () => stickCenter(),
    buttonScreen: () => buttonCenter(),
    ui: () => {
      const s = (cabinet as unknown as { stick?: THREE.Object3D }).stick;
      return {
        stickChildren: s?.children.length ?? -1,
        rotX: s ? +s.rotation.x.toFixed(3) : -99,
        rotZ: s ? +s.rotation.z.toFixed(3) : -99,
        stickWorld: s ? s.getWorldPosition(new THREE.Vector3()).toArray().map((n) => +n.toFixed(3)) : null,
        capY: +(cabinet as unknown as { capGroup?: THREE.Object3D }).capGroup!.position.y.toFixed(4),
      };
    },
    hitAt: (x: number, y: number) => {
      const rc = new THREE.Raycaster();
      const r = canvas.getBoundingClientRect();
      rc.setFromCamera(
        new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1),
        studio.camera
      );
      const hits = rc.intersectObject(cabinet.buttonHit, true);
      return { hit: hits.length > 0, dist: hits[0]?.distance ?? null };
    },
    debug: () => ({
      grabbed: claw.grabbed?.projectId ?? null,
      joint: claw.hasJoint,
      pending: pendingPrize?.projectId ?? null,
      grabTried,
      cardOpen,
      activeDropY: +activeDropY.toFixed(3),
    }),
    projectPos: (id: string) => {
      const ref = [...refs.values()].find((r) => r.projectId === id);
      if (!ref) return null;
      const t = ref.body.translation();
      return { x: +t.x.toFixed(3), y: +t.y.toFixed(3), z: +t.z.toFixed(3) };
    },
    whatBelow: () => {
      const p = pendingPrize?.body.translation();
      if (!p) return null;
      const ray = new RAPIER.Ray({ x: p.x, y: p.y - 0.08, z: p.z }, { x: 0, y: -1, z: 0 });
      const hit = world.castRay(ray, 0.5, true);
      if (!hit) return { hit: null };
      const col = hit.collider;
      const t = col.translation();
      return {
        toi: +hit.timeOfImpact.toFixed(3),
        shape: col.shape.type,
        at: { x: +t.x.toFixed(3), y: +t.y.toFixed(3), z: +t.z.toFixed(3) },
        half: 'halfExtents' in col.shape ? (col.shape as { halfExtents: unknown }).halfExtents : null,
        radius: 'radius' in col.shape ? (col.shape as { radius: number }).radius : null,
      };
    },
    testGrab: (id: string) =>
      new Promise<boolean>((resolve) => {
        const ref = [...refs.values()].find((r) => r.projectId === id && !r.collected);
        if (!ref) return resolve(false);
        const t = ref.body.translation();
        claw.target.set(t.x, t.z);
        claw.pos.set(t.x, t.z);
        claw.setHeight(HOME);
        claw.update(0, false);
        const t0 = performance.now();
        const poll = () => {
          if (cardOpen) return resolve(true);
          if (performance.now() - t0 > 30000) return resolve(false);
          requestAnimationFrame(poll);
        };
        startCycle();
        poll();
      }),
  };
  (window as unknown as { __claw: typeof api }).__claw = api;

  requestAnimationFrame((t) => {
    last = t;
    frame(t);
    bootFill.style.width = '100%';
    setTimeout(() => bootEl.classList.add('done'), 220);
    api.ready = true;
  });
}

void boot();
