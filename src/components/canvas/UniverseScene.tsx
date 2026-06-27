"use client";

import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";
import { StarBackground } from "@/components/canvas/StarBackground";
import { CentralStar } from "@/components/canvas/CentralStar";
import { PlanetMesh } from "@/components/canvas/PlanetMesh";
import { VoidLinks } from "@/components/canvas/VoidLinks";
import { useUniverse } from "@/context/UniverseContext";

export function UniverseScene() {
  const { planets } = useUniverse();

  return (
    <Suspense fallback={null}>
      <color attach="background" args={["#030712"]} />
      <fog attach="fog" args={["#030712", 18, 55]} />
      <ambientLight intensity={0.25} />
      <StarBackground />
      <CentralStar />

      {planets.map((planet) => (
        <PlanetMesh key={planet.node.id} planet={planet} />
      ))}

      <VoidLinks />

      <OrbitControls
        enablePan
        enableZoom
        minDistance={4}
        maxDistance={35}
        maxPolarAngle={Math.PI / 2.1}
        target={[5, 0, -2]}
      />
    </Suspense>
  );
}
