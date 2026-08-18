'use client';

import {
  GS_YELLOW,
  GS_RED,
  WARM_WHITE,
} from '@/lib/colors';

const FLOODLIGHT_HEIGHT = 55;
const FLOODLIGHT_OFFSET_X = 45;
const FLOODLIGHT_OFFSET_Z = 55;

export function SceneLights() {
  return (
    <group>
      {/* ─── 1. GLOBAL CONTROLLED AMBIENT ──────────────────────────────── */}
      <ambientLight color={'hsl(220, 20%, 25%)'} intensity={0.95} />

      <hemisphereLight
        color={'hsl(220, 30%, 30%)'}
        groundColor={'hsl(142, 45%, 15%)'}
        intensity={1.1}
      />

      {/* ─── 2. MAIN PITCH OVERHEAD FLOODLIGHT (Guides eye to pitch) ──── */}
      <directionalLight
        position={[0, 95, 5]}
        intensity={2.6}
        color={WARM_WHITE}
        castShadow={false}
      />

      {/* ─── 3. FOUR INWARD PITCH FLOODLIGHTS ──────────────────────────── */}
      {/* North-West */}
      <pointLight
        position={[-FLOODLIGHT_OFFSET_X, FLOODLIGHT_HEIGHT, -FLOODLIGHT_OFFSET_Z]}
        intensity={60}
        color={WARM_WHITE}
        distance={180}
      />

      {/* North-East */}
      <pointLight
        position={[FLOODLIGHT_OFFSET_X, FLOODLIGHT_HEIGHT, -FLOODLIGHT_OFFSET_Z]}
        intensity={60}
        color={WARM_WHITE}
        distance={180}
      />

      {/* South-West */}
      <pointLight
        position={[-FLOODLIGHT_OFFSET_X, FLOODLIGHT_HEIGHT, FLOODLIGHT_OFFSET_Z]}
        intensity={55}
        color={WARM_WHITE}
        distance={180}
      />

      {/* South-East */}
      <pointLight
        position={[FLOODLIGHT_OFFSET_X, FLOODLIGHT_HEIGHT, FLOODLIGHT_OFFSET_Z]}
        intensity={55}
        color={WARM_WHITE}
        distance={180}
      />

      {/* ─── 4. SUBTLE GALATASARAY ARCHITECTURAL ACCENTS ───────────────── */}
      <pointLight position={[-35, 16, 0]} color={GS_RED} intensity={14} distance={60} decay={2} />
      <pointLight position={[35, 16, 0]} color={GS_YELLOW} intensity={14} distance={60} decay={2} />
      <pointLight position={[0, 20, -45]} color={GS_YELLOW} intensity={20} distance={65} decay={2} />
    </group>
  );
}
