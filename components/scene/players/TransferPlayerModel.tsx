'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { HSL_COLORS } from '@/lib/constants/colors';

interface TransferPlayerModelProps {
  isHovered?: boolean;
  isSelected?: boolean;
}

export function TransferPlayerModel({
  isHovered = false,
  isSelected = false,
}: TransferPlayerModelProps) {
  // ─── Materials ────────────────────────────────────────────────────────────
  // Galatasaray Crimson Red Jersey
  const jerseyMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HSL_COLORS.GS_CRIMSON,
        emissive: HSL_COLORS.GS_CRIMSON_DARK,
        emissiveIntensity: isSelected ? 0.45 : isHovered ? 0.3 : 0.1,
        roughness: 0.7,
        metalness: 0.05,
      }),
    [isHovered, isSelected],
  );

  // Galatasaray Gold Kit Accents (Collar, sleeve trims)
  const goldAccentMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HSL_COLORS.GS_GOLD,
        emissive: HSL_COLORS.GS_GOLD_ACCENT_EMISSIVE,
        emissiveIntensity: isSelected ? 0.5 : isHovered ? 0.35 : 0.15,
        roughness: 0.4,
        metalness: 0.2,
      }),
    [isHovered, isSelected],
  );

  // Athletic Shorts (Dark Charcoal / Match Shorts)
  const shortsMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HSL_COLORS.SHORTS_CHARCOAL,
        roughness: 0.8,
        metalness: 0.05,
      }),
    [],
  );

  // Skin Tone (Stylized Matte)
  const skinMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HSL_COLORS.SKIN_TONE,
        roughness: 0.85,
        metalness: 0.0,
      }),
    [],
  );

  // Hair / Head Top
  const hairMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HSL_COLORS.HAIR_DARK,
        roughness: 0.9,
        metalness: 0.0,
      }),
    [],
  );

  // Socks (Crimson with Gold Ring)
  const sockMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HSL_COLORS.GS_CRIMSON,
        roughness: 0.75,
        metalness: 0.05,
      }),
    [],
  );

  // Football Boots (Matte Black / White Studs)
  const bootMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HSL_COLORS.BOOTS_BLACK,
        roughness: 0.6,
        metalness: 0.1,
      }),
    [],
  );

  return (
    <group position={[0, 0, 0]}>
      {/* ─── 1. HEAD & HAIR (Height: ~1.72m) ─────────────────────────────── */}
      {/* Head */}
      <mesh position={[0, 1.72, 0]} material={skinMaterial} castShadow>
        <sphereGeometry args={[0.11, 16, 16]} />
      </mesh>
      {/* Hair */}
      <mesh position={[0, 1.76, -0.015]} material={hairMaterial}>
        <sphereGeometry args={[0.114, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.58, 0]} material={skinMaterial}>
        <cylinderGeometry args={[0.05, 0.055, 0.08, 12]} />
      </mesh>

      {/* ─── 2. TORSO & JERSEY (Height: 1.15m - 1.54m) ────────────────────── */}
      {/* Main Jersey Chest */}
      <mesh position={[0, 1.34, 0]} material={jerseyMaterial} castShadow>
        <boxGeometry args={[0.38, 0.38, 0.22]} />
      </mesh>
      {/* Gold Collar Trim */}
      <mesh position={[0, 1.535, 0]} material={goldAccentMaterial}>
        <torusGeometry args={[0.07, 0.015, 8, 16]} />
      </mesh>
      {/* Gold Sleeve Trim Left */}
      <mesh position={[-0.23, 1.38, 0]} rotation={[0, 0, 0.2]} material={goldAccentMaterial}>
        <torusGeometry args={[0.055, 0.012, 8, 16]} />
      </mesh>
      {/* Gold Sleeve Trim Right */}
      <mesh position={[0.23, 1.38, 0]} rotation={[0, 0, -0.2]} material={goldAccentMaterial}>
        <torusGeometry args={[0.055, 0.012, 8, 16]} />
      </mesh>

      {/* ─── 3. ARMS & HANDS ──────────────────────────────────────────────── */}
      {/* Left Upper Arm (Jersey) */}
      <mesh position={[-0.22, 1.38, 0]} rotation={[0, 0, 0.15]} material={jerseyMaterial}>
        <cylinderGeometry args={[0.055, 0.05, 0.18, 12]} />
      </mesh>
      {/* Left Forearm (Skin) */}
      <mesh position={[-0.25, 1.20, 0.02]} rotation={[0.1, 0, 0.1]} material={skinMaterial}>
        <cylinderGeometry args={[0.045, 0.04, 0.22, 12]} />
      </mesh>
      {/* Left Hand */}
      <mesh position={[-0.26, 1.07, 0.03]} material={skinMaterial}>
        <sphereGeometry args={[0.04, 8, 8]} />
      </mesh>

      {/* Right Upper Arm (Jersey) */}
      <mesh position={[0.22, 1.38, 0]} rotation={[0, 0, -0.15]} material={jerseyMaterial}>
        <cylinderGeometry args={[0.055, 0.05, 0.18, 12]} />
      </mesh>
      {/* Right Forearm (Skin) */}
      <mesh position={[0.25, 1.20, 0.02]} rotation={[0.1, 0, -0.1]} material={skinMaterial}>
        <cylinderGeometry args={[0.045, 0.04, 0.22, 12]} />
      </mesh>
      {/* Right Hand */}
      <mesh position={[0.26, 1.07, 0.03]} material={skinMaterial}>
        <sphereGeometry args={[0.04, 8, 8]} />
      </mesh>

      {/* ─── 4. SHORTS (Height: 0.88m - 1.15m) ────────────────────────────── */}
      <mesh position={[0, 1.02, 0]} material={shortsMaterial} castShadow>
        <boxGeometry args={[0.34, 0.26, 0.24]} />
      </mesh>
      {/* Left Shorts Leg */}
      <mesh position={[-0.10, 0.88, 0]} material={shortsMaterial}>
        <cylinderGeometry args={[0.09, 0.085, 0.14, 12]} />
      </mesh>
      {/* Right Shorts Leg */}
      <mesh position={[0.10, 0.88, 0]} material={shortsMaterial}>
        <cylinderGeometry args={[0.09, 0.085, 0.14, 12]} />
      </mesh>

      {/* ─── 5. LEGS & SOCKS (Height: 0.10m - 0.82m) ──────────────────────── */}
      {/* Left Thigh (Skin) */}
      <mesh position={[-0.10, 0.76, 0]} material={skinMaterial}>
        <cylinderGeometry args={[0.065, 0.055, 0.14, 12]} />
      </mesh>
      {/* Left Calf / Sock (Crimson) */}
      <mesh position={[-0.10, 0.44, 0]} material={sockMaterial} castShadow>
        <cylinderGeometry args={[0.058, 0.048, 0.50, 12]} />
      </mesh>
      {/* Left Sock Top Ring (Gold) */}
      <mesh position={[-0.10, 0.67, 0]} material={goldAccentMaterial}>
        <torusGeometry args={[0.058, 0.01, 8, 16]} />
      </mesh>

      {/* Right Thigh (Skin) */}
      <mesh position={[0.10, 0.76, 0]} material={skinMaterial}>
        <cylinderGeometry args={[0.065, 0.055, 0.14, 12]} />
      </mesh>
      {/* Right Calf / Sock (Crimson) */}
      <mesh position={[0.10, 0.44, 0]} material={sockMaterial} castShadow>
        <cylinderGeometry args={[0.058, 0.048, 0.50, 12]} />
      </mesh>
      {/* Right Sock Top Ring (Gold) */}
      <mesh position={[0.10, 0.67, 0]} material={goldAccentMaterial}>
        <torusGeometry args={[0.058, 0.01, 8, 16]} />
      </mesh>

      {/* ─── 6. FOOTBALL BOOTS (On Pitch Surface Y: 0.04m) ────────────────── */}
      {/* Left Boot */}
      <mesh position={[-0.10, 0.05, 0.04]} material={bootMaterial} castShadow>
        <boxGeometry args={[0.09, 0.08, 0.20]} />
      </mesh>
      {/* Right Boot */}
      <mesh position={[0.10, 0.05, 0.04]} material={bootMaterial} castShadow>
        <boxGeometry args={[0.09, 0.08, 0.20]} />
      </mesh>
    </group>
  );
}
