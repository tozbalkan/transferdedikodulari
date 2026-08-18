'use client';

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { TransferPlayer } from './TransferPlayer';
import type {
  TransferPlayerEntity,
  PitchAnchor,
  TransferStatus,
} from './transfer-player-types';
import type { TransferRumor, Position } from '@/types/transfer';
import {
  PITCH_ALIGN_ROT_Y,
  PROCEDURAL_PITCH_ROT_Y,
  PROCEDURAL_PITCH_OFFSET,
} from '../stadium/RealStadium';

interface TransferPlayerLayerProps {
  rumors: TransferRumor[];
  selectedRumor: TransferRumor | null;
  onSelectRumor: (rumor: TransferRumor | null) => void;
  maxPlayers?: number; // Default 6-8 top players
}

// Visual pitch anchor coordinate map in Local Pitch Space (meters)
// Pitch Length: X in [-52, +52], Pitch Width: Z in [-34, +34], Feet on turf: Y = 0.08
export const ANCHOR_COORDINATES: Record<PitchAnchor, [number, number, number]> = {
  GOALKEEPER: [-38.0, 0.08, 0.0],
  DEFENDER_CENTER: [-24.0, 0.08, 0.0],
  DEFENDER_LEFT: [-22.0, 0.08, -16.0],
  DEFENDER_RIGHT: [-22.0, 0.08, 16.0],
  MIDFIELD_CENTER: [-2.0, 0.08, 0.0],
  MIDFIELD_LEFT: [-4.0, 0.08, -18.0],
  MIDFIELD_RIGHT: [-4.0, 0.08, 18.0],
  FORWARD_CENTER: [22.0, 0.08, 0.0],
  FORWARD_LEFT: [20.0, 0.08, -18.0],
  FORWARD_RIGHT: [20.0, 0.08, 18.0],
};

/**
 * Transforms a local pitch coordinate [x, y, z] to exact Three.js scene World Space.
 */
export function getPlayerWorldPosition(localPos: [number, number, number]): THREE.Vector3 {
  const vec = new THREE.Vector3(localPos[0], localPos[1], localPos[2]);
  // 1. Apply procedural pitch rotation
  vec.applyAxisAngle(new THREE.Vector3(0, 1, 0), PROCEDURAL_PITCH_ROT_Y);
  // 2. Apply procedural pitch offset
  vec.add(PROCEDURAL_PITCH_OFFSET);
  // 3. Apply stadium alignment rotation
  vec.applyAxisAngle(new THREE.Vector3(0, 1, 0), PITCH_ALIGN_ROT_Y);
  return vec;
}

export function getStatusFromRumor(rumor: TransferRumor): {
  status: TransferStatus;
  label: string;
} {
  const mentions = rumor.mentionCount || 1;
  const score = rumor.confidenceScore ?? rumor.score ?? 50;

  if (score >= 85 || mentions >= 15) {
    return { status: 'AGREEMENT', label: 'ANLAŞMA' };
  }
  if (score >= 70 || mentions >= 8) {
    return { status: 'ADVANCED', label: 'İLERİ SEVİYE' };
  }
  if (score >= 50 || mentions >= 4) {
    return { status: 'CONTACT', label: 'TEMAS' };
  }
  return { status: 'RUMORED', label: 'İDDİA' };
}

