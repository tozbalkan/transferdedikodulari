'use client';

import { Canvas } from '@react-three/fiber';
import { Suspense, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { RealStadium } from './stadium/RealStadium';
import { SceneLights } from './effects/SceneLights';
import { Atmosphere } from './effects/Atmosphere';
import { CameraController } from './camera/CameraController';
import {
  TransferPlayerLayer,
  assignPitchAnchors,
  getPlayerWorldPosition,
} from './players/TransferPlayerLayer';
import { getInitialBroadcastCamera, type PitchGeometryInfo } from '@/lib/stadium/pitch-geometry';
import type { Position, TransferRumor } from '@/types/transfer';

interface TransferUniverseProps {
  rumors: TransferRumor[];
  selectedRumor: TransferRumor | null;
  activePositionFilter?: Position | null;
  onSelectRumor: (rumor: TransferRumor | null) => void;
}

export function TransferUniverse({
  rumors,
  selectedRumor,
  activePositionFilter,
  onSelectRumor,
}: TransferUniverseProps) {
  const [pitchInfo, setPitchInfo] = useState<PitchGeometryInfo | null>(null);

  const handleGeometryComputed = useCallback((info: PitchGeometryInfo) => {
    setPitchInfo(info);
  }, []);

  // Filter rumors if activePositionFilter is set
  const filteredRumors = useMemo(() => {
    if (!activePositionFilter) return rumors;
    return rumors.filter((r) => r.player.position === activePositionFilter);
  }, [rumors, activePositionFilter]);

  // Exact World Position of currently selected player
  const selectedPlayerWorldPos = useMemo(() => {
    if (!selectedRumor) return null;

    const entities = assignPitchAnchors(filteredRumors, 8);
    const targetEntity = entities.find((e) => e.id === selectedRumor.player.id);
    if (!targetEntity) return null;

    return getPlayerWorldPosition(targetEntity.localPitchPosition);
  }, [filteredRumors, selectedRumor]);

  // Initial broadcast camera configuration derived from pitch
  const cameraConfig = useMemo(() => {
    if (pitchInfo) {
      return getInitialBroadcastCamera(pitchInfo, 46);
    }
    return {
      position: new THREE.Vector3(-2, 36, 46),
      target: new THREE.Vector3(0, 0, -3),
      fov: 46,
      near: 0.5,
      far: 600,
      minDistance: 22,
      maxDistance: 135,
      minPolarAngle: 0.15,
      maxPolarAngle: Math.PI / 2.32,
    };
  }, [pitchInfo]);

  return (
    <div className="relative w-full h-full z-0 bg-[hsl(228,38%,5%)]">
      <Canvas
        camera={{
          position: [cameraConfig.position.x, cameraConfig.position.y, cameraConfig.position.z],
          fov: cameraConfig.fov,
          near: cameraConfig.near,
          far: cameraConfig.far,
        }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        onPointerMissed={() => onSelectRumor(null)}
      >
        <Atmosphere />
        <SceneLights />

        <Suspense fallback={null}>
          {/* Authentic Türk Telekom Arena GLB Model + Procedural Pitch + 3D Transfer Players */}
          <RealStadium onGeometryComputed={handleGeometryComputed}>
            <TransferPlayerLayer
              rumors={filteredRumors}
              selectedRumor={selectedRumor}
              onSelectRumor={onSelectRumor}
              maxPlayers={8}
            />
          </RealStadium>
        </Suspense>

        <CameraController playerWorldPosition={selectedPlayerWorldPos} pitchInfo={pitchInfo} />
      </Canvas>
    </div>
  );
}
