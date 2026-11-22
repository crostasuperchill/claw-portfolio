import * as THREE from 'three';
import { D } from './dims';

export const plastic = (color: string, opts: Partial<THREE.MeshPhysicalMaterialParameters> = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.1,
    ...opts,
  });

export const chrome = () =>
  new THREE.MeshPhysicalMaterial({
    color: '#dfe3e8',
    metalness: 1,
    roughness: 0.12,
    envMapIntensity: 1.4,
  });

export const matte = (color: string) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });

export const glow = (color: string, intensity = 1.4) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0,
  });

export const PALETTE = D.colors;
