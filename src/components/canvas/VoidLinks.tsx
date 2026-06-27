"use client";

import { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUniverse } from "@/context/UniverseContext";
import {
  buildPacketPathWaypoints,
  buildPlanetTowerRoutes,
  sampleAlongPath,
} from "@/lib/universe/packet-path";

function edgeKey(a: string, b: string) {
  return [a, b].sort().join("-");
}

function towerAtmospherePoint(
  planet: ReturnType<typeof useUniverse>["planets"][number],
  towerIdx: number,
): THREE.Vector3 {
  const t = planet.towers[towerIdx];
  const equator = new THREE.Vector3(
    planet.position[0] + t.local[0],
    planet.position[1] + t.local[1],
    planet.position[2] + t.local[2],
  );
  const center = new THREE.Vector3(...planet.position);
  const radial = equator.clone().sub(center);
  if (radial.lengthSq() < 1e-8) radial.set(0, 1, 0);
  radial.normalize();
  return center.add(radial.multiplyScalar(planet.atmosphereRadius));
}

export function VoidLinks() {
  const { planets, edges, route, killed, config } = useUniverse();

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

  const activeVoidLines = useMemo(() => {
    if (route.length < 2) return [];

    const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
    const towerRoutes = buildPlanetTowerRoutes(
      route,
      nodeMap,
      config.universe_metadata.coordinate_scale_unit_km,
    );

    const lines: {
      key: string;
      points: [number, number, number][];
    }[] = [];

    for (let i = 0; i < route.length - 1; i++) {
      const from = planetMap.get(route[i]);
      const to = planetMap.get(route[i + 1]);
      if (!from || !to) continue;

      const sendTower = towerRoutes[i].exitTower;
      const recvTower = towerRoutes[i + 1].entryTower;
      const start = towerAtmospherePoint(from, sendTower);
      const end = towerAtmospherePoint(to, recvTower);

      lines.push({
        key: edgeKey(route[i], route[i + 1]),
        points: [start.toArray(), end.toArray()],
      });
    }

    return lines;
  }, [route, planetMap, config]);

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

  const packetPath = useMemo(
    () => buildPacketPathWaypoints(planets, route, config),
    [planets, route, config],
  );

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
          opacity={line.isActive ? 0.35 : line.isValid ? 0.4 : 0.15}
        />
      ))}

      {activeVoidLines.map((line) => (
        <Line
          key={`active-${line.key}`}
          points={line.points}
          color="#a5b4fc"
          lineWidth={2.5}
          transparent
          opacity={0.95}
        />
      ))}

      {packetPath.length >= 2 && (
        <Line
          points={packetPath}
          color="#6366f1"
          lineWidth={1.5}
          transparent
          opacity={0.55}
          dashed
          dashSize={0.15}
          gapSize={0.08}
        />
      )}

      {packetPath.length >= 2 && (
        <RoutePulse waypoints={packetPath} />
      )}
    </group>
  );
}

function RoutePulse({ waypoints }: { waypoints: [number, number, number][] }) {
  const ref = useRef<THREE.Mesh>(null);
  const progress = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current || waypoints.length < 2) return;
    progress.current += delta * 0.22;
    const pos = sampleAlongPath(waypoints, progress.current);
    ref.current.position.copy(pos);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.07, 16, 16]} />
      <meshBasicMaterial color="#e0e7ff" />
      <pointLight color="#c7d2fe" intensity={0.6} distance={2} decay={2} />
    </mesh>
  );
}
