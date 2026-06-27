"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function StarField() {
  const ref = useRef<THREE.Points>(null);

  const positions = useMemo(() => {
    const count = 6000;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 80 + Math.random() * 120;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime * 0.0003;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={6000} />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        color="#ffffff"
        transparent
        opacity={0.9}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

export function AsteroidBelt({
  count,
  innerRadius,
  outerRadius,
}: {
  count: number;
  innerRadius: number;
  outerRadius: number;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const asteroids = useMemo(() => {
    const items: THREE.Object3D[] = [];
    const geo = new THREE.DodecahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: "#9ca3af",
      roughness: 0.9,
      metalness: 0.1,
    });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      const orbitRadius = THREE.MathUtils.randFloat(innerRadius, outerRadius);
      const angle = Math.random() * Math.PI * 2;
      mesh.position.set(
        orbitRadius * Math.cos(angle),
        THREE.MathUtils.randFloatSpread(0.35),
        orbitRadius * Math.sin(angle),
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      );
      mesh.scale.setScalar(THREE.MathUtils.randFloat(0.025, 0.07));
      items.push(mesh);
    }
    return items;
  }, [count, innerRadius, outerRadius]);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = clock.elapsedTime * 0.008;
    }
  });

  return (
    <group ref={groupRef}>
      {asteroids.map((a, i) => (
        <primitive key={i} object={a} />
      ))}
    </group>
  );
}
