'use client';

import { useMemo } from 'react';
import type { Position, TransferRumor } from '@/types/transfer';
import { calculatePlayerPositions } from './player-position';
import { RumorBubble } from './RumorBubble';

interface TransferPlayersProps {
  rumors: TransferRumor[];
  selectedPlayerId: string | null;
  hoveredPlayerId: string | null;
  activePositionFilter: Position | null;
  onSelectPlayer: (rumor: TransferRumor) => void;
  onHoverPlayer: (id: string | null) => void;
}

export function TransferPlayers({
  rumors,
  selectedPlayerId,
  hoveredPlayerId,
  activePositionFilter,
  onSelectPlayer,
  onHoverPlayer,
}: TransferPlayersProps) {
  // Compute positions across all rumors so positions remain stable during filtering
  const positionsMap = useMemo(() => {
    return calculatePlayerPositions(rumors);
  }, [rumors]);

  // Max mentions for normalization
  const maxMentions = useMemo(() => {
    return rumors.reduce((max, r) => Math.max(max, r.mentionCount), 1);
  }, [rumors]);

  // Filtered rumors matching active position tab
  const visibleRumors = useMemo(() => {
    if (!activePositionFilter) return rumors;
    return rumors.filter((r) => r.player.position === activePositionFilter);
  }, [rumors, activePositionFilter]);

  return (
    <group>
      {visibleRumors.map((rumor) => {
        const pos = positionsMap.get(rumor.player.id) || { x: 0, y: 1.0, z: 0 };
        const isHovered = hoveredPlayerId === rumor.player.id;
        const isSelected = selectedPlayerId === rumor.player.id;

        return (
          <RumorBubble
            key={rumor.player.id}
            rumor={rumor}
            position={[pos.x, pos.y, pos.z]}
            isHovered={isHovered}
            isSelected={isSelected}
            maxMentions={maxMentions}
            onHover={onHoverPlayer}
            onSelect={onSelectPlayer}
          />
        );
      })}
    </group>
  );
}
