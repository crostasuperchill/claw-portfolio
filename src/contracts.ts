import type * as THREE from 'three';
import type { Collider, RigidBody } from '@dimforge/rapier3d-compat';
import type { Project } from './game/roster';

export type UvRect = { x: number; y: number; w: number; h: number };

export type Studio = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  loadEnvironment: () => Promise<'hdri' | 'room'>;
  fitCamera: () => void;
};

export type Cabinet = {
  root: THREE.Group;
  glass: THREE.MeshPhysicalMaterial;
  buttonHit: THREE.Object3D;
  pressButton: () => void;
  setButtonEnabled: (on: boolean) => void;
};

export type BodyRef = {
  body: RigidBody;
  collider: Collider;
  projectId: string | null;
  mesh?: THREE.Object3D;
  instance?: number;
  collected?: boolean;
};

export type CapsuleOptions = {
  project?: Project;
  radius: number;
  seed?: number;
  tint?: string;
};
