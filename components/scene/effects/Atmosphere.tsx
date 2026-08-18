'use client';

import { BG_COLOR } from '@/lib/colors';

export function Atmosphere() {
  return (
    <>
      <color attach="background" args={[BG_COLOR]} />
      {/* Deep atmospheric depth fog adjusted for 150m stadium scale */}
      <fog attach="fog" args={[BG_COLOR, 140, 450]} />
    </>
  );
}
