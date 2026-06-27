"use client";

import dynamic from "next/dynamic";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { UniverseProvider } from "@/context/UniverseContext";
import { SolarSystemScene } from "@/components/solar-system/SolarSystemScene";
import { ControlPanel } from "@/components/ControlPanel";
import { PacketTrace } from "@/components/PacketTrace";
import { LatencyBreakdown } from "@/components/LatencyBreakdown";
import { SceneControls } from "@/components/SceneControls";

const DynamicCanvas = dynamic(
  () => Promise.resolve({ default: CanvasWrapper }),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full w-full items-center justify-center bg-zinc-950"
        aria-busy="true"
        aria-label="Loading 3D universe"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-400" />
      </div>
    ),
  },
);

function CanvasWrapper() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [-32, 20, 26], fov: 42, near: 0.1, far: 400 }}
      gl={{
        antialias: true,
        alpha: false,
        toneMapping: THREE.ACESFilmicToneMapping,
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <SolarSystemScene />
    </Canvas>
  );
}

export function SimulatorApp() {
  return (
    <UniverseProvider>
      <div className="relative flex h-[100dvh] w-full flex-col bg-zinc-950 text-zinc-50 lg:flex-row">
        {/* Full-screen 3D */}
        <div className="relative min-h-[55vh] flex-1 lg:min-h-full">
          <DynamicCanvas />
          <SceneControls />
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
            <h1 className="text-lg font-semibold tracking-tight">
              Relic Ring Protocol
            </h1>
            <p className="text-xs text-zinc-400">
              Hover planets for specs · click to inspect towers · scroll to zoom
            </p>
          </div>
        </div>

        {/* Side panel — narrower so the 3D view dominates */}
        <div className="flex max-h-[45vh] flex-col gap-3 overflow-y-auto border-t border-zinc-800/80 bg-zinc-950/90 p-3 backdrop-blur-sm lg:max-h-full lg:w-80 lg:border-t-0 lg:border-l">
          <ControlPanel />
          <PacketTrace />
          <LatencyBreakdown />
        </div>
      </div>
    </UniverseProvider>
  );
}
