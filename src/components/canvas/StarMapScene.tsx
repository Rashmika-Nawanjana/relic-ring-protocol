"use client";

import { Suspense } from "react";

const PLANETS = [
  { name: "Aegis", color: "#818cf8", position: [-3, 1, 0] as const, size: 0.45 },
  { name: "Boreas", color: "#38bdf8", position: [-1, -1.5, 0.5] as const, size: 0.3 },
  { name: "Dawn", color: "#fbbf24", position: [1, 2, -0.5] as const, size: 0.25 },
  { name: "Elysium", color: "#34d399", position: [2.5, 0, 0] as const, size: 0.55 },
  { name: "Fenix", color: "#f87171", position: [0, -2, 0.25] as const, size: 0.22 },
  { name: "Caelum", color: "#a78bfa", position: [3.5, -1.5, -0.25] as const, size: 0.7 },
] as const;

function Planet({
  color,
  position,
  size,
}: {
  color: string;
  position: readonly [number, number, number];
  size: number;
}) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
    </mesh>
  );
}

export function StarMapScene() {
  return (
    <Suspense fallback={null}>
      {PLANETS.map((planet) => (
        <Planet key={planet.name} {...planet} />
      ))}
    </Suspense>
  );
}
