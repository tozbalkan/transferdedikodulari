'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { HSL_COLORS } from '@/lib/constants/colors';
import type { TransferStatus } from './transfer-player-types';

interface TransferPlayerRingProps {
  status: TransferStatus;
  isHovered?: boolean;
  isSelected?: boolean;
}

export function TransferPlayerRing({
  status,
  isHovered = false,
  isSelected = false,
}: TransferPlayerRingProps) {
  const ringRef = useRef<THREE.Group>(null);

  const statusColor = useMemo(() => {
    switch (status) {
      case 'AGREEMENT':
        return HSL_COLORS.STATUS_AGREEMENT;
      case 'ADVANCED':
        return HSL_COLORS.STATUS_ADVANCED;
      case 'CONTACT':
        return HSL_COLORS.STATUS_CONTACT;
      case 'RUMORED':
      default:
        return HSL_COLORS.STATUS_RUMORED;
    }
  }, [status]);

  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: statusColor,
        transparent: true,
        opacity: isSelected ? 0.85 : isHovered ? 0.7 : 0.4,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [statusColor, isHovered, isSelected],
  );

  const innerRingMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: statusColor,
        transparent: true,
        opacity: isSelected ? 0.35 : isHovered ? 0.25 : 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [statusColor, isHovered, isSelected],
  );

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * (isSelected ? 0.6 : 0.2);
    }
  });

  const baseScale = isSelected ? 1.25 : isHovered ? 1.15 : 1.0;

  return (
    <group position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={baseScale}>
      <group ref={ringRef}>
        {/* Outer Ring */}
        <mesh material={ringMaterial}>
          <ringGeometry args={[0.58, 0.64, 32]} />
        </mesh>
        {/* Subtle Semi-Transparent Inner Disc */}
        <mesh material={innerRingMaterial}>
          <circleGeometry args={[0.56, 32]} />
        </mesh>
        {/* 4 Cardinal Radar Tick Marks */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
          <mesh key={`tick-${i}`} rotation={[0, 0, angle]} position={[0.66, 0, 0]} material={ringMaterial}>
            <planeGeometry args={[0.08, 0.03]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
