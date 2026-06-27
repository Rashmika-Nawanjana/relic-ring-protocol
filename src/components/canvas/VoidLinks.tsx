"use client";

import { useMemo, useRef, useState } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUniverse } from "@/context/UniverseContext";
import { planetSpinY } from "@/lib/solar-system/spin";
import {
  buildAnimatedPacketPath,
  buildPlanetTowerRoutes,
  pathLength,
  sampleAlongPath,
  towerTipWorld,
} from "@/lib/universe/packet-path";

function edgeKey(a: string, b: string) {
  return [a, b].sort().join("-");
}

export function VoidLinks() {
  const {
    planets,
    edges,
    route,
    killed,
    config,
    selectedId,
    hoveredId,
    sceneSettings,
  } = useUniverse();

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

  const hasRoute = route.length >= 2;
  const showPaths = sceneSettings.showTowerPaths;

  return (
    <group>
      {showPaths &&
        lineData.map((line) => (
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

      {hasRoute && (
        <ActiveRouteVisuals
          route={route}
          planets={planets}
          config={config}
          planetMap={planetMap}
          selectedId={selectedId}
          hoveredId={hoveredId}
          rotationSpeed={sceneSettings.rotationSpeed}
          showTowerPaths={showPaths}
        />
      )}
    </group>
  );
}

function ActiveRouteVisuals({
  route,
  planets,
  config,
  planetMap,
  selectedId,
  hoveredId,
  rotationSpeed,
  showTowerPaths,
}: {
  route: string[];
  planets: ReturnType<typeof useUniverse>["planets"];
  config: ReturnType<typeof useUniverse>["config"];
  planetMap: Map<string, ReturnType<typeof useUniverse>["planets"][number]>;
  selectedId: string | null;
  hoveredId: string | null;
  rotationSpeed: number;
  showTowerPaths: boolean;
}) {
  const pulseRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const progress = useRef(0);

  const nodeMap = useMemo(
    () => new Map(config.nodes.map((n) => [n.id, n])),
    [config],
  );

  const towerRoutes = useMemo(
    () =>
      buildPlanetTowerRoutes(
        route,
        nodeMap,
        config.universe_metadata.coordinate_scale_unit_km,
      ),
    [route, nodeMap, config],
  );

  useFrame((state, delta) => {
    const spinByPlanet = new Map<string, number>();
    for (const p of planets) {
      const focused =
        selectedId === p.node.id || hoveredId === p.node.id;
      spinByPlanet.set(
        p.node.id,
        planetSpinY(state.clock.elapsedTime, rotationSpeed, focused),
      );
    }

    const path = buildAnimatedPacketPath(
      planets,
      route,
      config,
      spinByPlanet,
    );

    if (path.length < 2 || !pulseRef.current) return;

    const len = pathLength(path);
    progress.current += delta * (0.45 / Math.max(len * 0.08, 0.35));
    const pos = sampleAlongPath(path, progress.current);

    pulseRef.current.position.copy(pos);
    haloRef.current?.position.copy(pos);
    lightRef.current?.position.copy(pos);
  });

  return (
    <group>
      {showTowerPaths &&
        towerRoutes.map((tr, i) => {
          if (i >= route.length - 1) return null;
          const from = planetMap.get(route[i]);
          const to = planetMap.get(route[i + 1]);
          if (!from || !to) return null;
          const key = edgeKey(route[i], route[i + 1]);
          return (
            <VoidHopLine
              key={key}
              from={from}
              to={to}
              sendTower={tr.exitTower}
              recvTower={towerRoutes[i + 1].entryTower}
              selectedId={selectedId}
              hoveredId={hoveredId}
              rotationSpeed={rotationSpeed}
            />
          );
        })}

      <mesh ref={pulseRef}>
        <sphereGeometry args={[0.22, 20, 20]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshBasicMaterial
          color="#a5b4fc"
          transparent
          opacity={0.35}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        color="#c7d2fe"
        intensity={3}
        distance={12}
        decay={2}
      />
    </group>
  );
}

function VoidHopLine({
  from,
  to,
  sendTower,
  recvTower,
  selectedId,
  hoveredId,
  rotationSpeed,
}: {
  from: ReturnType<typeof useUniverse>["planets"][number];
  to: ReturnType<typeof useUniverse>["planets"][number];
  sendTower: number;
  recvTower: number;
  selectedId: string | null;
  hoveredId: string | null;
  rotationSpeed: number;
}) {
  const [points, setPoints] = useState<[number, number, number][]>([
    [0, 0, 0],
    [1, 1, 1],
  ]);

  useFrame((state) => {
    const fromSpin = planetSpinY(
      state.clock.elapsedTime,
      rotationSpeed,
      selectedId === from.node.id || hoveredId === from.node.id,
    );
    const toSpin = planetSpinY(
      state.clock.elapsedTime,
      rotationSpeed,
      selectedId === to.node.id || hoveredId === to.node.id,
    );
    const start = towerTipWorld(from, sendTower, fromSpin);
    const end = towerTipWorld(to, recvTower, toSpin);
    setPoints([start.toArray(), end.toArray()]);
  });

  return (
    <Line
      points={points}
      color="#f0abfc"
      lineWidth={2.5}
      transparent
      opacity={0.9}
    />
  );
}
