'use client';

import * as THREE from 'three';

interface PlayerGlowProps {
  color: string;
  isHovered: boolean;
  isSelected: boolean;
  scale?: number;
  nodeHeight?: number;
}

export function PlayerGlow({
  color,
  isHovered,
  isSelected,
  scale = 2.0,
  nodeHeight = 1.6,
}: PlayerGlowProps) {
  const ringScale = isSelected ? scale * 2.2 : isHovered ? scale * 1.8 : scale * 1.4;
  const opacity = isSelected ? 0.95 : isHovered ? 0.75 : 0.45;

  return (
    <group>
      {/* ─── 1. Vertical Energy Beam (From Node down to Pitch) ──────────── */}
      <mesh position={[0, -nodeHeight / 2, 0]}>
        <cylinderGeometry args={[0.04, 0.08, nodeHeight, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isSelected ? 0.7 : isHovered ? 0.45 : 0.25}
        />
      </mesh>

      {/* ─── 2. Concentric Tactical Radar Rings on Pitch Surface ─────────── */}
      <group position={[0, -nodeHeight + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {/* Outer Radar Ring */}
        <mesh scale={ringScale}>
          <ringGeometry args={[0.85, 0.95, 36]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} />
        </mesh>

        {/* Middle Pulse Ring */}
        <mesh scale={ringScale * 0.65}>
          <ringGeometry args={[0.85, 0.92, 36]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={opacity * 0.7}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Inner Ground Glow Disc */}
        <mesh scale={ringScale * 0.8}>
          <circleGeometry args={[0.85, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={opacity * 0.25}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}
