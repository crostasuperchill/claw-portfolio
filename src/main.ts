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

const FILL_TINTS = ['#ff88bc', '#66c2ff', '#ffe066', '#6be8be', '#b894ff', '#ffa375'];
const HOME = D.clawHomeY;
const DROP = D.clawDropY;

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
    count: 24,
    width: D.playfield.w,
    depth: D.playfield.d,
    radius: D.capsuleR,
    floorY: D.playfield.y,
    exclude: { x: D.chute.x, z: D.chute.z, w: 0.24, d: 0.24 },
  });
  const sorted = [...spots].sort((a, b) => b.y - a.y);
  const prizeSpots = sorted.slice(0, PROJECTS.length);

  const refs = new Map<number, BodyRef>();
  const prizeRoot = new THREE.Group();
  studio.scene.add(prizeRoot);

  PROJECTS.forEach((p, i) => {
    const spot = prizeSpots[i];
    const mesh = makeCapsule({ project: p, radius: D.capsuleR });
    mergeStatic(mesh);
    mesh.position.set(spot.x, spot.y, spot.z);
    prizeRoot.add(mesh);
    const { body, collider } = addCapsule(world, spot, D.capsuleR);
    refs.set(collider.handle, { body, collider, projectId: p.id, mesh });
  });

  const fillSpots = spots.filter((s) => !prizeSpots.includes(s));
  const field = new CapsuleField(fillSpots.length, D.capsuleR);
  studio.scene.add(field.group);

  const charms = buildCharms({
    labels: [
      { text: 'Web Dev', color: '#ff82b8' },
      { text: 'Front-end', color: '#4cb5ff' },
      { text: 'UX/UI', color: '#5ee0c4' },
      { text: '3D Art', color: '#b492ff' },
    ],
    topY: 1.29,
    z: -0.17,
    halfWidth: 0.34,
  });
  studio.scene.add(charms.group);
  const tmpMatrix = new THREE.Matrix4();
  const tmpPos = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
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
      claw.target.set(0, 0.02);
      audio.motor(1.0);
    } else if (phase === 'idle') {
      cabinet.setButtonEnabled(true);
      claw.setHeight(HOME);
      claw.setGrip(1);
    }
  }

  function applyPhase() {
    if (cycle.phase === 'drop') {
      claw.setHeight(lerp(HOME, DROP, easeInOut(cycle.k)));
    } else if (cycle.phase === 'close') {
      claw.setGrip(1 - cycle.k);
      if (!grabTried && cycle.k > 0.55) {
        grabTried = true;
        claw.tryGrab();
        if (claw.grabbed) audio.grabSuccess();
      }
    } else if (cycle.phase === 'lift') {
      claw.setHeight(lerp(DROP, HOME, easeInOut(cycle.k)));
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
  function project(world: THREE.Vector3) {
    const v = world.clone().project(studio.camera);
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
    if (cycle.phase === 'idle' && !cardOpen) claw.aim(stickX * 0.42 * dt, -stickY * 0.3 * dt);

    const stick = (cabinet as unknown as { stick?: THREE.Object3D }).stick;
    if (stick) {
      const k = Math.min(1, dt * 16);
      stick.rotation.z += (-stickX * 0.5 - stick.rotation.z) * k;
      stick.rotation.x += (stickY * 0.38 - stick.rotation.x) * k;
    }
    let steps = 0;
    while (acc >= 1 / 60 && steps < 2) {
      world.step();
      acc -= 1 / 60;
      steps++;
    }
    if (acc > 0.2) acc = 0.2;

    const before = cycle.phase;
    cycle.tick(dt);
    if (cycle.phase !== before) enter(cycle.phase);
    applyPhase();

    claw.update(dt);
    cabinet.update(dt);
    charms.update(now / 1000);

    const forceSync = shadowFrames < 3;
    let anyInstDirty = forceSync;
    for (const ref of refs.values()) {
      if (ref.collected) continue;
      if (!forceSync && ref.body.isSleeping()) continue;
      const t = ref.body.translation();
      const r = ref.body.rotation();
      if (ref.instance !== undefined) {
        tmpPos.set(t.x, t.y, t.z);
        tmpQuat.set(r.x, r.y, r.z, r.w);
        field.setMatrix(ref.instance, tmpMatrix.compose(tmpPos, tmpQuat, boxScale));
        anyInstDirty = true;
      } else if (ref.mesh) {
        ref.mesh.position.set(t.x, t.y, t.z);
        ref.mesh.quaternion.set(r.x, r.y, r.z, r.w);
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
        claw.update(0);
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
