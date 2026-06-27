"use client";

import { useMemo } from "react";
import { Line } from "@react-three/drei";
import type { ScenePlanet } from "@/lib/universe/types";
import { fiberArcLocalPoints, towerTipLocal } from "@/lib/universe/packet-path";

type PlanetPacketFiberProps = {
  planet: ScenePlanet;
  viaTowers: number[];
  color: string;
};

/** Glowing fiber trace along towers — lives inside the spinning planet group. */
export function PlanetPacketFiber({
  planet,
  viaTowers,
  color,
}: PlanetPacketFiberProps) {
  const points = useMemo(
    () => fiberArcLocalPoints(planet, viaTowers, 6),
    [planet, viaTowers],
  );

  if (points.length < 2) return null;

  return (
    <group>
      <Line
        points={points}
        color={color}
        lineWidth={3}
        transparent
        opacity={0.95}
      />
      <Line
        points={points}
        color="#ffffff"
        lineWidth={1.2}
        transparent
        opacity={0.85}
      />
      {viaTowers.map((idx) => {
        const [x, y, z] = towerTipLocal(planet, idx);
        return (
          <mesh key={idx} position={[x, y, z]}>
            <sphereGeometry args={[planet.visualRadius * 0.045, 12, 12]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}
