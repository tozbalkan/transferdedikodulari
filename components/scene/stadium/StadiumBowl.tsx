'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { GS_RED, GS_YELLOW, STAND_COLOR, STAND_ACCENT } from '@/lib/colors';
import { PITCH_LENGTH, PITCH_WIDTH } from './Pitch';

// ─── Authentic Stadium Bowl Scale Constants ─────────────────────────────────

const BOWL_OFFSET_X = PITCH_WIDTH / 2 + 1.2; // 8.2
const BOWL_OFFSET_Z = PITCH_LENGTH / 2 + 1.2; // 12.2

const LOWER_DEPTH = 3.8;
const LOWER_HEIGHT = 1.8;
const LOWER_ROWS = 14;

const CONCOURSE_DEPTH = 1.0;
const CONCOURSE_HEIGHT = 0.4;

const UPPER_DEPTH = 5.6;
const UPPER_HEIGHT = 4.8;
const UPPER_ROWS = 22;

const DEEP_RED = '#800c1e';
const VIBRANT_RED = '#a6132b';
const GOLDEN_SEAT = '#e6af19';
const AISLE_COLOR = '#111422';

/**
 * Creates high-density seating steps with realistic stairways and Galatasaray mosaic patterns
 */
function HighDensityTier({
  width,
  depth,
  height,
  rows,
  isNorthStand = false,
}: {
  width: number;
  depth: number;
  height: number;
  rows: number;
  isNorthStand?: boolean;
}) {
  const elements = useMemo(() => {
    const items = [];
    const rowDepth = depth / rows;
    const rowHeight = height / rows;

    const aisleCount = 6;
    const sectionWidth = width / aisleCount;

    for (let r = 0; r < rows; r++) {
      const y = r * rowHeight + rowHeight / 2;
      const z = r * rowDepth + rowDepth / 2;

      for (let s = 0; s < aisleCount; s++) {
        const x = -width / 2 + s * sectionWidth + sectionWidth / 2;

        // Pattern logic
        let color = r % 4 === 0 ? VIBRANT_RED : DEEP_RED;

        // North stand central "GALATASARAY" yellow seating block pattern
        if (isNorthStand && (s === 2 || s === 3) && r >= 6 && r <= 16) {
          color = GOLDEN_SEAT;
        } else if ((s === 1 || s === 4) && r % 6 === 0) {
          color = GOLDEN_SEAT;
        }

        // Seating block
        items.push(
          <mesh key={`s${s}-r${r}`} position={[x, y, z]}>
            <boxGeometry args={[sectionWidth * 0.92, rowHeight * 0.9, rowDepth * 0.95]} />
            <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
          </mesh>,
        );

        // Stairway / aisle between sections
        if (s < aisleCount - 1) {
          items.push(
            <mesh
              key={`aisle-${s}-r${r}`}
              position={[x + sectionWidth / 2, y - rowHeight * 0.1, z]}
            >
              <boxGeometry args={[sectionWidth * 0.08, rowHeight * 0.7, rowDepth * 0.95]} />
              <meshStandardMaterial color={AISLE_COLOR} roughness={0.8} />
            </mesh>,
          );
        }
      }
    }
    return items;
  }, [width, depth, height, rows, isNorthStand]);

  return <group>{elements}</group>;
}

/**
 * Stand Tier Assembly (Lower or Upper) with sloped concrete backing
 */
function StandTier({
  position,
  rotationY,
  width,
  depth,
  height,
  rows,
  isNorthStand = false,
}: {
  position: [number, number, number];
  rotationY: number;
  width: number;
  depth: number;
  height: number;
  rows: number;
  isNorthStand?: boolean;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Sloped Under-structure */}
      <mesh position={[0, height / 2, depth / 2]} rotation={[Math.atan2(height, depth), 0, 0]}>
        <planeGeometry args={[width, Math.sqrt(height * height + depth * depth)]} />
        <meshStandardMaterial color={STAND_COLOR} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Seating Rows */}
      <HighDensityTier
        width={width}
        depth={depth}
        height={height}
        rows={rows}
        isNorthStand={isNorthStand}
      />
    </group>
  );
}

/**
 * Concourse with Glass Balcony Railing & LED Ribbon
 */
