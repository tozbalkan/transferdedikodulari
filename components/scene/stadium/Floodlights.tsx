'use client';

import { FLOODLIGHT_STRUCTURE, WARM_WHITE } from '@/lib/colors';

const TOWER_HEIGHT = 16;
const PYLON_X = 14;
const PYLON_Z = 18;

function SinglePylon({
  position,
  rotationY = 0,
}: {
  position: [number, number, number];
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Main Steel Column */}
      <mesh position={[0, TOWER_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.15, 0.35, TOWER_HEIGHT, 8]} />
        <meshStandardMaterial color={FLOODLIGHT_STRUCTURE} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Floodlight Head Frame / Gantry Platform */}
      <mesh position={[0, TOWER_HEIGHT - 0.2, 0.4]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[2.0, 1.2, 0.3]} />
        <meshStandardMaterial color={FLOODLIGHT_STRUCTURE} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Light Emitter Array (Glowing bulb matrix) */}
      <mesh position={[0, TOWER_HEIGHT - 0.2, 0.55]} rotation={[0.4, 0, 0]}>
        <boxGeometry args={[1.8, 1.0, 0.05]} />
        <meshStandardMaterial
          color={WARM_WHITE}
          emissive={WARM_WHITE}
          emissiveIntensity={1.5}
          roughness={0.1}
        />
      </mesh>
    </group>
  );
}

export function Floodlights() {
  return (
    <group>
      {/* North-West Pylon (angles toward pitch center) */}
      <SinglePylon position={[-PYLON_X, 0, -PYLON_Z]} rotationY={Math.PI / 4} />

      {/* North-East Pylon */}
      <SinglePylon position={[PYLON_X, 0, -PYLON_Z]} rotationY={-Math.PI / 4} />

      {/* South-West Pylon */}
      <SinglePylon position={[-PYLON_X, 0, PYLON_Z]} rotationY={(3 * Math.PI) / 4} />

      {/* South-East Pylon */}
      <SinglePylon position={[PYLON_X, 0, PYLON_Z]} rotationY={(-3 * Math.PI) / 4} />
    </group>
  );
}
