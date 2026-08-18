'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useTransferData } from '@/hooks/useTransferData';
import { HUD } from '@/components/hud/HUD';
import type { Position, TransferRumor } from '@/types/transfer';

// Dynamic import for Three.js Canvas to prevent SSR issues
const TransferUniverse = dynamic(
  () =>
    import('@/components/scene/TransferUniverse').then((mod) => ({
      default: mod.TransferUniverse,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[hsl(228,38%,5%)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[hsl(43,98%,53%)] border-t-transparent rounded-full animate-spin" />
          <span className="font-mono text-xs text-[hsl(226,16%,60%)] tracking-wider">
            STADYUM VE TRANSFER RADARI YÜKLENİYOR...
          </span>
        </div>
      </div>
    ),
  },
);

export function SceneContainer() {
  const { rumors, meta, isLoading, error, refetch } = useTransferData();

  const [selectedRumor, setSelectedRumor] = useState<TransferRumor | null>(null);
  const [activePositionFilter, setActivePositionFilter] = useState<Position | null>(null);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[hsl(228,38%,5%)]">
      {/* 3D Scene Layer */}
      <TransferUniverse
        rumors={rumors}
        selectedRumor={selectedRumor}
        activePositionFilter={activePositionFilter}
        onSelectRumor={setSelectedRumor}
      />

      {/* 2D HUD / UI Layer */}
      <HUD
        meta={meta}
        rumors={rumors}
        selectedRumor={selectedRumor}
        activePositionFilter={activePositionFilter}
        onPositionChange={setActivePositionFilter}
        onSelectRumor={setSelectedRumor}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
      />
    </div>
  );
}
