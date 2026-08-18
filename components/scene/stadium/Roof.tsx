'use client';

import { useMemo } from 'react';
import { ROOF_STRUCTURE, ROOF_CANOPY, GS_YELLOW_DIM, WARM_WHITE } from '@/lib/colors';
import { PITCH_LENGTH, PITCH_WIDTH } from './Pitch';

const ROOF_ELEVATION = 11.5; // High above the pitch, clear of any camera angles
const CANOPY_DEPTH = 6.5;

function RoofFloodlightBank({
  width,
  position,
  rotationY = 0,
}: {
  width: number;
  position: [number, number, number];
  rotationY?: number;
}) {
  const lampCount = 14;
  const lamps = useMemo(() => {
    const items = [];
    const step = width / lampCount;
    for (let i = 0; i < lampCount; i++) {
      const x = -width / 2 + i * step + step / 2;
      items.push(
        <mesh key={i} position={[x, -0.12, 0.05]}>
          <boxGeometry args={[0.32, 0.16, 0.12]} />
          <meshStandardMaterial
            color={WARM_WHITE}
            emissive={WARM_WHITE}
            emissiveIntensity={3.0}
            roughness={0.1}
          />
        </mesh>,
      );
    }
    return items;
  }, [width, lampCount]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Structural Steel Light Bar Mount */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[width, 0.12, 0.18]} />
        <meshStandardMaterial color={ROOF_STRUCTURE} metalness={0.8} roughness={0.2} />
      </mesh>
      {lamps}
    </group>
  );
}

/**
 * Cantilevered Steel Truss Beam
 */
function TrussCantilever({
  position,
  rotationY,
  length,
}: {
  position: [number, number, number];
  rotationY: number;
  length: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Top Beam */}
      <mesh position={[0, 0.4, length / 2]}>
        <boxGeometry args={[0.15, 0.15, length]} />
        <meshStandardMaterial color={ROOF_STRUCTURE} metalness={0.85} roughness={0.25} />
      </mesh>
      {/* Diagonal Support Strut */}
      <mesh position={[0, 0, length / 2]} rotation={[-0.12, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, length, 8]} />
        <meshStandardMaterial color={ROOF_STRUCTURE} metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
}

export function Roof() {
  const halfWidth = PITCH_WIDTH / 2; // 7.0
  const halfLength = PITCH_LENGTH / 2; // 11.0

  const northRoofZ = -(halfLength + 8.5);
  const westRoofX = -(halfWidth + 8.5);
  const eastRoofX = halfWidth + 8.5;

  const northWidth = PITCH_WIDTH + 14;
  const sideLength = PITCH_LENGTH + 14;

  return (
    <group position={[0, ROOF_ELEVATION, 0]}>
      {/* ─── 1. NORTH GRANDSTAND CANOPY (BACKGROUND FRAME) ─────────────── */}
      <group position={[0, 0, northRoofZ]} rotation={[0, Math.PI, -0.06]}>
        {/* Translucent High-Tech Roof Sheet */}
        <mesh position={[0, 0, CANOPY_DEPTH / 2]}>
          <boxGeometry args={[northWidth, 0.18, CANOPY_DEPTH]} />
          <meshStandardMaterial
            color={ROOF_CANOPY}
            roughness={0.4}
            metalness={0.6}
            transparent
            opacity={0.92}
          />
        </mesh>

        {/* Steel Edge Beam with Accent Stripe */}
        <mesh position={[0, -0.15, CANOPY_DEPTH]}>
          <boxGeometry args={[northWidth, 0.22, 0.22]} />
          <meshStandardMaterial
            color={GS_YELLOW_DIM}
            emissive={GS_YELLOW_DIM}
            emissiveIntensity={0.35}
            metalness={0.8}
            roughness={0.3}
          />
        </mesh>

        {/* Intense Roof Floodlight Array */}
        <RoofFloodlightBank width={northWidth * 0.88} position={[0, -0.3, CANOPY_DEPTH - 0.2]} />
      </group>

      {/* ─── 2. WEST STAND CANOPY ──────────────────────────────────────── */}
      <group position={[westRoofX, 0, 0]} rotation={[0, Math.PI / 2, -0.06]}>
        <mesh position={[0, 0, CANOPY_DEPTH / 2]}>
          <boxGeometry args={[sideLength, 0.18, CANOPY_DEPTH]} />
          <meshStandardMaterial
            color={ROOF_CANOPY}
            roughness={0.4}
            metalness={0.6}
            transparent
            opacity={0.92}
          />
        </mesh>
        <RoofFloodlightBank width={sideLength * 0.8} position={[0, -0.3, CANOPY_DEPTH - 0.2]} />
      </group>

      {/* ─── 3. EAST STAND CANOPY ──────────────────────────────────────── */}
      <group position={[eastRoofX, 0, 0]} rotation={[0, -Math.PI / 2, -0.06]}>
        <mesh position={[0, 0, CANOPY_DEPTH / 2]}>
          <boxGeometry args={[sideLength, 0.18, CANOPY_DEPTH]} />
          <meshStandardMaterial
            color={ROOF_CANOPY}
            roughness={0.4}
            metalness={0.6}
            transparent
            opacity={0.92}
          />
        </mesh>
        <RoofFloodlightBank width={sideLength * 0.8} position={[0, -0.3, CANOPY_DEPTH - 0.2]} />
      </group>

      {/* ─── 4. CANTILEVER STEEL TRUSSES ───────────────────────────────── */}
      <TrussCantilever position={[-6, 0, northRoofZ]} rotationY={Math.PI} length={CANOPY_DEPTH} />
      <TrussCantilever position={[0, 0, northRoofZ]} rotationY={Math.PI} length={CANOPY_DEPTH} />
      <TrussCantilever position={[6, 0, northRoofZ]} rotationY={Math.PI} length={CANOPY_DEPTH} />

      <TrussCantilever
        position={[westRoofX, 0, -5]}
        rotationY={Math.PI / 2}
        length={CANOPY_DEPTH}
      />
      <TrussCantilever position={[westRoofX, 0, 5]} rotationY={Math.PI / 2} length={CANOPY_DEPTH} />

      <TrussCantilever
        position={[eastRoofX, 0, -5]}
        rotationY={-Math.PI / 2}
        length={CANOPY_DEPTH}
      />
      <TrussCantilever
        position={[eastRoofX, 0, 5]}
        rotationY={-Math.PI / 2}
        length={CANOPY_DEPTH}
      />
    </group>
  );
}
