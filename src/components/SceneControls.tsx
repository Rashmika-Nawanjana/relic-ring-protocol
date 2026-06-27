"use client";

import { useUniverse } from "@/context/UniverseContext";

export function SceneControls() {
  const { sceneSettings, setSceneSettings, resetView } = useUniverse();

  return (
    <div
      className="pointer-events-auto absolute left-3 top-3 z-[100] w-44 rounded-lg border border-white/8 bg-[var(--panel-bg)] p-3 text-xs backdrop-blur-md"
      aria-label="Scene controls"
    >
      <p className="mb-2.5 text-[11px] font-medium text-zinc-400">View</p>

      <button
        type="button"
        onClick={resetView}
        className="mb-3 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-zinc-300 transition hover:bg-white/10"
      >
        Reset camera
      </button>

      <label className="mb-2.5 block">
        <span className="mb-1 block text-zinc-600">Sun glow</span>
        <input
          type="range"
          min={0.5}
          max={4}
          step={0.1}
          value={sceneSettings.sunIntensity}
          onChange={(e) =>
            setSceneSettings({ sunIntensity: Number(e.target.value) })
          }
          className="w-full accent-[var(--accent)]"
        />
      </label>

      <label className="mb-2.5 block">
        <span className="mb-1 block text-zinc-600">Spin</span>
        <input
          type="range"
          min={0}
          max={3}
          step={0.1}
          value={sceneSettings.rotationSpeed}
          onChange={(e) =>
            setSceneSettings({ rotationSpeed: Number(e.target.value) })
          }
          className="w-full accent-zinc-500"
        />
      </label>

      <div className="space-y-1.5 text-zinc-500">
        {(
          [
            ["showOrbits", "Orbits"],
            ["showTowers", "Towers"],
            ["showTowerPaths", "Tower paths"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={sceneSettings[key]}
              onChange={(e) => setSceneSettings({ [key]: e.target.checked })}
              className="rounded border-white/20 accent-[var(--accent)]"
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
