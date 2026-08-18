'use client';

import { TUNNEL_COLOR, GS_RED } from '@/lib/colors';
import { PITCH_WIDTH } from './Pitch';

export function Tunnel() {
  const tunnelX = -(PITCH_WIDTH / 2 + 1.2);

  return (
    <group position={[tunnelX, 0, 0]}>
      {/* Player Walkout Carpet (Red) */}
      <mesh position={[0.6, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 1.6]} />
        <meshStandardMaterial color={GS_RED} roughness={0.9} />
      </mesh>

      {/* Arched Tunnel Entrance Canopy */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[1.0, 1.2, 1.8]} />
        <meshStandardMaterial color={TUNNEL_COLOR} metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Inner Entrance Void (Dark interior) */}
      <mesh position={[-0.2, 0.55, 0]}>
        <boxGeometry args={[0.7, 1.0, 1.4]} />
        <meshStandardMaterial color="#000000" roughness={1.0} />
      </mesh>
    </group>
  );
}
