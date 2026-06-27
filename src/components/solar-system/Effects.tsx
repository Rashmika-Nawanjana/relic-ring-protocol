"use client";

import { Bloom, EffectComposer } from "@react-three/postprocessing";

/** Bloom pass — ported from Solar-System-3D UnrealBloomPass settings. */
export function SolarSystemEffects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom
        luminanceThreshold={0.9}
        luminanceSmoothing={0.4}
        intensity={1.4}
        radius={0.85}
      />
    </EffectComposer>
  );
}