export function assignPitchAnchors(
  rumors: TransferRumor[],
  maxCount: number = 8,
): TransferPlayerEntity[] {
  // Sort by priority: mention count & confidence
  const sorted = [...rumors]
    .sort((a, b) => (b.mentionCount * (b.score || 1)) - (a.mentionCount * (a.score || 1)))
    .slice(0, maxCount);

  // Group by position
  const byPosition: Record<Position, TransferRumor[]> = {
    FORWARD: [],
    MIDFIELDER: [],
    DEFENDER: [],
    GOALKEEPER: [],
  };

  sorted.forEach((r) => {
    byPosition[r.player.position]?.push(r);
  });

  const entities: TransferPlayerEntity[] = [];

  // 1. Forwards
  const fwdAnchors: PitchAnchor[] = ['FORWARD_CENTER', 'FORWARD_LEFT', 'FORWARD_RIGHT'];
  byPosition.FORWARD.forEach((r, idx) => {
    const anchor = fwdAnchors[idx % fwdAnchors.length];
    const base = ANCHOR_COORDINATES[anchor];
    const offsetZ = idx >= 3 ? (idx % 2 === 0 ? 5 : -5) : 0;
    const offsetX = idx >= 3 ? -4 : 0;
    const { status, label } = getStatusFromRumor(r);

    entities.push({
      id: r.player.id,
      name: r.player.name,
      firstName: r.player.firstName,
      lastName: r.player.lastName,
      position: r.player.position,
      currentClub: r.player.currentClub,
      nationality: r.player.nationality,
      transferStatus: status,
      statusLabel: label,
      sourceCount: r.sourceCount,
      mentionCount: r.mentionCount,
      confidenceScore: r.confidenceScore ?? r.score ?? 50,
      pitchAnchor: anchor,
      localPitchPosition: [base[0] + offsetX, base[1], base[2] + offsetZ],
      rawRumor: r,
    });
  });

  // 2. Midfielders
  const midAnchors: PitchAnchor[] = ['MIDFIELD_CENTER', 'MIDFIELD_LEFT', 'MIDFIELD_RIGHT'];
  byPosition.MIDFIELDER.forEach((r, idx) => {
    const anchor = midAnchors[idx % midAnchors.length];
    const base = ANCHOR_COORDINATES[anchor];
    const offsetZ = idx >= 3 ? (idx % 2 === 0 ? 6 : -6) : 0;
    const offsetX = idx >= 3 ? -5 : 0;
    const { status, label } = getStatusFromRumor(r);

    entities.push({
      id: r.player.id,
      name: r.player.name,
      firstName: r.player.firstName,
      lastName: r.player.lastName,
      position: r.player.position,
      currentClub: r.player.currentClub,
      nationality: r.player.nationality,
      transferStatus: status,
      statusLabel: label,
      sourceCount: r.sourceCount,
      mentionCount: r.mentionCount,
      confidenceScore: r.confidenceScore ?? r.score ?? 50,
      pitchAnchor: anchor,
      localPitchPosition: [base[0] + offsetX, base[1], base[2] + offsetZ],
      rawRumor: r,
    });
  });

  // 3. Defenders
  const defAnchors: PitchAnchor[] = ['DEFENDER_CENTER', 'DEFENDER_LEFT', 'DEFENDER_RIGHT'];
  byPosition.DEFENDER.forEach((r, idx) => {
    const anchor = defAnchors[idx % defAnchors.length];
    const base = ANCHOR_COORDINATES[anchor];
    const offsetZ = idx >= 3 ? (idx % 2 === 0 ? 5 : -5) : 0;
    const offsetX = idx >= 3 ? 4 : 0;
    const { status, label } = getStatusFromRumor(r);

    entities.push({
      id: r.player.id,
      name: r.player.name,
      firstName: r.player.firstName,
      lastName: r.player.lastName,
      position: r.player.position,
      currentClub: r.player.currentClub,
      nationality: r.player.nationality,
      transferStatus: status,
      statusLabel: label,
      sourceCount: r.sourceCount,
      mentionCount: r.mentionCount,
      confidenceScore: r.confidenceScore ?? r.score ?? 50,
      pitchAnchor: anchor,
      localPitchPosition: [base[0] + offsetX, base[1], base[2] + offsetZ],
      rawRumor: r,
    });
  });

  // 4. Goalkeepers
  byPosition.GOALKEEPER.forEach((r, idx) => {
    const base = ANCHOR_COORDINATES.GOALKEEPER;
    const offsetZ = idx > 0 ? (idx % 2 === 0 ? 4 : -4) : 0;
    const { status, label } = getStatusFromRumor(r);

    entities.push({
      id: r.player.id,
      name: r.player.name,
      firstName: r.player.firstName,
      lastName: r.player.lastName,
      position: r.player.position,
      currentClub: r.player.currentClub,
      nationality: r.player.nationality,
      transferStatus: status,
      statusLabel: label,
      sourceCount: r.sourceCount,
      mentionCount: r.mentionCount,
      confidenceScore: r.confidenceScore ?? r.score ?? 50,
      pitchAnchor: 'GOALKEEPER',
      localPitchPosition: [base[0], base[1], base[2] + offsetZ],
      rawRumor: r,
    });
  });

  return entities;
}

export function TransferPlayerLayer({
  rumors,
  selectedRumor,
  onSelectRumor,
  maxPlayers = 8,
}: TransferPlayerLayerProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const playerEntities = useMemo(
    () => assignPitchAnchors(rumors, maxPlayers),
    [rumors, maxPlayers],
  );

  return (
    <group position={[0, 0, 0]}>
      {playerEntities.map((player) => (
        <TransferPlayer
          key={player.id}
          player={player}
          isHovered={hoveredId === player.id}
          isSelected={selectedRumor?.player.id === player.id}
          onHover={setHoveredId}
          onSelect={(p) => onSelectRumor(p.rawRumor)}
        />
      ))}
    </group>
  );
}
