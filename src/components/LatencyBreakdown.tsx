"use client";

import { useUniverse } from "@/context/UniverseContext";

function Bar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 shrink-0 text-zinc-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-16 text-right font-mono text-zinc-400">
        {value.toFixed(2)} ms
      </span>
    </div>
  );
}

export function LatencyBreakdown() {
  const { routeResult } = useUniverse();

  if (!routeResult?.ok) {
    return (
      <section
        className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 backdrop-blur-md"
        aria-label="Latency breakdown"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
          Latency Breakdown
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Per-component fiber / tower / atmosphere / void (M3).
        </p>
      </section>
    );
  }

  const totals = routeResult.per_hop_latency.reduce(
    (acc, h) => ({
      fiber: acc.fiber + h.fiber_ms,
      towers: acc.towers + h.towers_ms,
      atmosphere: acc.atmosphere + h.atmosphere_ms,
      void: acc.void + h.void_ms,
    }),
    { fiber: 0, towers: 0, atmosphere: 0, void: 0 },
  );

  const max =
    Math.max(totals.fiber, totals.towers, totals.atmosphere, totals.void, 1) *
    1.1;

  return (
    <section
      className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 backdrop-blur-md"
      aria-label="Latency breakdown"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
        Latency Breakdown · M3
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Total route: {routeResult.total_latency_ms.toFixed(2)} ms
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Bar label="Fiber" value={totals.fiber} max={max} color="#34d399" />
        <Bar label="Towers" value={totals.towers} max={max} color="#fbbf24" />
        <Bar
          label="Atmo"
          value={totals.atmosphere}
          max={max}
          color="#38bdf8"
        />
        <Bar label="Void" value={totals.void} max={max} color="#818cf8" />
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
        L = center distance × scale − (R₁+h₁) − (R₂+h₂) · Tv = ((h₁n₁)+(h₂n₂)+L)/C
      </p>
    </section>
  );
}
