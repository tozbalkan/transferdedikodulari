'use client';

import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { HSL_COLORS } from '@/lib/constants/colors';
import type { TransferPlayerEntity } from './transfer-player-types';

interface TransferPlayerLabelProps {
  player: TransferPlayerEntity;
  isHovered?: boolean;
  isSelected?: boolean;
  onSelect?: (entity: TransferPlayerEntity) => void;
}

export function TransferPlayerLabel({
  player,
  isHovered = false,
  isSelected = false,
  onSelect,
}: TransferPlayerLabelProps) {
  // Thin vertical indicator stem line from player head (1.80m) to badge (2.35m)
  const lineMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: isSelected
          ? HSL_COLORS.GS_GOLD
          : isHovered
            ? HSL_COLORS.WHITE_LINES
            : HSL_COLORS.INDICATOR_SLATE,
        transparent: true,
        opacity: isSelected ? 0.9 : isHovered ? 0.75 : 0.45,
      }),
    [isHovered, isSelected],
  );

  const statusBadgeBg = useMemo(() => {
    switch (player.transferStatus) {
      case 'AGREEMENT':
        return 'bg-[hsla(160,84%,39%,0.25)] text-[hsl(160,84%,65%)] border-[hsla(160,84%,39%,0.4)]';
      case 'ADVANCED':
        return 'bg-[hsla(43,98%,53%,0.25)] text-[hsl(43,98%,65%)] border-[hsla(43,98%,53%,0.4)]';
      case 'CONTACT':
        return 'bg-[hsla(38,92%,50%,0.25)] text-[hsl(38,92%,65%)] border-[hsla(38,92%,50%,0.4)]';
      case 'RUMORED':
      default:
        return 'bg-[hsla(0,84%,60%,0.25)] text-[hsl(0,84%,75%)] border-[hsla(0,84%,60%,0.4)]';
    }
  }, [player.transferStatus]);

  return (
    <group position={[0, 0, 0]}>
      {/* ─── Thin Vertical Indicator Stem ─────────────────────────────────── */}
      <mesh position={[0, 2.05, 0]} material={lineMaterial}>
        <cylinderGeometry args={[0.008, 0.008, 0.50, 8]} />
      </mesh>
      {/* Small anchor dot at head */}
      <mesh position={[0, 1.80, 0]} material={lineMaterial}>
        <sphereGeometry args={[0.025, 8, 8]} />
      </mesh>
      {/* Small anchor dot at badge */}
      <mesh position={[0, 2.30, 0]} material={lineMaterial}>
        <sphereGeometry args={[0.025, 8, 8]} />
      </mesh>

      {/* ─── Billboarded HTML Badge (distanceFactor 48 for human-scale readability, zIndexRange [10, 0]) ── */}
      <Html
        position={[0, 2.45, 0]}
        center
        distanceFactor={48}
        zIndexRange={[10, 0]}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(player);
          }}
          className={`pointer-events-auto cursor-pointer select-none transition-all duration-200 flex flex-col items-center group max-w-[260px] ${
            isSelected
              ? 'scale-110'
              : isHovered
                ? 'scale-105'
                : 'scale-100 hover:scale-105'
          }`}
        >
          {/* Main Label Pill with hud-player-label explicit padding */}
          <div
            className={`hud-player-label rounded-lg backdrop-blur-xl border text-center whitespace-nowrap shadow-xl ${
              isSelected
                ? 'bg-[hsla(222,47%,11%,0.95)] border-[hsl(43,98%,53%)] shadow-[hsla(43,98%,53%,0.25)] ring-1 ring-[hsl(43,98%,53%)]/50'
                : isHovered
                  ? 'bg-[hsla(222,47%,11%,0.92)] border-white/40 shadow-black/50'
                  : 'bg-[hsla(223,49%,8%,0.85)] border-white/20 shadow-black/40'
            }`}
          >
            <div className="flex items-center gap-[8px] justify-center leading-tight">
              <span className="font-extrabold text-[13px] tracking-wide text-white">
                {player.name.toUpperCase()}
              </span>
              <span className="text-[10px] font-bold px-[6px] py-[2px] rounded bg-[hsla(43,98%,53%,0.15)] text-[hsl(43,98%,53%)] leading-none">
                {player.position === 'FORWARD'
                  ? 'FOR'
                  : player.position === 'MIDFIELDER'
                    ? 'ORT'
                    : player.position === 'DEFENDER'
                      ? 'DEF'
                      : 'KL'}
              </span>
            </div>

            {/* Sub-label: Current club & status with 5px top gap */}
            <div className="flex items-center gap-[6px] text-[10px] text-[hsl(215,20%,80%)] font-medium justify-center mt-[5px] leading-tight">
              <span className="truncate max-w-[130px]">{player.currentClub}</span>
              {(isHovered || isSelected) && (
                <>
                  <span className="text-white/40">•</span>
                  <span className={`px-[6px] py-[2px] rounded border text-[8px] font-bold tracking-wide leading-none ${statusBadgeBg}`}>
                    {player.statusLabel}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </Html>
    </group>
  );
}
