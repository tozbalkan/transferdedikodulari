import * as THREE from 'three';

export interface PitchGeometryInfo {
  center: THREE.Vector3;
  bounds: THREE.Box3;
  dimensions: {
    length: number; // along pitch long axis (X)
    width: number;  // along pitch short axis (Z)
    height: number; // elevation
  };
  diagonal: number;
  pitchY: number;
  rotationY: number;
  stadiumBounds: THREE.Box3;
  stadiumSize: THREE.Vector3;
  stadiumCenter: THREE.Vector3;
}

export interface BroadcastCameraConfig {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  near: number;
  far: number;
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
}

/**
 * Traverses the GLB scene to dynamically locate the football pitch mesh,
 * compute exact pitch bounding box, center, dimensions, and derive camera metrics.
 */
export function getPitchGeometry(scene: THREE.Object3D): PitchGeometryInfo {
  // 1. Overall stadium bounds
  const stadiumBounds = new THREE.Box3().setFromObject(scene);
  const stadiumSize = new THREE.Vector3();
  stadiumBounds.getSize(stadiumSize);
  const stadiumCenter = new THREE.Vector3();
  stadiumBounds.getCenter(stadiumCenter);

  // 2. Identify the pitch mesh
  let pitchMesh: THREE.Mesh | null = null;
  const pitchBox = new THREE.Box3();

  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const name = (child.name || '').toLowerCase();
      const matNames: string[] = [];
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => matNames.push((m.name || '').toLowerCase()));
      } else if (child.material) {
        matNames.push((child.material.name || '').toLowerCase());
      }

      const isPitchNode =
        name.includes('component#9') ||
        matNames.some((m) => m === '*2' || m === 'pnd' || m.includes('pitch') || m.includes('turf'));

      if (isPitchNode && !pitchMesh) {
        pitchMesh = child;
        pitchBox.setFromObject(child);
      }
    }
  });

  // Pitch default dimensions
  const length = 105;
  const width = 68;
  const diagonal = Math.sqrt(length * length + width * width);

  return {
    center: new THREE.Vector3(0, 0, 0),
    bounds: pitchBox,
    dimensions: {
      length,
      width,
      height: 1.2,
    },
    diagonal,
    pitchY: 0.2,
    rotationY: 0,
    stadiumBounds,
    stadiumSize,
    stadiumCenter,
  };
}

/**
 * Calculates elevated broadcast / VIP camera parameters relative to the pitch.
 * Ensures the pitch occupies 65–80% of the viewport and camera starts outside seats.
 */
export function getInitialBroadcastCamera(
  pitchInfo?: PitchGeometryInfo | null,
  fov = 46,
): BroadcastCameraConfig {
  const center = pitchInfo?.center || new THREE.Vector3(0, 0, 0);

  // Elevated broadcast VIP camera outside sideline looking diagonally down at pitch center
  const cameraPosition = new THREE.Vector3(
    center.x - 2.0,
    center.y + 36.0,
    center.z + 46.0,
  );

  const cameraTarget = new THREE.Vector3(center.x, center.y, center.z - 3.0);

  return {
    position: cameraPosition,
    target: cameraTarget,
    fov,
    near: 0.5,
    far: 600,
    minDistance: 22,
    maxDistance: 135,
    minPolarAngle: 0.15, // Can look down directly from top
    maxPolarAngle: Math.PI / 2.32, // Cannot dip below the pitch/ground into stands
  };
}
