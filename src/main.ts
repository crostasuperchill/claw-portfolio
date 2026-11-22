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
import { addCapsule, addPlayfield, initPhysics } from './scene/physics';
import { Claw } from './scene/claw';
import { spawnLayout } from './game/layout';
import { PROJECTS, byId } from './game/roster';
import { Cycle, type Phase } from './game/machine';
import { createControls } from './ui/controls';
import { createPrizeCard } from './ui/prizeCard';
import { createAudio } from './ui/audio';
import { createHud } from './ui/hud';

const FILL_TINTS = ['#f7c9d9', '#bcd6ff', '#ffe6a7', '#c8f0e0', '#e3d2ff', '#ffd6bd'];
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
  mergeStatic(cabinet.root);
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
    audio.servo(1.0);
  }

  function enter(phase: Phase) {
    if (phase === 'carry') {
      claw.target.set(D.chute.x, D.chute.z);
      audio.servo(0.9);
    } else if (phase === 'release') {
      if (claw.grabbed) pendingPrize = claw.grabbed;
      claw.release();
      audio.clink();
    } else if (phase === 'return') {
      claw.target.set(0, 0.02);
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
        audio.clack();
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
    audio.win();
    pendingPrize = null;
  }

  const stickWorld = new THREE.Vector3();
  function stickCenter() {
    const node = (cabinet as unknown as { stick?: THREE.Object3D }).stick;
    if (node) {
      node.getWorldPosition(stickWorld);
      stickWorld.y += 0.05;
    } else {
      stickWorld.set(-0.3, 0.16, 0.34);
    }
    const v = stickWorld.clone().project(studio.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
  }

  let stickX = 0;
  let stickY = 0;

  createControls({
    canvas,
    camera: studio.camera,
    hitTarget: cabinet.buttonHit,
    stickCenter,
    canDrop: () => cycle.phase === 'idle' && !cardOpen,
    onStick: (x, y) => {
      stickX = x;
      stickY = y;
      const node = (cabinet as unknown as { stick?: THREE.Object3D }).stick;
      if (node) {
        node.rotation.z = -x * 0.42;
        node.rotation.x = y * 0.32;
      }
    },
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

    for (const ref of refs.values()) {
      if (ref.collected) continue;
      const t = ref.body.translation();
      const r = ref.body.rotation();
      if (ref.instance !== undefined) {
        tmpPos.set(t.x, t.y, t.z);
        tmpQuat.set(r.x, r.y, r.z, r.w);
        field.setMatrix(ref.instance, tmpMatrix.compose(tmpPos, tmpQuat, boxScale));
      } else if (ref.mesh) {
        ref.mesh.position.set(t.x, t.y, t.z);
        ref.mesh.quaternion.set(r.x, r.y, r.z, r.w);
      }
    }
    field.commit();

    if (pendingPrize) {
      const t = pendingPrize.body.translation();
      if (t.y < 0.56) deliver(pendingPrize);
    }

    // capsule cadute nello chute e non premiate: via, altrimenti si impilano nel pozzo
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

  requestAnimationFrame((t) => {
    last = t;
    frame(t);
    bootFill.style.width = '100%';
    setTimeout(() => bootEl.classList.add('done'), 220);
    (window as unknown as { __claw: Record<string, unknown> }).__claw.ready = true;
  });

  (window as unknown as { __claw: Record<string, unknown> }).__claw = {
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
}

void boot();
