"use client";

import { Suspense, useMemo } from "react";
import { useUniverse } from "@/context/UniverseContext";
import { Sun } from "@/components/solar-system/Sun";
import { StarField, AsteroidBelt } from "@/components/solar-system/StarField";
import { ZetaPlanet } from "@/components/solar-system/ZetaPlanet";
import { VoidLinks } from "@/components/canvas/VoidLinks";
import { SolarSystemEffects } from "@/components/solar-system/Effects";
import { CameraRig } from "@/components/solar-system/CameraRig";
import { planetOrbitRadius } from "@/lib/universe/geometry";

/**
 * 3D scene ported from N3rson/Solar-System-3D (Karol Fryc) —
 * bloom, outlines, orbit rings, asteroid belt — using Zeta-26 config planets.
 */
export function SolarSystemScene() {
  const { planets, sceneSettings } = useUniverse();

  const belt = useMemo(() => {
    const radii = planets.map((p) => planetOrbitRadius(p.node));
    const min = Math.min(...radii);
    const max = Math.max(...radii);
    return {
      inner: min * 1.05,
      outer: max * 1.15,
    };
  }, [planets]);

  return (
    <Suspense fallback={null}>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000005", 35, 120]} />

      <ambientLight intensity={0.35} color="#222222" />
      <StarField />
      <Sun intensity={sceneSettings.sunIntensity} />

      {planets.map((planet) => (
        <ZetaPlanet
          key={planet.node.id}
          planet={planet}
          rotationSpeed={sceneSettings.rotationSpeed}
          showOrbits={sceneSettings.showOrbits}
          showTowers={sceneSettings.showTowers}
        />
      ))}

      <AsteroidBelt count={800} innerRadius={belt.inner} outerRadius={belt.outer} />

      <VoidLinks />
      <CameraRig />
      <SolarSystemEffects />
    </Suspense>
  );
}
