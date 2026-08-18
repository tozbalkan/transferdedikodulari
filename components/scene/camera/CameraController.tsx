'use client';

import { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { getInitialBroadcastCamera, type PitchGeometryInfo } from '@/lib/stadium/pitch-geometry';

interface CameraControllerProps {
  playerWorldPosition?: THREE.Vector3 | null;
  pitchInfo?: PitchGeometryInfo | null;
}

export function CameraController({
  playerWorldPosition = null,
  pitchInfo = null,
}: CameraControllerProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const isInitializedRef = useRef(false);
  const { camera } = useThree();

  const defaultTarget = pitchInfo ? pitchInfo.center : new THREE.Vector3(0, 0, -3);
  const pitchDiagonal = pitchInfo ? pitchInfo.diagonal : 125;
  const minDistance = Math.max(22, pitchDiagonal * 0.25);
  const maxDistance = Math.max(120, pitchDiagonal * 1.35);

  // Position camera once geometry is computed
  useEffect(() => {
    if (pitchInfo && !isInitializedRef.current && controlsRef.current) {
      const config = getInitialBroadcastCamera(pitchInfo, 46);
      camera.position.set(config.position.x, config.position.y, config.position.z);
      controlsRef.current.target.set(config.target.x, config.target.y, config.target.z);
      camera.lookAt(config.target.x, config.target.y, config.target.z);
      controlsRef.current.update();
      isInitializedRef.current = true;
    }
  }, [pitchInfo, camera]);

  // Contextual focus interpolation (smooth framing without losing pitch context)
  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    const currentTarget = controlsRef.current.target;

    if (playerWorldPosition) {
      // 1. Contextual target: lerp(pitchCenter, playerWorldPosition, 0.45)
      const contextualTarget = new THREE.Vector3().lerpVectors(
        defaultTarget,
        playerWorldPosition,
        0.45,
      );

      // Safe area compensation: shift framing slightly left so bottom-right detail panel does not occlude player
      contextualTarget.x -= 4.0;
      contextualTarget.y = 1.0;

      if (currentTarget.distanceTo(contextualTarget) > 0.05) {
        currentTarget.lerp(contextualTarget, Math.min(1, delta * 3.0));
        controlsRef.current.update();
      }

      // 2. Elevated broadcast camera position (distance ~42m, retaining ~65% pitch context)
      const idealCameraPos = new THREE.Vector3(
        contextualTarget.x - 14,
        30,
        contextualTarget.z + 36,
      );

      if (camera.position.distanceTo(idealCameraPos) > 0.15) {
        camera.position.lerp(idealCameraPos, Math.min(1, delta * 2.2));
      }
    } else {
      // Return smoothly to default pitch center broadcast view
      if (currentTarget.distanceTo(defaultTarget) > 0.05) {
        currentTarget.lerp(defaultTarget, Math.min(1, delta * 3.0));
        controlsRef.current.update();
      }

      if (pitchInfo) {
        const defaultCam = getInitialBroadcastCamera(pitchInfo, 46);
        const defaultCamPos = new THREE.Vector3(
          defaultCam.position.x,
          defaultCam.position.y,
          defaultCam.position.z,
        );
        if (camera.position.distanceTo(defaultCamPos) > 0.2) {
          camera.position.lerp(defaultCamPos, Math.min(1, delta * 2.0));
        }
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      target={[defaultTarget.x, defaultTarget.y, defaultTarget.z]}
      enableRotate
      enableZoom
      enablePan={false}
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={0.15} // Can look straight down onto pitch
      maxPolarAngle={Math.PI / 2.32} // Cannot dip below turf into stands
      rotateSpeed={0.65}
      zoomSpeed={0.85}
      enableDamping
      dampingFactor={0.08}
    />
  );
}
