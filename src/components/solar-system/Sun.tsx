"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createSunTexture } from "@/lib/solar-system/textures";

type SunProps = {
  intensity: number;
};

export function Sun({ intensity }: SunProps) {
  const coreRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const sunTexture = useMemo(() => createSunTexture(), []);

  useFrame(({ clock }) => {
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.2) * 0.04;
    coreRef.current?.scale.setScalar(pulse);
    glowRef.current?.scale.setScalar(pulse * 2.2);
  });

  const sunSize = 697 / 40 / 8; // scaled for Zeta-26 scene

  return (
    <group>
      <mesh ref={coreRef}>
        <sphereGeometry args={[sunSize, 64, 64]} />
        <meshStandardMaterial
          emissive="#fff88f"
          emissiveMap={sunTexture}
          emissiveIntensity={intensity}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[sunSize, 32, 32]} />
        <meshBasicMaterial
          color="#ffaa33"
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        color="#fdffd3"
        intensity={120 * intensity}
        distance={400}
        decay={1.4}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
    </group>
  );
}
