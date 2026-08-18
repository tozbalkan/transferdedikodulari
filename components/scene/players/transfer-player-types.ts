import type { Position, TransferRumor } from '@/types/transfer';

export type PitchAnchor =
  | 'FORWARD_CENTER'
  | 'FORWARD_LEFT'
  | 'FORWARD_RIGHT'
  | 'MIDFIELD_CENTER'
  | 'MIDFIELD_LEFT'
  | 'MIDFIELD_RIGHT'
  | 'DEFENDER_CENTER'
  | 'DEFENDER_LEFT'
  | 'DEFENDER_RIGHT'
  | 'GOALKEEPER';

export type TransferStatus = 'RUMORED' | 'CONTACT' | 'ADVANCED' | 'AGREEMENT';

export interface TransferPlayerEntity {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  position: Position;
  currentClub: string;
  nationality: string;
  transferStatus: TransferStatus;
  statusLabel: string;
  sourceCount: number;
  mentionCount: number;
  confidenceScore: number;
  pitchAnchor: PitchAnchor;
  localPitchPosition: [number, number, number]; // [X, Y, Z] in Local Pitch Space (meters)
  rawRumor: TransferRumor;
}
