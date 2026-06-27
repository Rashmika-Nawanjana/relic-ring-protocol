"use client";

import { useMemo, useRef } from "react";
import { Html, Line, Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Group, Mesh } from "three";
import {
  createBumpTexture,
  createPlanetTexture,
} from "@/lib/solar-system/textures";
import { planetOrbitRadius } from "@/lib/universe/geometry";
import type { ScenePlanet } from "@/lib/universe/types";
import { useUniverse } from "@/context/UniverseContext";
import { PlanetDetailCard } from "@/components/solar-system/PlanetDetailCard";

/** Keep 3D Html labels below the scene UI overlay (SimulatorApp uses z-[100]). */
const TOWER_LABEL_Z: [number, number] = [30, 0];

type ZetaPlanetProps = {
  planet: ScenePlanet;
  rotationSpeed: number;
  showOrbits: boolean;
  showTowers: boolean;
};

export function ZetaPlanet({
  planet,
  rotationSpeed,
  showOrbits,
  showTowers,
}: ZetaPlanetProps) {
  const spinRef = useRef<Group>(null);
  const meshRef = useRef<Mesh>(null);
  const atmoRef = useRef<Mesh>(null);
  const { node, position, visualRadius, atmosphereRadius, color, towers } =
    planet;
  const {
    killed,
    selectedId,
    hoveredId,
    route,
    routeResult,
    setSelectedId,
    setHoveredId,
  } = useUniverse();

  const isKilled = killed.has(node.id);
  const isSelected = selectedId === node.id;
  const isHovered = hoveredId === node.id;
  const isFocused = isHovered || isSelected;
  const routeIndex = route.indexOf(node.id);
  const onRoute = routeIndex >= 0;
  const orbitRadius = planetOrbitRadius(node);

  const towerLabels = useMemo(
    () => towers.map((t) => t.label),
    [towers],
  );

  const activeTowerIndices = useMemo(() => {
    if (!routeResult?.ok) return new Set<number>();
    const tr = routeResult.tower_routes.find((r) => r.planetId === node.id);
    return new Set(tr?.viaTowers ?? []);
  }, [routeResult, node.id]);

  const { map, bumpMap } = useMemo(() => {
    const seed = node.codex * 17 + node.radius_km;
    return {
      map: createPlanetTexture(color, seed),
      bumpMap: createBumpTexture(seed),
    };
  }, [color, node.codex, node.radius_km]);

  const orbitPoints = useMemo(() => {
    const curve = new THREE.EllipseCurve(
      0,
      0,
      orbitRadius,
      orbitRadius,
      0,
      Math.PI * 2,
      false,
      0,
    );
    return curve.getPoints(128).map((p) => [p.x, 0, p.y] as [number, number, number]);
  }, [orbitRadius]);

  useFrame(({ clock }) => {
    if (!spinRef.current || isKilled) return;
    const speed = isFocused ? 0.015 : 0.05;
    spinRef.current.rotation.y = clock.elapsedTime * speed * rotationSpeed;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedId(isSelected ? null : node.id);
  };

  const outlined = (isFocused || onRoute) && !isKilled;
  const towerScale = visualRadius * 0.16;
  const showTowerDetail = showTowers && (isFocused || onRoute);

  return (
    <group position={position}>
      {showOrbits && (
        <Line
          points={orbitPoints}
          color="#ffffff"
          transparent
          opacity={0.07}
          lineWidth={1}
        />
      )}

      <group ref={spinRef} scale={isFocused ? 1.03 : 1}>
        {/* Atmosphere shell */}
        <mesh ref={atmoRef}>
          <sphereGeometry args={[atmosphereRadius, 64, 64]} />
          <meshPhongMaterial
            color={color}
            transparent
            opacity={isKilled ? 0.05 : isFocused ? 0.38 : 0.22}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Planet body */}
        <mesh
          ref={meshRef}
          castShadow
          receiveShadow
          onClick={handleClick}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHoveredId(node.id);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHoveredId(null);
            document.body.style.cursor = "auto";
          }}
        >
          <sphereGeometry args={[visualRadius, 72, 72]} />
          <meshStandardMaterial
            map={map}
            bumpMap={bumpMap}
            bumpScale={0.45}
            color={isKilled ? "#374151" : "#ffffff"}
            emissive={onRoute ? color : isFocused ? color : "#000000"}
            emissiveIntensity={
              onRoute ? 0.45 : isSelected ? 0.22 : isHovered ? 0.12 : 0
            }
            metalness={0.08}
            roughness={0.72}
            transparent={isKilled}
            opacity={isKilled ? 0.4 : 1}
          />
          {outlined && (
            <Outlines
              thickness={isSelected ? 0.06 : 0.04}
              color={isSelected ? "#ffffff" : color}
              angle={0}
            />
          )}
        </mesh>

        {/* Subsurface fiber equator — brighter when focused */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[visualRadius * 1.012, visualRadius * 0.028, 12, 128]} />
          <meshStandardMaterial
            color={isFocused ? "#a5b4fc" : "#64748b"}
            emissive={isFocused ? "#6366f1" : "#334155"}
            emissiveIntensity={isFocused ? 1.2 : 0.35}
            metalness={0.6}
            roughness={0.25}
            transparent
            opacity={isKilled ? 0.2 : 0.85}
          />
        </mesh>

        {/* Relay towers on equator — always visible, enhanced when focused */}
        {showTowers &&
          towers.map((tower) => {
            const onPacketPath = activeTowerIndices.has(tower.index);
            return (
            <group key={tower.label} position={tower.local}>
              {/* Base pad on surface */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry
                  args={[towerScale * 0.55, towerScale * 0.7, towerScale * 0.15, 8]}
                />
                <meshStandardMaterial
                  color="#475569"
                  metalness={0.5}
                  roughness={0.4}
                />
              </mesh>

              {/* Crystal relay core */}
              <mesh
                position={[0, towerScale * 0.55, 0]}
                rotation={[Math.PI / 4, 0, Math.PI / 4]}
                castShadow
              >
                <octahedronGeometry args={[towerScale * 0.45, 0]} />
                <meshStandardMaterial
                  color={isKilled ? "#6b7280" : onPacketPath ? "#ffffff" : "#e0e7ff"}
                  emissive={isKilled ? "#000" : color}
                  emissiveIntensity={
                    onPacketPath ? 2.2 : showTowerDetail ? 1.4 : 0.75
                  }
                  metalness={0.55}
                  roughness={0.15}
                />
              </mesh>

              {/* Antenna mast */}
              <mesh position={[0, towerScale * 0.95, 0]}>
                <cylinderGeometry
                  args={[towerScale * 0.06, towerScale * 0.04, towerScale * 0.7, 6]}
                />
                <meshStandardMaterial
                  color="#cbd5e1"
                  emissive="#818cf8"
                  emissiveIntensity={
                    onPacketPath ? 1.8 : showTowerDetail ? 1 : 0.45
                  }
                  metalness={0.7}
                  roughness={0.2}
                />
              </mesh>

              {/* Beacon tip */}
              <mesh position={[0, towerScale * 1.35, 0]}>
                <sphereGeometry args={[towerScale * 0.12, 12, 12]} />
                <meshStandardMaterial
                  color="#ffffff"
                  emissive={onPacketPath ? "#ffffff" : color}
                  emissiveIntensity={onPacketPath ? 3 : showTowerDetail ? 2 : 0.9}
                  toneMapped={false}
                />
              </mesh>

              {(showTowerDetail || onPacketPath) && (
                <>
                  <pointLight
                    color={color}
                    intensity={0.35}
                    distance={visualRadius * 3}
                    decay={2}
                    position={[0, towerScale * 1.2, 0]}
                  />
                  <Html
                    center
                    distanceFactor={isSelected ? 8 : 11}
                    position={[0, towerScale * 1.65, 0]}
                    zIndexRange={TOWER_LABEL_Z}
                    style={{ pointerEvents: "none" }}
                  >
                    <span
                      className="rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold shadow-lg"
                      style={{
                        borderColor: `${color}88`,
                        background: "rgba(0,0,0,0.85)",
                        color: "#e0e7ff",
                      }}
                    >
                      {tower.label}
                    </span>
                  </Html>
                </>
              )}
            </group>
            );
          })}
      </group>

      {isFocused && (
        <Html
          center
          distanceFactor={isSelected ? 6.5 : 9}
          position={[0, visualRadius + atmosphereRadius * 0.35 + 0.4, 0]}
          style={{ pointerEvents: "none" }}
          zIndexRange={TOWER_LABEL_Z}
        >
          <PlanetDetailCard
            node={node}
            color={color}
            expanded={isSelected}
            onRoute={onRoute}
            routeIndex={routeIndex}
            isKilled={isKilled}
            towerLabels={towerLabels}
          />
        </Html>
      )}

      {onRoute && !isFocused && (
        <Html
          center
          distanceFactor={12}
          position={[0, visualRadius + 0.35, 0]}
          zIndexRange={TOWER_LABEL_Z}
          style={{ pointerEvents: "none" }}
        >
          <span className="rounded-full bg-indigo-600/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg">
            Hop {routeIndex + 1}
          </span>
        </Html>
      )}
    </group>
  );
}
