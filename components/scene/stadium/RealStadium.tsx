'use client';

import { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { ProceduralTacticalPitch } from './ProceduralTacticalPitch';
import { getPitchGeometry, type PitchGeometryInfo } from '@/lib/stadium/pitch-geometry';
import { HSL_COLORS } from '@/lib/constants/colors';

const MODEL_PATH = '/stadyum/turktelekomarena.glb';

// Exact pitch center origin inside Türk Telekom Arena GLB raw coordinate space
export const STADIUM_PITCH_ORIGIN = new THREE.Vector3(22.733, 9.620, 0.170);
// Aligns open bowl and pitch directly facing broadcast VIP camera
export const PITCH_ALIGN_ROT_Y = 1.5708;
// Exact mathematical alignment angle with GLB stadium pitch/billboard axis (0.0007m precision)
export const PROCEDURAL_PITCH_ROT_Y = 54.70 * (Math.PI / 180);
// Exact pitch center is at [0, 0, 0] in the calibrated origin
export const PROCEDURAL_PITCH_OFFSET = new THREE.Vector3(0, 0, 0);

interface RealStadiumProps {
  onGeometryComputed?: (pitchInfo: PitchGeometryInfo) => void;
  children?: React.ReactNode;
}

export function RealStadium({ onGeometryComputed, children }: RealStadiumProps) {
  const gltf = useGLTF(MODEL_PATH);

  const { clonedScene, pitchInfo } = useMemo(() => {
    const scene = gltf.scene.clone(true);

    // 1. Remove unwanted Google Earth terrain, roof domes, billboards, scoreboards, and signs
    const toRemove: THREE.Object3D[] = [];
    scene.traverse((child) => {
      const name = (child.name || '').toLowerCase();
      if (
        name.includes('google') ||
        name.includes('snapshot') ||
        name.includes('terrain') ||
        name.includes('component#3') ||
        name.includes('component#41') ||
        name.includes('component#46') ||
        name.includes('group#3') ||
        name.includes('group#2') ||
        name.includes('roof') ||
        name.includes('dome') ||
        name.includes('kale') ||
        name.includes('goal') ||
        name.includes('bilboard') ||
        name.includes('billboard') ||
        name.includes('skorboard') ||
        name.includes('scoreboard') ||
        name.includes('ttarenayazi') ||
        name.includes('pankart')
      ) {
        toRemove.push(child);
      }
    });
    toRemove.forEach((child) => {
      child.parent?.remove(child);
    });

    // 2. Apply dark cinematic material palette in pure HSL
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const applyDarkCinematicTheme = (m: THREE.Material) => {
          const mat = m.clone() as THREE.MeshStandardMaterial;
          mat.side = THREE.DoubleSide;
          const matName = (mat.name || '').toLowerCase();

          // Hide unwanted billboard, scoreboard, snapshot, and terrain materials
          if (
            matName.includes('snapshot') ||
            matName.includes('google') ||
            matName.includes('terrain') ||
            matName.includes('corrogated') ||
            matName.includes('shiny') ||
            matName.includes('bilboard') ||
            matName.includes('billboard') ||
            matName.includes('skorboard') ||
            matName.includes('scoreboard') ||
            matName.includes('ttarenayazi') ||
            matName.includes('pankart')
          ) {
            child.visible = false;
            child.geometry = new THREE.BufferGeometry();
            return new THREE.MeshBasicMaterial({ visible: false });
          }

          // Subdued Dark Crimson Red Seating (never flat bright red)
          if (matName.includes('koltuk') || matName.includes('kirmizi')) {
            mat.color = new THREE.Color(HSL_COLORS.STADIUM_SEATS);
            mat.emissive = new THREE.Color(HSL_COLORS.STADIUM_SEATS_EMISSIVE);
            mat.emissiveIntensity = 0.12;
            mat.roughness = 0.94;
            mat.metalness = 0.05;
            return mat;
          }

          // Base GLB ground mesh under ProceduralTacticalPitch
          if (matName === '*2' || matName === 'pnd' || matName === 'grass' || matName === 'cim') {
            mat.color = new THREE.Color(HSL_COLORS.PITCH_GLB_BASE);
            mat.emissive = new THREE.Color(HSL_COLORS.PITCH_BASE_DARK);
            mat.emissiveIntensity = 0.1;
            mat.roughness = 0.95;
            mat.metalness = 0.0;
            return mat;
          }

          // Concrete, Roof Rims, Stairs, Facades, Walls, Roof Trusses -> Deep Charcoal / Gunmetal
          mat.color = new THREE.Color(HSL_COLORS.STADIUM_CONCRETE);
          mat.emissive = new THREE.Color(HSL_COLORS.STADIUM_CONCRETE_EMISSIVE);
          mat.emissiveIntensity = 0.05;
          mat.roughness = 0.95;
          mat.metalness = 0.05;
          return mat;
        };

        if (Array.isArray(child.material)) {
          child.material = child.material.map(applyDarkCinematicTheme);
        } else if (child.material) {
          child.material = applyDarkCinematicTheme(child.material);
        }
      }
    });

    const info = getPitchGeometry(scene);

    return {
      clonedScene: scene,
      pitchInfo: info,
    };
  }, [gltf]);

  useEffect(() => {
    if (onGeometryComputed) {
      onGeometryComputed(pitchInfo);
    }
  }, [pitchInfo, onGeometryComputed]);

  return (
    <group position={[0, 0, 0]}>
      {/* ─── Authentic Türk Telekom Arena GLB Model + Tactical Surface ─── */}
      <group rotation={[0, PITCH_ALIGN_ROT_Y, 0]}>
        <primitive
          object={clonedScene}
          position={[-STADIUM_PITCH_ORIGIN.x, -STADIUM_PITCH_ORIGIN.y, -STADIUM_PITCH_ORIGIN.z]}
        />
        {/* Procedural Tactical Pitch + Transfer Player Layer in Local Pitch Space */}
        <group
          position={[PROCEDURAL_PITCH_OFFSET.x, PROCEDURAL_PITCH_OFFSET.y, PROCEDURAL_PITCH_OFFSET.z]}
          rotation={[0, PROCEDURAL_PITCH_ROT_Y, 0]}
        >
          <ProceduralTacticalPitch />
          {children}
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_PATH);
