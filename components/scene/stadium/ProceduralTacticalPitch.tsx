'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { GoalPost } from './GoalPost';
import { CornerFlag } from './CornerFlag';
import { HSL_COLORS } from '@/lib/constants/colors';

// ─── Exact Türk Telekom Arena GLB Pitch & Billboard Dimensions ──────────────
const PITCH_LENGTH = 104.31;  // Length along X axis matching GLB billboard (m)
const PITCH_WIDTH = 68.51;    // Width along Z axis matching GLB billboard (m)
const LINE_WIDTH = 0.28;      // Line thickness (m)
const PITCH_ELEVATION = 0.08; // Elevated above base ground
const MARKING_Y = 0.02;       // Shared uniform Y-plane for all FIFA line markings

// ─── FIFA Mathematical Geometry Constants ───────────────────────────────────
// Distance from penalty spot (11.0m) to penalty area line (16.5m) is 5.5m
// Penalty arc radius is 9.15m
// Half-angle of intersection: theta = acos(5.5 / 9.15) ≈ 0.925277 rad (53.014°)
const PENALTY_ARC_HALF_ANGLE = Math.acos(5.5 / 9.15);
const PENALTY_ARC_LENGTH = 2 * PENALTY_ARC_HALF_ANGLE;

export function ProceduralTacticalPitch() {
  // ─── 1. Materials (Clean Tactical Broadcast Graphic in pure HSL) ───────────
  const darkStripeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HSL_COLORS.PITCH_BAND_DARK,
        emissive: HSL_COLORS.PITCH_BASE_DARK,
        emissiveIntensity: 0.22,
        roughness: 0.88,
        metalness: 0.0,
      }),
    [],
  );

  const lightStripeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HSL_COLORS.PITCH_BAND_LIGHT,
        emissive: HSL_COLORS.PITCH_GLB_BASE,
        emissiveIntensity: 0.22,
        roughness: 0.88,
        metalness: 0.0,
      }),
    [],
  );

  // Clean, crisp slightly emissive white FIFA pitch markings
  const pitchLineMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: HSL_COLORS.WHITE_LINES,
        emissive: HSL_COLORS.WHITE_LINES,
        emissiveIntensity: 0.75,
        roughness: 0.15,
        metalness: 0.0,
      }),
    [],
  );

  // 12 alternating mowing turf bands along pitch length (X)
  const stripes = useMemo(() => {
    const count = 12;
    const bandWidth = PITCH_LENGTH / count;
    return Array.from({ length: count }, (_, i) => ({
      x: -PITCH_LENGTH / 2 + (i + 0.5) * bandWidth,
      width: bandWidth,
      isDark: i % 2 === 0,
    }));
  }, []);

  return (
    <group position={[0, PITCH_ELEVATION, 0]}>
      {/* ─── 1. PROCEDURAL MOWING BANDS (Tactical Illustrated Pitch) ─────── */}
      {stripes.map((stripe, idx) => (
        <mesh
          key={`mowing-stripe-${idx}`}
          position={[stripe.x, 0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={stripe.isDark ? darkStripeMat : lightStripeMat}
          receiveShadow
        >
          <planeGeometry args={[stripe.width, PITCH_WIDTH]} />
        </mesh>
      ))}

      {/* ─── 2. PROCEDURAL FIFA PITCH MARKINGS ───────────────────────────── */}
      {/* Outer Touchlines (North & South along X) */}
      <mesh
        position={[0, MARKING_Y, -PITCH_WIDTH / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[PITCH_LENGTH + LINE_WIDTH, LINE_WIDTH]} />
      </mesh>
      <mesh
        position={[0, MARKING_Y, PITCH_WIDTH / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[PITCH_LENGTH + LINE_WIDTH, LINE_WIDTH]} />
      </mesh>

      {/* Outer Goal Lines (West & East along Z) */}
      <mesh
        position={[-PITCH_LENGTH / 2, MARKING_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[LINE_WIDTH, PITCH_WIDTH + LINE_WIDTH]} />
      </mesh>
      <mesh
        position={[PITCH_LENGTH / 2, MARKING_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[LINE_WIDTH, PITCH_WIDTH + LINE_WIDTH]} />
      </mesh>

      {/* Halfway Line (along Z at X=0) */}
      <mesh position={[0, MARKING_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={pitchLineMat}>
        <planeGeometry args={[LINE_WIDTH, PITCH_WIDTH]} />
      </mesh>

      {/* Center Circle (Radius 9.15m) */}
      <mesh position={[0, MARKING_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={pitchLineMat}>
        <ringGeometry args={[9.15 - LINE_WIDTH / 2, 9.15 + LINE_WIDTH / 2, 64]} />
      </mesh>

      {/* Center Spot */}
      <mesh position={[0, MARKING_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} material={pitchLineMat}>
        <circleGeometry args={[0.5, 32]} />
      </mesh>

      {/* ─── 3. WEST PENALTY & GOAL AREA (-X end) ───────────────────────── */}
      {/* 18-Yard Penalty Box (40.32m wide, 16.5m deep) */}
      <mesh
        position={[-PITCH_LENGTH / 2 + 16.5 / 2, MARKING_Y, -40.32 / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[16.5, LINE_WIDTH]} />
      </mesh>
      <mesh
        position={[-PITCH_LENGTH / 2 + 16.5 / 2, MARKING_Y, 40.32 / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[16.5, LINE_WIDTH]} />
      </mesh>
      <mesh
        position={[-PITCH_LENGTH / 2 + 16.5, MARKING_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[LINE_WIDTH, 40.32]} />
      </mesh>

      {/* 6-Yard Goal Box (18.32m wide, 5.5m deep) */}
      <mesh
        position={[-PITCH_LENGTH / 2 + 5.5 / 2, MARKING_Y, -18.32 / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[5.5, LINE_WIDTH]} />
      </mesh>
      <mesh
        position={[-PITCH_LENGTH / 2 + 5.5 / 2, MARKING_Y, 18.32 / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[5.5, LINE_WIDTH]} />
      </mesh>
      <mesh
        position={[-PITCH_LENGTH / 2 + 5.5, MARKING_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[LINE_WIDTH, 18.32]} />
      </mesh>

      {/* West Penalty Spot (11.0m from goal line) */}
      <mesh
        position={[-PITCH_LENGTH / 2 + 11.0, MARKING_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <circleGeometry args={[0.35, 24]} />
      </mesh>

      {/* West Penalty Arc (D-Arc perfectly clipped to 16.5m penalty box front line) */}
      <mesh
        position={[-PITCH_LENGTH / 2 + 11.0, MARKING_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <ringGeometry
          args={[
            9.15 - LINE_WIDTH / 2,
            9.15 + LINE_WIDTH / 2,
            48,
            1,
            -PENALTY_ARC_HALF_ANGLE,
            PENALTY_ARC_LENGTH,
          ]}
        />
      </mesh>

      {/* ─── 4. EAST PENALTY & GOAL AREA (+X end) ───────────────────────── */}
      {/* 18-Yard Penalty Box */}
      <mesh
        position={[PITCH_LENGTH / 2 - 16.5 / 2, MARKING_Y, -40.32 / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[16.5, LINE_WIDTH]} />
      </mesh>
      <mesh
        position={[PITCH_LENGTH / 2 - 16.5 / 2, MARKING_Y, 40.32 / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[16.5, LINE_WIDTH]} />
      </mesh>
      <mesh
        position={[PITCH_LENGTH / 2 - 16.5, MARKING_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[LINE_WIDTH, 40.32]} />
      </mesh>

      {/* 6-Yard Goal Box */}
      <mesh
        position={[PITCH_LENGTH / 2 - 5.5 / 2, MARKING_Y, -18.32 / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[5.5, LINE_WIDTH]} />
      </mesh>
      <mesh
        position={[PITCH_LENGTH / 2 - 5.5 / 2, MARKING_Y, 18.32 / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[5.5, LINE_WIDTH]} />
      </mesh>
      <mesh
        position={[PITCH_LENGTH / 2 - 5.5, MARKING_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <planeGeometry args={[LINE_WIDTH, 18.32]} />
      </mesh>

      {/* East Penalty Spot */}
      <mesh
        position={[PITCH_LENGTH / 2 - 11.0, MARKING_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <circleGeometry args={[0.35, 24]} />
      </mesh>

      {/* East Penalty Arc (D-Arc perfectly clipped to 16.5m penalty box front line) */}
      <mesh
        position={[PITCH_LENGTH / 2 - 11.0, MARKING_Y, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <ringGeometry
          args={[
            9.15 - LINE_WIDTH / 2,
            9.15 + LINE_WIDTH / 2,
            48,
            1,
            Math.PI - PENALTY_ARC_HALF_ANGLE,
            PENALTY_ARC_LENGTH,
          ]}
        />
      </mesh>

      {/* ─── 5. 4 FIFA CORNER ARCS (Inward Quarter-Circles) ─────────────── */}
      {/* West-North Corner (-L/2, -W/2) */}
      <mesh
        position={[-PITCH_LENGTH / 2, MARKING_Y, -PITCH_WIDTH / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <ringGeometry args={[1.0 - LINE_WIDTH / 2, 1.0 + LINE_WIDTH / 2, 16, 1, -Math.PI / 2, Math.PI / 2]} />
      </mesh>

      {/* East-North Corner (+L/2, -W/2) */}
      <mesh
        position={[PITCH_LENGTH / 2, MARKING_Y, -PITCH_WIDTH / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <ringGeometry args={[1.0 - LINE_WIDTH / 2, 1.0 + LINE_WIDTH / 2, 16, 1, Math.PI, Math.PI / 2]} />
      </mesh>

      {/* West-South Corner (-L/2, +W/2) */}
      <mesh
        position={[-PITCH_LENGTH / 2, MARKING_Y, PITCH_WIDTH / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <ringGeometry args={[1.0 - LINE_WIDTH / 2, 1.0 + LINE_WIDTH / 2, 16, 1, 0, Math.PI / 2]} />
      </mesh>

      {/* East-South Corner (+L/2, +W/2) */}
      <mesh
        position={[PITCH_LENGTH / 2, MARKING_Y, PITCH_WIDTH / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={pitchLineMat}
      >
        <ringGeometry args={[1.0 - LINE_WIDTH / 2, 1.0 + LINE_WIDTH / 2, 16, 1, Math.PI / 2, Math.PI / 2]} />
      </mesh>

      {/* ─── 6. 4 GALATASARAY CHECKERED CORNER FLAGS ─────────────────────── */}
      <CornerFlag position={[-PITCH_LENGTH / 2, MARKING_Y, -PITCH_WIDTH / 2]} rotationY={Math.PI / 4} />
      <CornerFlag position={[PITCH_LENGTH / 2, MARKING_Y, -PITCH_WIDTH / 2]} rotationY={(3 * Math.PI) / 4} />
      <CornerFlag position={[-PITCH_LENGTH / 2, MARKING_Y, PITCH_WIDTH / 2]} rotationY={-Math.PI / 4} />
      <CornerFlag position={[PITCH_LENGTH / 2, MARKING_Y, PITCH_WIDTH / 2]} rotationY={-(3 * Math.PI) / 4} />

      {/* ─── 7. 3D REALISTIC FOOTBALL GOALS & NETS ───────────────────────── */}
      {/* West Goal (-X end, faces +X) */}
      <GoalPost position={[-PITCH_LENGTH / 2, 0, 0]} rotationY={0} />

      {/* East Goal (+X end, faces -X) */}
      <GoalPost position={[PITCH_LENGTH / 2, 0, 0]} rotationY={Math.PI} />
    </group>
  );
}
