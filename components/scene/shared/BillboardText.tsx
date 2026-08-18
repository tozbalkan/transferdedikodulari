'use client';

import { ReactNode } from 'react';
import { Billboard } from '@react-three/drei';

interface BillboardTextProps {
  position?: [number, number, number];
  children: ReactNode;
}

export function BillboardText({ position = [0, 0, 0], children }: BillboardTextProps) {
  return (
    <Billboard position={position} follow lockX={false} lockY={false} lockZ={false}>
      {children}
    </Billboard>
  );
}
