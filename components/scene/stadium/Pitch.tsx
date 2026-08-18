'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import {
  FIELD_COLOR,
  FIELD_DARK_STRIPE,
  LINE_COLOR,
  TECHNICAL_AREA_COLOR,
  FLAG_POLE_COLOR,
  GS_YELLOW,
  GS_RED,
} from '@/lib/colors';

// ─── Pitch Dimension Constants (Scaled to 3D Scene) ─────────────────────────

export const PITCH_LENGTH = 22; // Z axis: -11 to +11
export const PITCH_WIDTH = 14; // X axis: -7 to +7
const LINE_HEIGHT = 0.015;
const LINE_WIDTH = 0.06;

const PENALTY_DEPTH = 3.6;
const PENALTY_WIDTH = 8.2;
const GOAL_AREA_DEPTH = 1.2;
const GOAL_AREA_WIDTH = 4.0;
const CENTER_CIRCLE_RADIUS = 2.0;
const PENALTY_SPOT_OFFSET = 2.4;
const CORNER_ARC_RADIUS = 0.4;

// ─── Field Line Box Component ───────────────────────────────────────────────

function PitchLineBox({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={LINE_COLOR}
        emissive={LINE_COLOR}
        emissiveIntensity={0.35}
        roughness={0.3}
      />
    </mesh>
  );
}

// ─── Center Circle & Penalty Arcs ───────────────────────────────────────────

function CenterCircle() {
  const points = useMemo(() => {
    const curve = new THREE.EllipseCurve(
      0,
      0,
      CENTER_CIRCLE_RADIUS,
      CENTER_CIRCLE_RADIUS,
      0,
      2 * Math.PI,
      false,
      0,
    );
    return curve.getPoints(64).map((p) => new THREE.Vector3(p.x, 0, p.y));
  }, []);

  return <Line points={points} color={LINE_COLOR} lineWidth={1.8} position={[0, LINE_HEIGHT, 0]} />;
}

function PenaltyArc({ side }: { side: 'top' | 'bottom' }) {
  const points = useMemo(() => {
    const zSign = side === 'top' ? -1 : 1;
    const startAngle = side === 'top' ? Math.PI * 0.72 : -Math.PI * 0.28;
    const endAngle = side === 'top' ? Math.PI * 0.28 : Math.PI * 0.72;

    const curve = new THREE.EllipseCurve(
      0,
      0,
      CENTER_CIRCLE_RADIUS * 0.7,
      CENTER_CIRCLE_RADIUS * 0.7,
      startAngle,
      endAngle,
      side === 'top',
      0,
    );
    return curve
      .getPoints(32)
      .map((p) => new THREE.Vector3(p.x, 0, p.y + zSign * (PITCH_LENGTH / 2 - PENALTY_DEPTH)));
  }, [side]);

  return <Line points={points} color={LINE_COLOR} lineWidth={1.8} position={[0, LINE_HEIGHT, 0]} />;
}

function CornerArc({ x, z, angleStart }: { x: number; z: number; angleStart: number }) {
  const points = useMemo(() => {
    const curve = new THREE.EllipseCurve(
      0,
      0,
      CORNER_ARC_RADIUS,
      CORNER_ARC_RADIUS,
      angleStart,
      angleStart + Math.PI / 2,
      false,
      0,
    );
    return curve.getPoints(16).map((p) => new THREE.Vector3(p.x, 0, p.y));
  }, [angleStart]);

  return <Line points={points} color={LINE_COLOR} lineWidth={1.4} position={[x, LINE_HEIGHT, z]} />;
}

// ─── Spots ──────────────────────────────────────────────────────────────────

function CircleSpot({
  position,
  radius = 0.08,
}: {
  position: [number, number, number];
  radius?: number;
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[radius, 24]} />
      <meshStandardMaterial
        color={LINE_COLOR}
        emissive={LINE_COLOR}
        emissiveIntensity={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ─── Corner Flag ────────────────────────────────────────────────────────────

function CornerFlag({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.4, 8]} />
        <meshStandardMaterial color={FLAG_POLE_COLOR} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.06, 0.35, 0]}>
        <boxGeometry args={[0.1, 0.07, 0.005]} />
        <meshStandardMaterial color={GS_YELLOW} emissive={GS_YELLOW} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// ─── Mowed Grass Stripes ───────────────────────────────────────────────────

