'use client';

import { useRef } from 'react';
import type * as THREE from 'three';
import { TransferPlayerModel } from './TransferPlayerModel';
import { TransferPlayerRing } from './TransferPlayerRing';
import { TransferPlayerLabel } from './TransferPlayerLabel';
import type { TransferPlayerEntity } from './transfer-player-types';

interface TransferPlayerProps {
  player: TransferPlayerEntity;
  isHovered?: boolean;
  isSelected?: boolean;
  onHover?: (id: string | null) => void;
  onSelect?: (player: TransferPlayerEntity) => void;
}

export function TransferPlayer({
  player,
  isHovered = false,
  isSelected = false,
  onHover,
  onSelect,
}: TransferPlayerProps) {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group
      ref={groupRef}
      position={player.localPitchPosition}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover?.(player.id);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onHover?.(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(player);
      }}
    >
      {/* ─── 1. Ground Transfer Highlight Ring ────────────────────────────── */}
      <TransferPlayerRing
        status={player.transferStatus}
        isHovered={isHovered}
        isSelected={isSelected}
      />

      {/* ─── 2. Stylized 3D Footballer Model (~1.85m human height) ─────────── */}
      <TransferPlayerModel isHovered={isHovered} isSelected={isSelected} />

      {/* ─── 3. Billboarded Label & Stem Indicator ────────────────────────── */}
      <TransferPlayerLabel
        player={player}
        isHovered={isHovered}
        isSelected={isSelected}
        onSelect={onSelect}
      />
    </group>
  );
}
