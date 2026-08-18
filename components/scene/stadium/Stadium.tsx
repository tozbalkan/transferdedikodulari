'use client';

import { RealStadium } from './RealStadium';

export function Stadium() {
  return (
    <group position={[0, 0, 0]}>
      {/* Authentic Türk Telekom Arena GLB Model */}
      <RealStadium />
    </group>
  );
}
