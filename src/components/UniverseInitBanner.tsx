"use client";

import { useEffect, useState } from "react";
import { useUniverse } from "@/context/UniverseContext";

export function UniverseInitBanner() {
  const { config } = useUniverse();
  const meta = config.universe_metadata;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-14 z-[95] w-[min(92%,28rem)] -translate-x-1/2 rounded-lg border border-white/8 bg-[rgba(8,8,10,0.92)] px-4 py-3 text-center shadow-lg backdrop-blur-md transition-opacity duration-700"
      role="status"
      aria-live="polite"
    >
      <p className="text-xs font-medium text-zinc-200">
        Universe initialized — {meta.system_name}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
        Loaded{" "}
        <span className="font-mono text-zinc-400">universe-config.json</span> ·{" "}
        {config.nodes.length} nodes · c ={" "}
        {(meta.speed_of_light_kms / 1000).toFixed(0)}k km/s · Lmax ={" "}
        {(meta.max_void_hop_distance_km / 1e6).toFixed(0)}M km
      </p>
    </div>
  );
}
