"use client";

import { Canvas } from "@react-three/fiber";
import { Preload } from "@react-three/drei";
import * as THREE from "three";
import { r3f } from "@/helpers/global";

export default function Scene(props: React.ComponentProps<typeof Canvas>) {
  return (
    <Canvas
      {...props}
      onCreated={(state) => {
        state.gl.toneMapping = THREE.ACESFilmicToneMapping;
      }}
    >
      <r3f.Out />
      <Preload all />
    </Canvas>
  );
}