function GrassStripes() {
  const stripeCount = 12;
  const stripeLength = PITCH_LENGTH / stripeCount;

  const stripes = [];
  for (let i = 0; i < stripeCount; i++) {
    const isEven = i % 2 === 0;
    const zPos = -PITCH_LENGTH / 2 + i * stripeLength + stripeLength / 2;
    const stripeColor = isEven ? FIELD_COLOR : FIELD_DARK_STRIPE;

    stripes.push(
      <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, zPos]} receiveShadow>
        <planeGeometry args={[PITCH_WIDTH, stripeLength]} />
        <meshStandardMaterial
          color={stripeColor}
          emissive={stripeColor}
          emissiveIntensity={0.12}
          roughness={0.7}
          metalness={0.05}
        />
      </mesh>,
    );
  }
  return <group>{stripes}</group>;
}

// ─── Main Pitch Assembly ────────────────────────────────────────────────────

export function Pitch() {
  const halfLength = PITCH_LENGTH / 2;
  const halfWidth = PITCH_WIDTH / 2;
  const halfPenaltyWidth = PENALTY_WIDTH / 2;
  const halfGoalAreaWidth = GOAL_AREA_WIDTH / 2;

  return (
    <group>
      {/* Base Grass Field Surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[PITCH_WIDTH + 2.5, PITCH_LENGTH + 2.5]} />
        <meshStandardMaterial color={FIELD_COLOR} roughness={0.85} />
      </mesh>

      {/* Alternating Striped Grass Pattern */}
      <GrassStripes />

      {/* Boundary Lines */}
      {/* Touchlines (East & West) */}
      <PitchLineBox
        position={[-halfWidth, LINE_HEIGHT, 0]}
        size={[LINE_WIDTH, 0.005, PITCH_LENGTH]}
      />
      <PitchLineBox
        position={[halfWidth, LINE_HEIGHT, 0]}
        size={[LINE_WIDTH, 0.005, PITCH_LENGTH]}
      />

      {/* Goal lines (North & South) */}
      <PitchLineBox
        position={[0, LINE_HEIGHT, -halfLength]}
        size={[PITCH_WIDTH, 0.005, LINE_WIDTH]}
      />
      <PitchLineBox
        position={[0, LINE_HEIGHT, halfLength]}
        size={[PITCH_WIDTH, 0.005, LINE_WIDTH]}
      />

      {/* Halfway Line */}
      <PitchLineBox position={[0, LINE_HEIGHT, 0]} size={[PITCH_WIDTH, 0.005, LINE_WIDTH]} />

      {/* Center Circle & Center Spot */}
      <CenterCircle />
      <CircleSpot position={[0, LINE_HEIGHT + 0.002, 0]} radius={0.09} />

      {/* Top Penalty Area (North) */}
      <PitchLineBox
        position={[-halfPenaltyWidth, LINE_HEIGHT, -halfLength + PENALTY_DEPTH / 2]}
        size={[LINE_WIDTH, 0.005, PENALTY_DEPTH]}
      />
      <PitchLineBox
        position={[halfPenaltyWidth, LINE_HEIGHT, -halfLength + PENALTY_DEPTH / 2]}
        size={[LINE_WIDTH, 0.005, PENALTY_DEPTH]}
      />
      <PitchLineBox
        position={[0, LINE_HEIGHT, -halfLength + PENALTY_DEPTH]}
        size={[PENALTY_WIDTH, 0.005, LINE_WIDTH]}
      />

      {/* Bottom Penalty Area (South) */}
      <PitchLineBox
        position={[-halfPenaltyWidth, LINE_HEIGHT, halfLength - PENALTY_DEPTH / 2]}
        size={[LINE_WIDTH, 0.005, PENALTY_DEPTH]}
      />
      <PitchLineBox
        position={[halfPenaltyWidth, LINE_HEIGHT, halfLength - PENALTY_DEPTH / 2]}
        size={[LINE_WIDTH, 0.005, PENALTY_DEPTH]}
      />
      <PitchLineBox
        position={[0, LINE_HEIGHT, halfLength - PENALTY_DEPTH]}
        size={[PENALTY_WIDTH, 0.005, LINE_WIDTH]}
      />

      {/* Top Goal Area (6-yard box) */}
      <PitchLineBox
        position={[-halfGoalAreaWidth, LINE_HEIGHT, -halfLength + GOAL_AREA_DEPTH / 2]}
        size={[LINE_WIDTH, 0.005, GOAL_AREA_DEPTH]}
      />
      <PitchLineBox
        position={[halfGoalAreaWidth, LINE_HEIGHT, -halfLength + GOAL_AREA_DEPTH / 2]}
        size={[LINE_WIDTH, 0.005, GOAL_AREA_DEPTH]}
      />
      <PitchLineBox
        position={[0, LINE_HEIGHT, -halfLength + GOAL_AREA_DEPTH]}
        size={[GOAL_AREA_WIDTH, 0.005, LINE_WIDTH]}
      />

      {/* Bottom Goal Area (6-yard box) */}
      <PitchLineBox
        position={[-halfGoalAreaWidth, LINE_HEIGHT, halfLength - GOAL_AREA_DEPTH / 2]}
        size={[LINE_WIDTH, 0.005, GOAL_AREA_DEPTH]}
      />
      <PitchLineBox
        position={[halfGoalAreaWidth, LINE_HEIGHT, halfLength - GOAL_AREA_DEPTH / 2]}
        size={[LINE_WIDTH, 0.005, GOAL_AREA_DEPTH]}
      />
      <PitchLineBox
        position={[0, LINE_HEIGHT, halfLength - GOAL_AREA_DEPTH]}
        size={[GOAL_AREA_WIDTH, 0.005, LINE_WIDTH]}
      />

      {/* Penalty Spots */}
      <CircleSpot
        position={[0, LINE_HEIGHT + 0.002, -halfLength + PENALTY_SPOT_OFFSET]}
        radius={0.07}
      />
      <CircleSpot
        position={[0, LINE_HEIGHT + 0.002, halfLength - PENALTY_SPOT_OFFSET]}
        radius={0.07}
      />

      {/* Penalty Arcs */}
      <PenaltyArc side="top" />
      <PenaltyArc side="bottom" />

      {/* Corner Arcs */}
      <CornerArc x={-halfWidth} z={-halfLength} angleStart={0} />
      <CornerArc x={halfWidth} z={-halfLength} angleStart={Math.PI / 2} />
      <CornerArc x={halfWidth} z={halfLength} angleStart={Math.PI} />
      <CornerArc x={-halfWidth} z={halfLength} angleStart={(3 * Math.PI) / 2} />

      {/* Corner Flags */}
      <CornerFlag x={-halfWidth} z={-halfLength} />
      <CornerFlag x={halfWidth} z={-halfLength} />
      <CornerFlag x={-halfWidth} z={halfLength} />
      <CornerFlag x={halfWidth} z={halfLength} />

      {/* Pitchside Walkout Red Carpet Crest Accent */}
      <group position={[0, 0.012, halfLength + 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.6, 1.0]} />
        <meshStandardMaterial color={GS_RED} roughness={0.7} />
      </group>
      <group position={[0, 0.014, halfLength + 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.35, 32]} />
        <meshBasicMaterial color={GS_YELLOW} />
      </group>

      {/* Technical Area Benches (Side Dugouts) */}
      <mesh position={[-(halfWidth + 0.8), 0.02, -2.5]}>
        <boxGeometry args={[0.9, 0.03, 2.8]} />
        <meshStandardMaterial color={TECHNICAL_AREA_COLOR} roughness={0.7} />
      </mesh>
      <mesh position={[-(halfWidth + 0.8), 0.02, 2.5]}>
        <boxGeometry args={[0.9, 0.03, 2.8]} />
        <meshStandardMaterial color={TECHNICAL_AREA_COLOR} roughness={0.7} />
      </mesh>
    </group>
  );
}
