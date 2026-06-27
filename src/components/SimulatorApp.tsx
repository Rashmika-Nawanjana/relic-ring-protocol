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
import { PacketLiveFeed } from "@/components/PacketLiveFeed";
import { UniverseInitBanner } from "@/components/UniverseInitBanner";

const DynamicCanvas = dynamic(
  () => Promise.resolve({ default: CanvasWrapper }),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-full w-full items-center justify-center bg-[#050508]"
        aria-busy="true"
        aria-label="Loading 3D universe"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-[var(--accent)]" />
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
      <div className="relative flex h-[100dvh] w-full flex-col bg-[#050508] text-zinc-100 lg:flex-row">
        <div className="relative min-h-[58vh] flex-1 lg:min-h-full">
          <DynamicCanvas />
          <SceneControls />
          <UniverseInitBanner />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[90] bg-gradient-to-b from-black/55 to-transparent px-4 pb-8 pt-3 pl-48 lg:pl-52">
            <p className="text-[11px] text-zinc-500">
              Hover planets · left-drag pan · right-drag orbit · scroll zoom
            </p>
          </div>
          <PacketLiveFeed />
        </div>

        <aside className="flex max-h-[42vh] w-full flex-col overflow-y-auto border-t border-white/6 bg-[var(--panel-bg)] backdrop-blur-xl lg:max-h-full lg:w-[22rem] lg:border-t-0 lg:border-l">
          <header className="hidden border-b border-white/6 px-5 py-4 lg:block">
            <h1 className="text-lg font-medium tracking-tight text-zinc-100">
              Relic Ring
            </h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              Zeta-26 routing simulator
            </p>
          </header>
          <ControlPanel />
          <PacketTrace />
          <LatencyBreakdown />
        </aside>
      </div>
    </UniverseProvider>
  );
}
