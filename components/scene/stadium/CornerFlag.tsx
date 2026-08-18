'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { HSL_COLORS } from '@/lib/constants/colors';

interface CornerFlagProps {
  position: [number, number, number];
  rotationY?: number;
}

export function CornerFlag({ position, rotationY = 0 }: CornerFlagProps) {
  // ─── 1. Pole Material (White flexible post with slight sheen) ───────────────
  const poleMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HSL_COLORS.POLE_WHITE,
        emissive: HSL_COLORS.WHITE_LINES,
        emissiveIntensity: 0.2,
        roughness: 0.25,
        metalness: 0.1,
      }),
    [],
  );

  const capMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HSL_COLORS.GS_GOLD,
        emissive: HSL_COLORS.GS_GOLD_EMISSIVE,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        metalness: 0.4,
      }),
    [],
  );

  // ─── 2. Galatasaray Yellow-Red Checkered Flag Texture ───────────────────────
  const flagMaterial = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const red = 'hsl(347, 95%, 34%)';   // Deep Galatasaray Crimson Red in HSL
      const yellow = 'hsl(43, 98%, 53%)'; // Bright Galatasaray Gold Yellow in HSL
      const half = 64;

      // 2x2 High-contrast Checkered Flag
      ctx.fillStyle = yellow;
      ctx.fillRect(0, 0, half, half);
      ctx.fillStyle = red;
      ctx.fillRect(half, 0, half, half);
      ctx.fillStyle = red;
      ctx.fillRect(0, half, half, half);
      ctx.fillStyle = yellow;
      ctx.fillRect(half, half, half, half);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;

    return new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      roughness: 0.5,
      metalness: 0.05,
      emissive: HSL_COLORS.GS_CRIMSON_DARK,
      emissiveIntensity: 0.35,
    });
  }, []);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Flag Pole (Height = 1.60m) */}
      <mesh position={[0, 0.80, 0]} material={poleMaterial} castShadow>
        <cylinderGeometry args={[0.025, 0.025, 1.6, 16]} />
      </mesh>

      {/* Top Cap */}
      <mesh position={[0, 1.62, 0]} material={capMaterial}>
        <sphereGeometry args={[0.04, 16, 16]} />
      </mesh>

      {/* Yellow-Red Checkered Flag Cloth (55cm x 38cm) */}
      <mesh position={[0.28, 1.40, 0]} material={flagMaterial} castShadow>
        <planeGeometry args={[0.55, 0.38]} />
      </mesh>
    </group>
  );
}