function ConcourseRing({
  northZ,
  southZ,
  westX,
  eastX,
  y,
}: {
  northZ: number;
  southZ: number;
  westX: number;
  eastX: number;
  y: number;
}) {
  const width = eastX - westX;
  const length = southZ - northZ;
  const concourseDepth = 1.0;

  return (
    <group position={[0, y, 0]}>
      {/* 4 Perimeter Concourse Walkways (North, South, West, East) */}
      <mesh position={[0, 0, northZ - concourseDepth / 2]}>
        <boxGeometry args={[width, 0.15, concourseDepth]} />
        <meshStandardMaterial color={STAND_ACCENT} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0, southZ + concourseDepth / 2]}>
        <boxGeometry args={[width, 0.15, concourseDepth]} />
        <meshStandardMaterial color={STAND_ACCENT} roughness={0.8} />
      </mesh>
      <mesh position={[westX - concourseDepth / 2, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[length, 0.15, concourseDepth]} />
        <meshStandardMaterial color={STAND_ACCENT} roughness={0.8} />
      </mesh>
      <mesh position={[eastX + concourseDepth / 2, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[length, 0.15, concourseDepth]} />
        <meshStandardMaterial color={STAND_ACCENT} roughness={0.8} />
      </mesh>

      {/* North LED Ribbon Board */}
      <mesh position={[0, 0.22, northZ + 0.1]}>
        <boxGeometry args={[width, 0.32, 0.08]} />
        <meshStandardMaterial
          color={GS_YELLOW}
          emissive={GS_YELLOW}
          emissiveIntensity={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* South LED Ribbon Board */}
      <mesh position={[0, 0.22, southZ - 0.1]}>
        <boxGeometry args={[width, 0.32, 0.08]} />
        <meshStandardMaterial
          color={GS_RED}
          emissive={GS_RED}
          emissiveIntensity={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* West LED Ribbon Board */}
      <mesh position={[westX + 0.1, 0.22, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[length, 0.32, 0.08]} />
        <meshStandardMaterial
          color={GS_YELLOW}
          emissive={GS_YELLOW}
          emissiveIntensity={0.8}
          roughness={0.2}
        />
      </mesh>

      {/* East LED Ribbon Board */}
      <mesh position={[eastX - 0.1, 0.22, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <boxGeometry args={[length, 0.32, 0.08]} />
        <meshStandardMaterial
          color={GS_RED}
          emissive={GS_RED}
          emissiveIntensity={0.8}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

/**
 * Curved Corner Filling
 */
function CornerCurvedStand({
  position,
  rotationY,
  depth,
  height,
  rows,
}: {
  position: [number, number, number];
  rotationY: number;
  depth: number;
  height: number;
  rows: number;
}) {
  const steps = useMemo(() => {
    const items = [];
    const segments = 6;
    const angleStep = Math.PI / 2 / segments;
    const rowDepth = depth / rows;
    const rowHeight = height / rows;

    for (let s = 0; s < segments; s++) {
      const angle = s * angleStep + angleStep / 2;
      for (let r = 0; r < rows; r++) {
        const radius = 0.6 + r * rowDepth + rowDepth / 2;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const y = r * rowHeight + rowHeight / 2;
        const color = (s + r) % 3 === 0 ? GOLDEN_SEAT : DEEP_RED;

        items.push(
          <mesh key={`cr-${s}-${r}`} position={[x, y, z]} rotation={[0, angle, 0]}>
            <boxGeometry args={[radius * angleStep * 0.94, rowHeight * 0.88, rowDepth * 0.94]} />
            <meshStandardMaterial color={color} roughness={0.65} />
          </mesh>,
        );
      }
    }
    return items;
  }, [depth, height, rows]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {steps}
    </group>
  );
}

export function StadiumBowl() {
  const lowerNorthZ = -BOWL_OFFSET_Z;
  const lowerSouthZ = BOWL_OFFSET_Z;
  const lowerWestX = -BOWL_OFFSET_X;
  const lowerEastX = BOWL_OFFSET_X;

  const upperOffsetZ = LOWER_DEPTH + CONCOURSE_DEPTH;
  const upperOffsetX = LOWER_DEPTH + CONCOURSE_DEPTH;
  const upperNorthZ = lowerNorthZ - upperOffsetZ;
  const upperSouthZ = lowerSouthZ + upperOffsetZ;
  const upperWestX = lowerWestX - upperOffsetX;
  const upperEastX = lowerEastX + upperOffsetX;
  const upperY = LOWER_HEIGHT + CONCOURSE_HEIGHT;

  const widthEW = PITCH_WIDTH + 3.0;
  const lengthNS = PITCH_LENGTH + 3.0;

  return (
    <group>
      {/* ─── 1. LOWER BOWL TIER ────────────────────────────────────────── */}
      <StandTier
        position={[0, 0, lowerNorthZ]}
        rotationY={Math.PI}
        width={widthEW}
        depth={LOWER_DEPTH}
        height={LOWER_HEIGHT}
        rows={LOWER_ROWS}
      />
      <StandTier
        position={[0, 0, lowerSouthZ]}
        rotationY={0}
        width={widthEW}
        depth={LOWER_DEPTH}
        height={LOWER_HEIGHT}
        rows={LOWER_ROWS}
      />
      <StandTier
        position={[lowerWestX, 0, 0]}
        rotationY={Math.PI / 2}
        width={lengthNS}
        depth={LOWER_DEPTH}
        height={LOWER_HEIGHT}
        rows={LOWER_ROWS}
      />
      <StandTier
        position={[lowerEastX, 0, 0]}
        rotationY={-Math.PI / 2}
        width={lengthNS}
        depth={LOWER_DEPTH}
        height={LOWER_HEIGHT}
        rows={LOWER_ROWS}
      />

      {/* 4 Lower Curved Corners */}
      <CornerCurvedStand
        position={[lowerWestX, 0, lowerNorthZ]}
        rotationY={Math.PI}
        depth={LOWER_DEPTH}
        height={LOWER_HEIGHT}
        rows={LOWER_ROWS}
      />
      <CornerCurvedStand
        position={[lowerEastX, 0, lowerNorthZ]}
        rotationY={Math.PI / 2}
        depth={LOWER_DEPTH}
        height={LOWER_HEIGHT}
        rows={LOWER_ROWS}
      />
      <CornerCurvedStand
        position={[lowerWestX, 0, lowerSouthZ]}
        rotationY={-Math.PI / 2}
        depth={LOWER_DEPTH}
        height={LOWER_HEIGHT}
        rows={LOWER_ROWS}
      />
      <CornerCurvedStand
        position={[lowerEastX, 0, lowerSouthZ]}
        rotationY={0}
        depth={LOWER_DEPTH}
        height={LOWER_HEIGHT}
        rows={LOWER_ROWS}
      />

      {/* ─── 2. CONCOURSE & LED ELECTRONIC RIBBON ──────────────────────── */}
      <ConcourseRing
        northZ={lowerNorthZ - LOWER_DEPTH}
        southZ={lowerSouthZ + LOWER_DEPTH}
        westX={lowerWestX - LOWER_DEPTH}
        eastX={lowerEastX + LOWER_DEPTH}
        y={LOWER_HEIGHT}
      />

      {/* ─── 3. UPPER BOWL TIER (GRAND ELEVATED STANDS) ───────────────── */}
      <StandTier
        position={[0, upperY, upperNorthZ]}
        rotationY={Math.PI}
        width={widthEW + 8.0}
        depth={UPPER_DEPTH}
        height={UPPER_HEIGHT}
        rows={UPPER_ROWS}
        isNorthStand={true}
      />
      <StandTier
        position={[0, upperY, upperSouthZ]}
        rotationY={0}
        width={widthEW + 8.0}
        depth={UPPER_DEPTH}
        height={UPPER_HEIGHT}
        rows={UPPER_ROWS}
      />
      <StandTier
        position={[upperWestX, upperY, 0]}
        rotationY={Math.PI / 2}
        width={lengthNS + 8.0}
        depth={UPPER_DEPTH}
        height={UPPER_HEIGHT}
        rows={UPPER_ROWS}
      />
      <StandTier
        position={[upperEastX, upperY, 0]}
        rotationY={-Math.PI / 2}
        width={lengthNS + 8.0}
        depth={UPPER_DEPTH}
        height={UPPER_HEIGHT}
        rows={UPPER_ROWS}
      />

      {/* 4 Upper Curved Corners */}
      <CornerCurvedStand
        position={[upperWestX, upperY, upperNorthZ]}
        rotationY={Math.PI}
        depth={UPPER_DEPTH}
        height={UPPER_HEIGHT}
        rows={UPPER_ROWS}
      />
      <CornerCurvedStand
        position={[upperEastX, upperY, upperNorthZ]}
        rotationY={Math.PI / 2}
        depth={UPPER_DEPTH}
        height={UPPER_HEIGHT}
        rows={UPPER_ROWS}
      />
      <CornerCurvedStand
        position={[upperWestX, upperY, upperSouthZ]}
        rotationY={-Math.PI / 2}
        depth={UPPER_DEPTH}
        height={UPPER_HEIGHT}
        rows={UPPER_ROWS}
      />
      <CornerCurvedStand
        position={[upperEastX, upperY, upperSouthZ]}
        rotationY={0}
        depth={UPPER_DEPTH}
        height={UPPER_HEIGHT}
        rows={UPPER_ROWS}
      />
    </group>
  );
}
