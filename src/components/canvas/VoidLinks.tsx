"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { voidEdgeKey } from "@/lib/universe/router";

export function VoidLinks() {
  const {
    planets,
    edges,
    route,
    killed,
    killedLinks,
    config,
    selectedId,
    hoveredId,
    sceneSettings,
    linkHealthMap,
  } = useUniverse();

  const planetMap = useMemo(
    () => new Map(planets.map((p) => [p.node.id, p])),
    [planets],
  );

  const routeSegments = useMemo(() => {
    const segs = new Set<string>();
    for (let i = 0; i < route.length - 1; i++) {
      segs.add(voidEdgeKey(route[i], route[i + 1]));
    }
    return segs;
  }, [route]);

  const lineData = useMemo(() => {
    return edges
      .map((edge) => {
        const a = planetMap.get(edge.from);
        const b = planetMap.get(edge.to);
        if (!a || !b) return null;

        const key = edge.key;
        const start = new THREE.Vector3(...a.position);
        const end = new THREE.Vector3(...b.position);
        const dir = end.clone().sub(start).normalize();
        start.add(dir.clone().multiplyScalar(a.atmosphereRadius));
        end.sub(dir.clone().multiplyScalar(b.atmosphereRadius));

        return {
          key,
          points: [start.toArray(), end.toArray()] as [number, number, number][],
          isActive: routeSegments.has(key),
          isSevered: killedLinks.has(key),
          isValid: edge.valid,
          invalid: edge.voidDistanceKm > 0 && !edge.valid && !killedLinks.has(key),
          health: linkHealthMap.get(key) ?? "ok",
        };
      })
      .filter(Boolean) as {
      key: string;
      points: [number, number, number][];
      isActive: boolean;
      isSevered: boolean;
      isValid: boolean;
      invalid: boolean;
      health: "ok" | "congested" | "danger";
    }[];
  }, [edges, planetMap, routeSegments, killedLinks, linkHealthMap]);

  function linkColor(line: {
    isActive: boolean;
    isSevered: boolean;
    isValid: boolean;
    invalid: boolean;
    health: "ok" | "congested" | "danger";
  }): string {
    if (line.isActive) return "#818cf8";
    if (line.isSevered) return "#3f3f46";
    if (!line.isValid || line.invalid) return "#7f1d1d";
    switch (line.health) {
      case "danger":
        return "#ef4444";
      case "congested":
        return "#f59e0b";
      default:
        return "#22c55e";
    }
  }

  function linkOpacity(line: {
    isActive: boolean;
    isSevered: boolean;
    isValid: boolean;
    health: "ok" | "congested" | "danger";
  }): number {
    if (line.isSevered) return 0.08;
    if (line.isActive) return 0.35;
    if (!line.isValid) return 0.15;
    if (line.health === "danger") return 0.55;
    if (line.health === "congested") return 0.45;
    return 0.35;
  }

  const hasRoute = route.length >= 2;
  const showPaths = sceneSettings.showTowerPaths;

  return (
    <group>
      {showPaths &&
        lineData.map((line) => (
          <Line
            key={line.key}
            points={line.points}
            color={linkColor(line)}
            lineWidth={line.isActive ? 2 : 1}
            transparent
            opacity={linkOpacity(line)}
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
  const { packetResumeProgress, packetTransmitKey } = useUniverse();

  // Resume mid-path after a chaos reroute instead of restarting from origin
  useEffect(() => {
    progress.current = packetResumeProgress;
  }, [route, packetResumeProgress, packetTransmitKey]);

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
          const key = voidEdgeKey(route[i], route[i + 1]);
          return (
            <VoidHopLine
              key={`hop-${i}-${key}`}
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
