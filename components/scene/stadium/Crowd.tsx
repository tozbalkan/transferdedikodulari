'use client';

import { useMemo } from 'react';
import { CROWD_COLOR } from '@/lib/colors';
import { PITCH_LENGTH, PITCH_WIDTH } from './Pitch';

/**
 * Low-poly ambient spectator geometry to give the stands atmospheric depth.
 */
export function Crowd() {
  const halfWidth = PITCH_WIDTH / 2;
  const halfLength = PITCH_LENGTH / 2;

  const crowdBlocks = useMemo(() => {
    return (
      <group>
        {/* West Upper Stand Crowd Block */}
        <mesh position={[-(halfWidth + 5.5), 4.2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[PITCH_LENGTH + 4, 1.2, 0.4]} />
          <meshStandardMaterial color={CROWD_COLOR} roughness={1.0} />
        </mesh>

        {/* East Upper Stand Crowd Block */}
        <mesh position={[halfWidth + 5.5, 4.2, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <boxGeometry args={[PITCH_LENGTH + 4, 1.2, 0.4]} />
          <meshStandardMaterial color={CROWD_COLOR} roughness={1.0} />
        </mesh>

        {/* North Upper Stand Crowd Block */}
        <mesh position={[0, 4.2, -(halfLength + 5.5)]}>
          <boxGeometry args={[PITCH_WIDTH + 4, 1.2, 0.4]} />
          <meshStandardMaterial color={CROWD_COLOR} roughness={1.0} />
        </mesh>

        {/* South Upper Stand Crowd Block */}
        <mesh position={[0, 4.2, halfLength + 5.5]}>
          <boxGeometry args={[PITCH_WIDTH + 4, 1.2, 0.4]} />
          <meshStandardMaterial color={CROWD_COLOR} roughness={1.0} />
        </mesh>
      </group>
    );
  }, [halfWidth, halfLength]);

  return crowdBlocks;
}
