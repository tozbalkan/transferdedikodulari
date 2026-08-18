'use client';

import { Html } from '@react-three/drei';
import type { Player } from '@/types/transfer';

export interface PlayerLabelProps {
  player: Player;
  isHovered: boolean;
  isSelected: boolean;
  mentionCount: number;
  score?: number;
  yOffset?: number;
}

export function PlayerLabel({
  player,
  isHovered,
  isSelected,
  mentionCount,
  yOffset = 2.3,
}: PlayerLabelProps) {
  return (
    <Html
      position={[0, yOffset, 0]}
      center
      distanceFactor={32}
      zIndexRange={[10, 0]}
    >
      {isSelected ? (
        <div className="pointer-events-auto flex flex-col items-center min-w-[140px] max-w-[240px] bg-[hsla(231,36%,9%,0.95)] backdrop-blur-xl border-2 border-[hsl(44,100%,59%)] rounded-lg px-3 py-2 shadow-2xl transform scale-105">
          <span className="text-xs font-black tracking-wider text-white font-mono uppercase text-center leading-tight">
            {player.name}
          </span>
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[hsl(226,16%,60%)] font-mono leading-tight">
            <span className="text-[hsl(44,100%,59%)] font-bold">{player.currentClub}</span>
            <span>&bull;</span>
            <span>{player.position}</span>
          </div>
          <div className="mt-1.5 px-2 py-0.5 text-[9px] font-mono rounded bg-[hsla(44,100%,59%,0.2)] text-[hsl(44,100%,59%)] font-bold">
            {mentionCount} Haber Kaynağı
          </div>
        </div>
      ) : isHovered ? (
        <div className="pointer-events-auto flex flex-col items-center max-w-[240px] bg-[hsla(231,36%,9%,0.90)] backdrop-blur-md border border-[hsl(44,100%,59%)] rounded-lg px-3 py-2 shadow-xl transform scale-105">
          <span className="text-xs font-black tracking-wider text-white font-mono uppercase leading-tight">
            {player.name}
          </span>
          <span className="text-[10px] font-mono font-black text-[hsl(44,100%,59%)] mt-1">
            {mentionCount} Kaynak
          </span>
        </div>
      ) : (
        <div className="pointer-events-auto flex flex-col items-center whitespace-nowrap select-none max-w-[240px] px-3 py-2 rounded-lg bg-[hsla(231,36%,9%,0.80)] backdrop-blur-sm border border-white/10 shadow-md">
          <span className="text-[11px] font-black tracking-wider text-white font-mono uppercase leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            {player.name}
          </span>
          <span className="text-[9px] font-mono font-bold text-[hsl(44,100%,59%)] leading-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] mt-1.5">
            {player.position.slice(0, 3)}
          </span>
        </div>
      )}
    </Html>
  );
}
