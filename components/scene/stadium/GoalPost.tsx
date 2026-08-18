'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

// ─── FIFA Standard Goal Dimensions ──────────────────────────────────────────
const GOAL_WIDTH = 7.32;   // 8 yards (along pitch width / Z axis)
const GOAL_HEIGHT = 2.44;  // 8 feet (along Y axis)
const TOP_DEPTH = 0.8;     // Top roof depth (along -X)
const BASE_DEPTH = 2.0;    // Rear ground depth (along -X)
const POST_RADIUS = 0.06;  // 12 cm post diameter

interface GoalPostProps {
  position: [number, number, number];
  rotationY?: number; // 0 for West goal (facing +X), Math.PI for East goal (facing -X)
}

export function GoalPost({ position, rotationY = 0 }: GoalPostProps) {
  // Goal Post Material: Semi-gloss pristine white with subtle emissive response
  const postMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#ffffff',
        emissiveIntensity: 0.25,
        roughness: 0.2,
        metalness: 0.1,
      }),
    [],
  );

  // Rear Net Support Stanchions Material: Clean galvanized steel
  const frameMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#8b95a0',
        roughness: 0.5,
        metalness: 0.3,
      }),
    [],
  );

  // 3D Goal Net Material: Translucent lightweight white grid
  const netMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#dce5ee',
        wireframe: true,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  );

  // Watertight 3D Net Geometry extending backwards behind the goal line (-X)
  const netGeometry = useMemo(() => {
    const halfW = GOAL_WIDTH / 2;
    const geom = new THREE.BufferGeometry();

    // Vertices:
    // 0: Front Top Left   (0, H, -halfW)
    // 1: Front Top Right  (0, H, halfW)
    // 2: Back Top Left    (-TOP_DEPTH, H, -halfW)
    // 3: Back Top Right   (-TOP_DEPTH, H, halfW)
    // 4: Back Base Left   (-BASE_DEPTH, 0, -halfW)
    // 5: Back Base Right  (-BASE_DEPTH, 0, halfW)
    // 6: Front Base Left  (0, 0, -halfW)
    // 7: Front Base Right (0, 0, halfW)

    const vertices = new Float32Array([
      0, GOAL_HEIGHT, -halfW,          // 0
      0, GOAL_HEIGHT, halfW,           // 1
      -TOP_DEPTH, GOAL_HEIGHT, -halfW, // 2
      -TOP_DEPTH, GOAL_HEIGHT, halfW,  // 3
      -BASE_DEPTH, 0.02, -halfW,       // 4
      -BASE_DEPTH, 0.02, halfW,        // 5
      0, 0.02, -halfW,                 // 6
      0, 0.02, halfW,                  // 7
    ]);

    // Triangle indices:
    const indices = [
      // Top Roof Panel (0, 1, 3, 2)
      0, 1, 3,
      0, 3, 2,

      // Sloping Back Wall (2, 3, 5, 4)
      2, 3, 5,
      2, 5, 4,

      // Left Side Panel (6, 0, 2, 4)
      6, 0, 2,
      6, 2, 4,

      // Right Side Panel (7, 1, 3, 5)
      7, 3, 1,
      7, 5, 3,
    ];

    geom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, []);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* ─── 1. FRONT GOAL FRAME (Posts + Crossbar) ──────────────────────── */}
      {/* Left Vertical Post */}
      <mesh
        position={[0, GOAL_HEIGHT / 2, -GOAL_WIDTH / 2]}
        castShadow
        material={postMaterial}
      >
        <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, GOAL_HEIGHT, 16]} />
      </mesh>

      {/* Right Vertical Post */}
      <mesh
        position={[0, GOAL_HEIGHT / 2, GOAL_WIDTH / 2]}
        castShadow
        material={postMaterial}
      >
        <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, GOAL_HEIGHT, 16]} />
      </mesh>

      {/* Horizontal Crossbar */}
      <mesh
        position={[0, GOAL_HEIGHT, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        material={postMaterial}
      >
        <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, GOAL_WIDTH, 16]} />
      </mesh>

      {/* ─── 2. REAR NET SUPPORT FRAME (Behind Posts into -X) ─────────────── */}
      {/* Left Top Horizontal Bar (from post back into -X) */}
      <mesh
        position={[-TOP_DEPTH / 2, GOAL_HEIGHT, -GOAL_WIDTH / 2]}
        rotation={[0, 0, Math.PI / 2]}
        material={frameMaterial}
      >
        <cylinderGeometry args={[0.025, 0.025, TOP_DEPTH, 12]} />
      </mesh>

      {/* Right Top Horizontal Bar */}
      <mesh
        position={[-TOP_DEPTH / 2, GOAL_HEIGHT, GOAL_WIDTH / 2]}
        rotation={[0, 0, Math.PI / 2]}
        material={frameMaterial}
      >
        <cylinderGeometry args={[0.025, 0.025, TOP_DEPTH, 12]} />
      </mesh>

      {/* Left Ground Base Bar */}
      <mesh
        position={[-BASE_DEPTH / 2, 0.03, -GOAL_WIDTH / 2]}
        rotation={[0, 0, Math.PI / 2]}
        material={frameMaterial}
      >
        <cylinderGeometry args={[0.025, 0.025, BASE_DEPTH, 12]} />
      </mesh>

      {/* Right Ground Base Bar */}
      <mesh
        position={[-BASE_DEPTH / 2, 0.03, GOAL_WIDTH / 2]}
        rotation={[0, 0, Math.PI / 2]}
        material={frameMaterial}
      >
        <cylinderGeometry args={[0.025, 0.025, BASE_DEPTH, 12]} />
      </mesh>

      {/* Rear Ground Connecting Bar */}
      <mesh
        position={[-BASE_DEPTH, 0.03, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={frameMaterial}
      >
        <cylinderGeometry args={[0.025, 0.025, GOAL_WIDTH, 12]} />
      </mesh>

      {/* ─── 3. 3D WATERTIGHT GOAL NET ───────────────────────────────────── */}
      <mesh geometry={netGeometry} material={netMaterial} />
    </group>
  );
}
