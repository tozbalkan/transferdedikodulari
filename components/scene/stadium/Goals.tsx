'use client';

import * as THREE from 'three';
import { GOAL_POST_COLOR, GOAL_NET_COLOR } from '@/lib/colors';

const GOAL_WIDTH = 2.4;
const GOAL_HEIGHT = 0.8;
const GOAL_DEPTH = 0.8;
const POST_RADIUS = 0.03;

function SingleGoal({ z, rotationY = 0 }: { z: number; rotationY?: number }) {
  const halfWidth = GOAL_WIDTH / 2;

  return (
    <group position={[0, 0, z]} rotation={[0, rotationY, 0]}>
      {/* Left Post */}
      <mesh position={[-halfWidth, GOAL_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, GOAL_HEIGHT, 12]} />
        <meshStandardMaterial color={GOAL_POST_COLOR} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Right Post */}
      <mesh position={[halfWidth, GOAL_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, GOAL_HEIGHT, 12]} />
        <meshStandardMaterial color={GOAL_POST_COLOR} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Crossbar */}
      <mesh position={[0, GOAL_HEIGHT, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, GOAL_WIDTH, 12]} />
        <meshStandardMaterial color={GOAL_POST_COLOR} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Rear Net Bottom Frame */}
      <mesh position={[0, 0.02, -GOAL_DEPTH / 2]}>
        <boxGeometry args={[GOAL_WIDTH, 0.02, GOAL_DEPTH]} />
        <meshStandardMaterial
          color={GOAL_NET_COLOR}
          transparent
          opacity={0.3}
          wireframe
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Net Back Wall */}
      <mesh position={[0, GOAL_HEIGHT / 2, -GOAL_DEPTH]}>
        <planeGeometry args={[GOAL_WIDTH, GOAL_HEIGHT]} />
        <meshStandardMaterial
          color={GOAL_NET_COLOR}
          transparent
          opacity={0.35}
          wireframe
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Net Roof */}
      <mesh position={[0, GOAL_HEIGHT, -GOAL_DEPTH / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GOAL_WIDTH, GOAL_DEPTH]} />
        <meshStandardMaterial
          color={GOAL_NET_COLOR}
          transparent
          opacity={0.35}
          wireframe
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Net Left Wall */}
      <mesh
        position={[-halfWidth, GOAL_HEIGHT / 2, -GOAL_DEPTH / 2]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <planeGeometry args={[GOAL_DEPTH, GOAL_HEIGHT]} />
        <meshStandardMaterial
          color={GOAL_NET_COLOR}
          transparent
          opacity={0.35}
          wireframe
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Net Right Wall */}
      <mesh position={[halfWidth, GOAL_HEIGHT / 2, -GOAL_DEPTH / 2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[GOAL_DEPTH, GOAL_HEIGHT]} />
        <meshStandardMaterial
          color={GOAL_NET_COLOR}
          transparent
          opacity={0.35}
          wireframe
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

export function Goals() {
  return (
    <group>
      {/* North Goal (faces south) */}
      <SingleGoal z={-11} rotationY={0} />
      {/* South Goal (faces north) */}
      <SingleGoal z={11} rotationY={Math.PI} />
    </group>
  );
}
