"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function CentralStar() {
  const glowRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.5) * 0.06;
    if (glowRef.current) glowRef.current.scale.setScalar(pulse * 1.8);
    if (coreRef.current) coreRef.current.scale.setScalar(pulse);
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial color="#fff7cc" />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial
          color="#ffaa33"
          transparent
          opacity={0.25}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight intensity={4} distance={30} color="#ffd699" decay={2} />
    </group>
  );
}
