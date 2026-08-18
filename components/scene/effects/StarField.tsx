'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PARTICLE_COLOR } from '@/lib/colors';

const PARTICLE_COUNT = 240;
const SPREAD_XZ = 45;
const SPREAD_Y_MIN = 8;
const SPREAD_Y_MAX = 32;
const DRIFT_SPEED = 0.06;
const PARTICLE_SIZE = 0.07;

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function StarField() {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, opacities } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const opa = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      pos[i3] = (seededRandom(i * 3) - 0.5) * SPREAD_XZ;
      pos[i3 + 1] = SPREAD_Y_MIN + seededRandom(i * 3 + 1) * (SPREAD_Y_MAX - SPREAD_Y_MIN);
      pos[i3 + 2] = (seededRandom(i * 3 + 2) - 0.5) * SPREAD_XZ;
      opa[i] = 0.2 + seededRandom(i * 7) * 0.5;
    }

    return { positions: pos, opacities: opa };
  }, []);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    return geo;
  }, [positions, opacities]);

  useEffect(() => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.getAttribute('position');
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      posArray[i3] += (Math.random() - 0.5) * 1.5;
      posArray[i3 + 2] += (Math.random() - 0.5) * 1.5;
    }
    posAttr.needsUpdate = true;
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    const posAttr = pointsRef.current.geometry.getAttribute('position');
    const posArray = posAttr.array as Float32Array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      posArray[i3 + 1] += DRIFT_SPEED * delta;
      posArray[i3] += Math.sin(posArray[i3 + 1] * 0.25 + i) * 0.0015;

      if (posArray[i3 + 1] > SPREAD_Y_MAX) {
        posArray[i3 + 1] = SPREAD_Y_MIN;
        posArray[i3] = (seededRandom(i * 13 + posArray[i3 + 1]) - 0.5) * SPREAD_XZ;
        posArray[i3 + 2] = (seededRandom(i * 17 + posArray[i3 + 1]) - 0.5) * SPREAD_XZ;
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color={PARTICLE_COLOR}
        size={PARTICLE_SIZE}
        transparent
        opacity={0.35}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
