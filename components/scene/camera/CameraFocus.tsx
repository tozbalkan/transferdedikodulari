'use client';

import { useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { Player3DPosition } from '../players/player-position';

interface CameraFocusProps {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  targetPosition: Player3DPosition | null;
}

const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);

export function CameraFocus({ controlsRef, targetPosition }: CameraFocusProps) {
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    const lerpSpeed = Math.min(delta * 3.5, 0.15);

    if (targetPosition) {
      // Focus target slightly elevated above the player bubble
      const desiredTarget = new THREE.Vector3(
        targetPosition.x,
        targetPosition.y + 0.3,
        targetPosition.z,
      );

      // Smoothly interpolate controls target
      controlsRef.current.target.lerp(desiredTarget, lerpSpeed);

      // Smoothly interpolate camera position to cinematic angle facing the player
      const offset = new THREE.Vector3(
        targetPosition.x * 0.4,
        targetPosition.y + 4.5,
        targetPosition.z + 8.5,
      );
      camera.position.lerp(offset, lerpSpeed * 0.8);
    } else {
      // Return to default stadium overview target if needed
      controlsRef.current.target.lerp(DEFAULT_TARGET, lerpSpeed * 0.5);
    }

    controlsRef.current.update();
  });

  return null;
}
