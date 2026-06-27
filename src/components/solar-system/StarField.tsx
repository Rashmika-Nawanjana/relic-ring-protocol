"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { seededRange, seededUnit } from "@/lib/solar-system/random";

const STAR_COUNT = 6000;

function buildStarFieldPositions(): Float32Array {
  const arr = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = seededRange(i * 3 + 10, 80, 200);
    const theta = seededUnit(i * 3 + 11) * Math.PI * 2;
    const phi = Math.acos(2 * seededUnit(i * 3 + 12) - 1);
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    arr[i * 3 + 2] = r * Math.cos(phi);
  }
  return arr;
}

function buildAsteroids(
  count: number,
  innerRadius: number,
  outerRadius: number,
): THREE.Mesh[] {
  const items: THREE.Mesh[] = [];
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: "#9ca3af",
    roughness: 0.9,
    metalness: 0.1,
  });

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    const orbitRadius = seededRange(i * 7 + 1, innerRadius, outerRadius);
    const angle = seededUnit(i * 7 + 2) * Math.PI * 2;
    mesh.position.set(
      orbitRadius * Math.cos(angle),
      seededRange(i * 7 + 3, -0.35, 0.35),
      orbitRadius * Math.sin(angle),
    );
    mesh.rotation.set(
      seededUnit(i * 7 + 4) * Math.PI,
      seededUnit(i * 7 + 5) * Math.PI,
      seededUnit(i * 7 + 6) * Math.PI,
    );
    mesh.scale.setScalar(seededRange(i * 7 + 7, 0.025, 0.07));
    items.push(mesh);
  }
  return items;
}

export function StarField() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => buildStarFieldPositions(), []);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.0003;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={STAR_COUNT}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        color="#ffffff"
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function AsteroidBelt({
  count,
  innerRadius,
  outerRadius,
}: {
  count: number;
  innerRadius: number;
  outerRadius: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const asteroids = useMemo(
    () => buildAsteroids(count, innerRadius, outerRadius),
    [count, innerRadius, outerRadius],
  );

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.008;
    }
  });

  return (
    <group ref={groupRef}>
      {asteroids.map((a, i) => (
        <primitive key={i} object={a} />
      ))}
    </group>
  );
}
