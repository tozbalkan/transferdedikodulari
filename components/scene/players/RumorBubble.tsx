'use client';

import { useRef, useMemo } from 'react';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import type { TransferRumor } from '@/types/transfer';
import {
  BUBBLE_HIGH_CONFIDENCE,
  BUBBLE_MED_CONFIDENCE,
  BUBBLE_LOW_CONFIDENCE,
  BUBBLE_SELECTED,
  GS_RED,
  GS_YELLOW,
} from '@/lib/colors';
import { PlayerGlow } from './PlayerGlow';
import { PlayerLabel } from './PlayerLabel';

interface RumorBubbleProps {
  rumor: TransferRumor;
  position: [number, number, number];
  isHovered: boolean;
  isSelected: boolean;
  maxMentions: number;
  onHover: (id: string | null) => void;
  onSelect: (rumor: TransferRumor) => void;
}

export function RumorBubble({
  rumor,
  position,
  isHovered,
  isSelected,
  maxMentions,
  onHover,
  onSelect,
}: RumorBubbleProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // ─── Color Mapping (Confidence, Trend, & Brand Accents) ───────────────────
  const bubbleColor = useMemo(() => {
    if (isSelected) return BUBBLE_SELECTED;
    if (rumor.trend === 'DOWN') return GS_RED;
    const conf = rumor.confidenceScore ?? 0.5;
    if (conf >= 0.8) return BUBBLE_HIGH_CONFIDENCE;
    if (conf >= 0.55) return BUBBLE_MED_CONFIDENCE;
    return BUBBLE_LOW_CONFIDENCE;
  }, [isSelected, rumor.trend, rumor.confidenceScore]);

  // ─── Holographic Radar Node Scale Hierarchy for 105m Pitch ───────────────
  const baseRadius = useMemo(() => {
    const minRadius = 1.1;
    const maxRadius = 2.4;
    const mentionCount = Math.max(1, rumor.mentionCount);
    const safeMax = Math.max(20, maxMentions);

    const norm = Math.pow(Math.log(mentionCount + 1) / Math.log(safeMax + 1), 0.85);
    return minRadius + norm * (maxRadius - minRadius);
  }, [rumor.mentionCount, maxMentions]);

  const activeScale = isSelected ? 1.25 : isHovered ? 1.15 : 1.0;
  const currentRadius = baseRadius * activeScale;

  // ─── Holographic Energy Distortion & Pulsing ─────────────────────────────
  const distortAmount = 0.08 + Math.min(0.12, (rumor.mentionCount / 100) * 0.06);
  const distortSpeed = 1.2 + Math.min(1.2, (rumor.mentionCount / 100) * 0.5);
  const emissiveIntensity = isSelected ? 1.4 : isHovered ? 1.1 : 0.75;

  return (
    <group position={position}>
      {/* Ground Projection Beam & Concentric Tactical Radar Rings */}
      <PlayerGlow
        color={bubbleColor}
        isHovered={isHovered}
        isSelected={isSelected}
        scale={currentRadius}
        nodeHeight={position[1]}
      />

      {/* Floating Holographic Energy Core */}
      <Float
        speed={1.4}
        rotationIntensity={0.15}
        floatIntensity={isSelected ? 0.08 : 0.2}
        floatingRange={[-0.08, 0.08]}
      >
        {/* Core Bubble Sphere */}
        <mesh
          ref={meshRef}
          position={[0, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(rumor);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
            onHover(rumor.player.id);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'auto';
            onHover(null);
          }}
        >
          <sphereGeometry args={[currentRadius, 36, 36]} />
          <MeshDistortMaterial
            color={bubbleColor}
            emissive={bubbleColor}
            emissiveIntensity={emissiveIntensity}
            distort={distortAmount}
            speed={distortSpeed}
            roughness={0.15}
            metalness={0.4}
            transparent
            opacity={0.92}
          />
        </mesh>

        {/* Soft Inner Halo Glow Sphere (Galatasaray Gold) */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[currentRadius * 0.7, 16, 16]} />
          <meshBasicMaterial color={GS_YELLOW} transparent opacity={0.4} />
        </mesh>

        {/* 3D Compact Label (Centered below the node) */}
        <PlayerLabel
          player={rumor.player}
          mentionCount={rumor.mentionCount}
          score={rumor.score}
          isHovered={isHovered}
          isSelected={isSelected}
          yOffset={-(currentRadius + 0.8)}
        />
      </Float>
    </group>
  );
}
