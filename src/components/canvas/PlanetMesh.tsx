"use client";

import { useRef } from "react";
import { Html, Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Mesh } from "three";
import type { ScenePlanet } from "@/lib/universe/types";
import { useUniverse } from "@/context/UniverseContext";

type PlanetMeshProps = {
  planet: ScenePlanet;
};

export function PlanetMesh({ planet }: PlanetMeshProps) {
  const meshRef = useRef<Mesh>(null);
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

  useFrame(({ clock }) => {
    if (meshRef.current && !isKilled) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.08;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedId(isSelected ? null : node.id);
  };

  return (
    <group position={position}>
      {/* Atmosphere shell */}
      <mesh scale={isHovered || isSelected ? 1.05 : 1}>
        <sphereGeometry args={[atmosphereRadius, 32, 32]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isKilled ? 0.05 : 0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Planet body */}
      <mesh
        ref={meshRef}
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
        <sphereGeometry args={[visualRadius, 48, 48]} />
        <meshStandardMaterial
          color={isKilled ? "#374151" : color}
          emissive={onRoute ? color : "#000000"}
          emissiveIntensity={onRoute ? 0.45 : isHovered ? 0.2 : 0.05}
          roughness={0.65}
          metalness={0.15}
          transparent={isKilled}
          opacity={isKilled ? 0.35 : 1}
        />
        {(isHovered || isSelected || onRoute) && !isKilled && (
          <Outlines thickness={0.025} color="#ffffff" angle={0} />
        )}
      </mesh>

      {/* Equator ring (fiber) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[visualRadius * 1.01, 0.008, 8, 64]} />
        <meshBasicMaterial
          color={isKilled ? "#4b5563" : "#94a3b8"}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Towers — clockwise from 12 o'clock per image1 */}
      {towers.map((tower) => (
        <group key={tower.label} position={tower.local}>
          <mesh rotation={[Math.PI / 4, 0, Math.PI / 4]}>
            <octahedronGeometry args={[visualRadius * 0.06, 0]} />
            <meshStandardMaterial
              color={isKilled ? "#6b7280" : "#f8fafc"}
              emissive={isKilled ? "#000" : "#e2e8f0"}
              emissiveIntensity={0.3}
            />
          </mesh>
        </group>
      ))}

      {/* Label */}
      {(isHovered || isSelected || onRoute) && (
        <Html
          center
          distanceFactor={12}
          position={[0, visualRadius + 0.35, 0]}
          style={{ pointerEvents: "none" }}
        >
          <div className="rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-1 text-xs whitespace-nowrap text-zinc-100 shadow-lg">
            <span className="font-semibold">{node.id}</span>
            <span className="ml-1.5 text-zinc-400">Base {node.codex}</span>
            {onRoute && (
              <span className="ml-1.5 text-indigo-400">Hop {routeIndex + 1}</span>
            )}
            {isKilled && (
              <span className="ml-1.5 text-red-400">OFFLINE</span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
