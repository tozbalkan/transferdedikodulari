import type { Position, TransferRumor } from '@/types/transfer';
import type { PitchGeometryInfo } from '@/lib/stadium/pitch-geometry';

export interface Player3DPosition {
  x: number;
  y: number;
  z: number;
}

// ─── Normalized Tactical Pitch Coordinates (Relative to Pitch Dimensions) ───

const NORMALIZED_TACTICAL_ANCHORS: Record<
  Position,
  { normX: number; normZ: number; spreadX: number; spreadZ: number }
> = {
  GOALKEEPER: {
    normX: -0.38,
    normZ: 0.0,
    spreadX: 0.04,
    spreadZ: 0.16,
  },
  DEFENDER: {
    normX: -0.20,
    normZ: 0.0,
    spreadX: 0.06,
    spreadZ: 0.56,
  },
  MIDFIELDER: {
    normX: 0.02,
    normZ: 0.0,
    spreadX: 0.08,
    spreadZ: 0.56,
  },
  FORWARD: {
    normX: 0.25,
    normZ: 0.0,
    spreadX: 0.08,
    spreadZ: 0.50,
  },
};

/**
 * Calculates deterministic non-overlapping 3D coordinates for transfer rumor nodes
 * positioned physically above the football pitch relative to actual pitch bounds.
 */
export function calculatePlayerPositions(
  rumors: TransferRumor[],
  pitchInfo?: PitchGeometryInfo | null,
): Map<string, Player3DPosition> {
  const positionsMap = new Map<string, Player3DPosition>();

  const pitchLength = pitchInfo ? pitchInfo.dimensions.length : 105;
  const pitchWidth = pitchInfo ? pitchInfo.dimensions.width : 68;
  const pitchCenter = pitchInfo ? pitchInfo.center : { x: 0, y: 0, z: 0 };
  const pitchY = pitchInfo ? pitchInfo.pitchY : 1.6;

  // Group rumors by player tactical position
  const grouped = new Map<Position, TransferRumor[]>();
  for (const rumor of rumors) {
    const pos = rumor.player.position || 'MIDFIELDER';
    const list = grouped.get(pos) || [];
    list.push(rumor);
    grouped.set(pos, list);
  }

  // Calculate non-overlapping tactical spread along pitch dimensions
  grouped.forEach((posRumors, position) => {
    const anchor = NORMALIZED_TACTICAL_ANCHORS[position];
    const baseX = pitchCenter.x + anchor.normX * pitchLength;
    const baseZ = pitchCenter.z + anchor.normZ * pitchWidth;
    const count = posRumors.length;

    if (count === 1) {
      positionsMap.set(posRumors[0].player.id, {
        x: baseX,
        y: pitchY + 1.6,
        z: baseZ,
      });
      return;
    }

    posRumors.forEach((rumor, index) => {
      let xOffset = 0;
      let zOffset = 0;

      if (count <= 4) {
        // Single tactical line across pitch width
        const step = count > 1 ? (index / (count - 1) - 0.5) * 2 : 0;
        zOffset = step * ((anchor.spreadZ * pitchWidth) / 2);
        xOffset = (1 - Math.abs(step)) * 2.0; // gentle tactical arc
      } else {
        // Multi-row staggered formation
        const col = index % 2;
        const row = Math.floor(index / 2);
        const rowsInGroup = Math.ceil(count / 2);
        const step = rowsInGroup > 1 ? (row / (rowsInGroup - 1) - 0.5) * 2 : 0;

        zOffset = step * ((anchor.spreadZ * pitchWidth) / 2) + (col === 1 ? 2.0 : -2.0);
        xOffset = (col === 0 ? 3.0 : -3.0) * ((anchor.spreadX * pitchLength) / 2);
      }

      positionsMap.set(rumor.player.id, {
        x: Math.round((baseX + xOffset) * 100) / 100,
        y: pitchY + 1.6,
        z: Math.round((baseZ + zOffset) * 100) / 100,
      });
    });
  });

  return positionsMap;
}
