"use client";

import { useUniverse } from "@/context/UniverseContext";

/** dat.GUI-style controls — ported from Solar-System-3D. */
export function SceneControls() {
  const { sceneSettings, setSceneSettings, resetView } = useUniverse();

  return (
    <div
      className="pointer-events-auto absolute right-3 top-3 z-[100] w-52 rounded-lg border border-zinc-700/80 bg-black/75 p-3 text-xs backdrop-blur-md"
      aria-label="Scene controls"
    >
      <p className="mb-2 font-semibold text-zinc-300">Scene Controls</p>

      <button
        type="button"
        onClick={resetView}
        className="mb-3 w-full min-h-10 rounded-lg border border-zinc-600 bg-zinc-800/80 px-3 py-2 text-zinc-200 transition hover:border-indigo-500 hover:bg-zinc-700"
      >
        Reset view
      </button>

      <label className="mb-2 flex flex-col gap-1 text-zinc-400">
        Sun intensity
        <input
          type="range"
          min={0.5}
          max={4}
          step={0.1}
          value={sceneSettings.sunIntensity}
          onChange={(e) =>
            setSceneSettings({ sunIntensity: Number(e.target.value) })
          }
          className="w-full accent-amber-400"
        />
        <span className="text-right font-mono text-zinc-500">
          {sceneSettings.sunIntensity.toFixed(1)}
        </span>
      </label>

      <label className="mb-2 flex flex-col gap-1 text-zinc-400">
        Rotation speed
        <input
          type="range"
          min={0}
          max={3}
          step={0.1}
          value={sceneSettings.rotationSpeed}
          onChange={(e) =>
            setSceneSettings({ rotationSpeed: Number(e.target.value) })
          }
          className="w-full accent-indigo-400"
        />
      </label>

      <label className="mb-1 flex items-center gap-2 text-zinc-400">
        <input
          type="checkbox"
          checked={sceneSettings.showOrbits}
          onChange={(e) => setSceneSettings({ showOrbits: e.target.checked })}
          className="rounded"
        />
        Orbit paths
      </label>

      <label className="mb-1 flex items-center gap-2 text-zinc-400">
        <input
          type="checkbox"
          checked={sceneSettings.showTowers}
          onChange={(e) => setSceneSettings({ showTowers: e.target.checked })}
          className="rounded"
        />
        Tower markers
      </label>

      <label className="flex items-center gap-2 text-zinc-400">
        <input
          type="checkbox"
          checked={sceneSettings.showTowerPaths}
          onChange={(e) =>
            setSceneSettings({ showTowerPaths: e.target.checked })
          }
          className="rounded"
        />
        Tower paths
      </label>
    </div>
  );
}
