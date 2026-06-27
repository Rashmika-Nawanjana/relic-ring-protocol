"use client";

import { useMemo, useRef } from "react";
import { Html, Line, Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Mesh } from "three";
import {
  createBumpTexture,
  createPlanetTexture,
} from "@/lib/solar-system/textures";
import { planetOrbitRadius } from "@/lib/universe/geometry";
import type { ScenePlanet } from "@/lib/universe/types";
import { useUniverse } from "@/context/UniverseContext";

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
  const meshRef = useRef<Mesh>(null);
  const atmoRef = useRef<Mesh>(null);
  const { node, position, visualRadius, atmosphereRadius, color, towers } =
    planet;
  const {
    killed,
    selectedId,
    hoveredId,
    route,
    setSelectedId,
    setHoveredId,
  } = useUniverse();

  const isKilled = killed.has(node.id);
  const isSelected = selectedId === node.id;
  const isHovered = hoveredId === node.id;
  const routeIndex = route.indexOf(node.id);
  const onRoute = routeIndex >= 0;
  const orbitRadius = planetOrbitRadius(node);

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
    if (meshRef.current && !isKilled) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.05 * rotationSpeed;
    }
    if (atmoRef.current && !isKilled) {
      atmoRef.current.rotation.y = clock.elapsedTime * 0.02 * rotationSpeed;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedId(isSelected ? null : node.id);
  };

  const outlined = (isHovered || isSelected || onRoute) && !isKilled;

  return (
    <group position={position}>
      {showOrbits && (
        <Line
          points={orbitPoints}
          color="#ffffff"
          transparent
          opacity={0.06}
          lineWidth={1}
        />
      )}

      {/* Atmosphere — Solar-System-3D style */}
      <mesh ref={atmoRef} scale={outlined ? 1.04 : 1}>
        <sphereGeometry args={[atmosphereRadius, 48, 48]} />
        <meshPhongMaterial
          color={color}
          transparent
          opacity={isKilled ? 0.04 : 0.28}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

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
        <sphereGeometry args={[visualRadius, 64, 64]} />
        <meshPhongMaterial
          map={map}
          bumpMap={bumpMap}
          bumpScale={0.35}
          color={isKilled ? "#374151" : "#ffffff"}
          emissive={onRoute ? color : "#000000"}
          emissiveIntensity={onRoute ? 0.35 : isHovered ? 0.12 : 0}
          transparent={isKilled}
          opacity={isKilled ? 0.35 : 1}
        />
        {outlined && <Outlines thickness={0.04} color="#ffffff" angle={0} />}
      </mesh>

      {/* Fiber equator ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[visualRadius * 1.015, 0.012, 8, 96]} />
        <meshBasicMaterial color="#64748b" transparent opacity={0.45} />
      </mesh>

      {/* Towers T_0… clockwise from 12 o'clock */}
      {showTowers &&
        towers.map((tower) => (
          <group key={tower.label} position={tower.local}>
            <mesh rotation={[Math.PI / 4, 0, Math.PI / 4]} castShadow>
              <octahedronGeometry args={[visualRadius * 0.11, 0]} />
              <meshStandardMaterial
                color={isKilled ? "#6b7280" : "#ffffff"}
                emissive={isKilled ? "#000" : "#e0e7ff"}
                emissiveIntensity={0.6}
                metalness={0.4}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0, visualRadius * 0.14, 0]}>
              <cylinderGeometry args={[0.008, 0.008, visualRadius * 0.2, 6]} />
              <meshStandardMaterial
                color="#94a3b8"
                emissive="#6366f1"
                emissiveIntensity={0.5}
              />
            </mesh>
            {(isHovered || isSelected || showTowers) && (
              <Html
                center
                distanceFactor={14}
                position={[0, visualRadius * 0.28, 0]}
                style={{ pointerEvents: "none" }}
              >
                <span className="rounded bg-black/70 px-1 py-0.5 font-mono text-[9px] text-white">
                  {tower.label}
                </span>
              </Html>
            )}
          </group>
        ))}

      {(isHovered || isSelected || onRoute) && (
        <Html
          center
          distanceFactor={10}
          position={[0, visualRadius + 0.55, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="rounded-lg border border-white/20 bg-black/80 px-3 py-2 text-xs whitespace-nowrap text-white shadow-xl backdrop-blur">
            <div className="font-bold text-sm">{node.id}</div>
            <div className="text-zinc-400">Codex Base {node.codex}</div>
            <div className="text-zinc-500">
              {node.active_towers} towers · R {node.radius_km.toLocaleString()} km
            </div>
            {onRoute && (
              <div className="text-indigo-400">Route hop {routeIndex + 1}</div>
            )}
            {isKilled && <div className="text-red-400">OFFLINE</div>}
          </div>
        </Html>
      )}
    </group>
  );
}
