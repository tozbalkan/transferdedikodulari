'use client';

import { useRef, useEffect, useMemo } from 'react';
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
  const isTransitioningRef = useRef(false);
  const isUserInteractingRef = useRef(false);

  const prevPlayerPosRef = useRef<THREE.Vector3 | null>(null);
  const targetGoalRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, -3));
  const cameraGoalRef = useRef<THREE.Vector3>(new THREE.Vector3(-2, 36, 46));

  const { camera } = useThree();

  const defaultTarget = useMemo(
    () => (pitchInfo ? pitchInfo.center : new THREE.Vector3(0, 0, -3)),
    [pitchInfo],
  );
  const pitchDiagonal = pitchInfo ? pitchInfo.diagonal : 125;
  const minDistance = Math.max(10, pitchDiagonal * 0.12);
  const maxDistance = Math.max(180, pitchDiagonal * 1.6);

  // Initial camera positioning once geometry is computed
  useEffect(() => {
    if (pitchInfo && !isInitializedRef.current && controlsRef.current) {
      const config = getInitialBroadcastCamera(pitchInfo, 46);
      camera.position.set(config.position.x, config.position.y, config.position.z);
      controlsRef.current.target.set(config.target.x, config.target.y, config.target.z);
      camera.lookAt(config.target.x, config.target.y, config.target.z);
      controlsRef.current.update();

      targetGoalRef.current.copy(config.target);
      cameraGoalRef.current.copy(config.position);
      isInitializedRef.current = true;
    }
  }, [pitchInfo, camera]);

  // Handle player selection and deselection transition goals
  useEffect(() => {
    // Check if playerWorldPosition changed
    const hadPrev = !!prevPlayerPosRef.current;
    const hasCurrent = !!playerWorldPosition;
    const posChanged =
      (hadPrev !== hasCurrent) ||
      (hadPrev && hasCurrent && prevPlayerPosRef.current!.distanceTo(playerWorldPosition!) > 0.1);

    if (posChanged) {
      prevPlayerPosRef.current = playerWorldPosition ? playerWorldPosition.clone() : null;

      if (playerWorldPosition) {
        // Player focus: contextual framing (player + surrounding tactical pitch)
        const contextualTarget = new THREE.Vector3().lerpVectors(
          defaultTarget,
          playerWorldPosition,
          0.45,
        );
        contextualTarget.x -= 3.5;
        contextualTarget.y = 1.0;

        const idealCameraPos = new THREE.Vector3(
          contextualTarget.x - 12,
          28,
          contextualTarget.z + 34,
        );

        targetGoalRef.current.copy(contextualTarget);
        cameraGoalRef.current.copy(idealCameraPos);
        isTransitioningRef.current = true;
      } else if (hadPrev && pitchInfo) {
        // Smoothly transition back to initial stadium overview on deselection
        const defaultCam = getInitialBroadcastCamera(pitchInfo, 46);
        targetGoalRef.current.copy(defaultCam.target);
        cameraGoalRef.current.copy(defaultCam.position);
        isTransitioningRef.current = true;
      }
    }
  }, [playerWorldPosition, pitchInfo, defaultTarget]);

  // Hook into OrbitControls user interaction events to immediately yield control
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const onStart = () => {
      isUserInteractingRef.current = true;
      isTransitioningRef.current = false; // User took over, cancel automated lerp
    };

    const onEnd = () => {
      isUserInteractingRef.current = false;
    };

    controls.addEventListener('start', onStart);
    controls.addEventListener('end', onEnd);

    return () => {
      controls.removeEventListener('start', onStart);
      controls.removeEventListener('end', onEnd);
    };
  }, []);

  // Frame animation: only active during animated transitions between views
  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    if (isTransitioningRef.current && !isUserInteractingRef.current) {
      const currentTarget = controlsRef.current.target;
      const targetDist = currentTarget.distanceTo(targetGoalRef.current);
      const camDist = camera.position.distanceTo(cameraGoalRef.current);

      if (targetDist > 0.04) {
        currentTarget.lerp(targetGoalRef.current, Math.min(1, delta * 3.5));
        controlsRef.current.update();
      }

      if (camDist > 0.08) {
        camera.position.lerp(cameraGoalRef.current, Math.min(1, delta * 2.8));
      }

      // Transition complete: release camera for free manual exploration
      if (targetDist <= 0.04 && camDist <= 0.08) {
        isTransitioningRef.current = false;
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      target={[defaultTarget.x, defaultTarget.y, defaultTarget.z]}
      enableRotate
      enableZoom
      enablePan
      screenSpacePanning
      minDistance={minDistance}
      maxDistance={maxDistance}
      minPolarAngle={0.05} // Allows high aerial top-down tactical overview
      maxPolarAngle={Math.PI / 2.05} // Wide sideline angle without clipping below turf
      rotateSpeed={0.75}
      zoomSpeed={0.9}
      panSpeed={0.8}
      enableDamping
      dampingFactor={0.06}
    />
  );
}

