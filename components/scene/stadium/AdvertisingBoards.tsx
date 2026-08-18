'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AD_BOARD_BG, AD_BOARD_GLOW, GS_RED } from '@/lib/colors';
import { PITCH_LENGTH, PITCH_WIDTH } from './Pitch';

const BOARD_HEIGHT = 0.28;
const BOARD_THICKNESS = 0.08;
const OFFSET_X = PITCH_WIDTH / 2 + 0.8;
const OFFSET_Z = PITCH_LENGTH / 2 + 0.8;

function SingleBoard({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <group position={position}>
      {/* Board Base Structure */}
      <mesh position={[0, BOARD_HEIGHT / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={AD_BOARD_BG} roughness={0.8} />
      </mesh>
      {/* LED Display Screen Strip */}
      <mesh position={[0, BOARD_HEIGHT * 0.55, 0]}>
        <boxGeometry args={[size[0] * 0.98, size[1] * 0.7, size[2] * 1.05]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

export function AdvertisingBoards() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    // Very subtle breathing pulse for LED electronic boards
    const pulse = 0.5 + Math.sin(state.clock.elapsedTime * 1.2) * 0.15;
    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
        if (child.material.emissiveIntensity > 0) {
          child.material.emissiveIntensity = pulse;
        }
      }
    });
  });

  return (
    <group ref={groupRef}>
      {/* East & West Touchline Boards */}
      <SingleBoard
        position={[-OFFSET_X, 0, 0]}
        size={[BOARD_THICKNESS, BOARD_HEIGHT, PITCH_LENGTH + 0.5]}
        color={AD_BOARD_GLOW}
      />
      <SingleBoard
        position={[OFFSET_X, 0, 0]}
        size={[BOARD_THICKNESS, BOARD_HEIGHT, PITCH_LENGTH + 0.5]}
        color={GS_RED}
      />

      {/* North & South Behind Goals Boards (Split for goal clearance) */}
      {/* North Left */}
      <SingleBoard
        position={[-(PITCH_WIDTH / 4 + 1.2), 0, -OFFSET_Z]}
        size={[PITCH_WIDTH / 2, BOARD_HEIGHT, BOARD_THICKNESS]}
        color={GS_RED}
      />
      {/* North Right */}
      <SingleBoard
        position={[PITCH_WIDTH / 4 + 1.2, 0, -OFFSET_Z]}
        size={[PITCH_WIDTH / 2, BOARD_HEIGHT, BOARD_THICKNESS]}
        color={AD_BOARD_GLOW}
      />

      {/* South Left */}
      <SingleBoard
        position={[-(PITCH_WIDTH / 4 + 1.2), 0, OFFSET_Z]}
        size={[PITCH_WIDTH / 2, BOARD_HEIGHT, BOARD_THICKNESS]}
        color={AD_BOARD_GLOW}
      />
      {/* South Right */}
      <SingleBoard
        position={[PITCH_WIDTH / 4 + 1.2, 0, OFFSET_Z]}
        size={[PITCH_WIDTH / 2, BOARD_HEIGHT, BOARD_THICKNESS]}
        color={GS_RED}
      />
    </group>
  );
}
