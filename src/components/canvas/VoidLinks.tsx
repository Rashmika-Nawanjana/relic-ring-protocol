"use client";

import { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUniverse } from "@/context/UniverseContext";

function edgeKey(a: string, b: string) {
  return [a, b].sort().join("-");
}

export function VoidLinks() {
  const { planets, edges, route, killed } = useUniverse();

  const planetMap = useMemo(
    () => new Map(planets.map((p) => [p.node.id, p])),
    [planets],
  );

  const routeSegments = useMemo(() => {
    const segs = new Set<string>();
    for (let i = 0; i < route.length - 1; i++) {
      segs.add(edgeKey(route[i], route[i + 1]));
    }
    return segs;
  }, [route]);

  const lineData = useMemo(() => {
    return edges
      .map((edge) => {
        const a = planetMap.get(edge.from);
        const b = planetMap.get(edge.to);
        if (!a || !b) return null;

        const key = edgeKey(edge.from, edge.to);
        const start = new THREE.Vector3(...a.position);
        const end = new THREE.Vector3(...b.position);
        const dir = end.clone().sub(start).normalize();
        start.add(dir.clone().multiplyScalar(a.atmosphereRadius));
        end.sub(dir.clone().multiplyScalar(b.atmosphereRadius));

        return {
          key,
          points: [start.toArray(), end.toArray()] as [number, number, number][],
          isActive: routeSegments.has(key),
          isValid:
            edge.valid && !killed.has(edge.from) && !killed.has(edge.to),
          invalid: edge.voidDistanceKm > 0 && !edge.valid,
        };
      })
      .filter(Boolean) as {
      key: string;
      points: [number, number, number][];
      isActive: boolean;
      isValid: boolean;
      invalid: boolean;
    }[];
  }, [edges, planetMap, routeSegments, killed]);

  return (
    <group>
      {lineData.map((line) => (
        <Line
          key={line.key}
          points={line.points}
          color={
            line.isActive
              ? "#818cf8"
              : line.isValid
                ? "#334155"
                : line.invalid
                  ? "#7f1d1d"
                  : "#1e293b"
          }
          lineWidth={line.isActive ? 2 : 1}
          transparent
          opacity={line.isActive ? 0.95 : line.isValid ? 0.4 : 0.15}
        />
      ))}

      {route.length >= 2 && (
        <RoutePulse route={route} planetMap={planetMap} />
      )}
    </group>
  );
}

function RoutePulse({
  route,
  planetMap,
}: {
  route: string[];
  planetMap: Map<
    string,
    ReturnType<typeof useUniverse>["planets"][number]
  >;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const progress = useRef(0);
  const segment = useRef(0);

  useFrame((_, delta) => {
    if (route.length < 2 || !ref.current) return;
    progress.current += delta * 0.4;
    if (progress.current >= 1) {
      progress.current = 0;
      segment.current = (segment.current + 1) % (route.length - 1);
    }

    const from = planetMap.get(route[segment.current]);
    const to = planetMap.get(route[segment.current + 1]);
    if (!from || !to) return;

    const t = progress.current;
    ref.current.position.set(
      from.position[0] + (to.position[0] - from.position[0]) * t,
      from.position[1] + 0.2 + Math.sin(t * Math.PI) * 0.3,
      from.position[2] + (to.position[2] - from.position[2]) * t,
    );
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshBasicMaterial color="#c7d2fe" />
    </mesh>
  );
}
