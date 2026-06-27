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
    <div className="flex items-center gap-3 text-xs">
      <span className="w-12 shrink-0 text-zinc-500">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-14 text-right font-mono text-zinc-500">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

export function LatencyBreakdown() {
  const { routeResult } = useUniverse();

  if (!routeResult?.ok) {
    return (
      <section className="panel-section" aria-label="Latency breakdown">
        <h2 className="text-base font-medium text-zinc-100">Latency</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Fiber, tower, atmosphere, and void time per route.
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
    <section className="panel-section" aria-label="Latency breakdown">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-medium text-zinc-100">Latency</h2>
        <span className="font-mono text-sm text-[var(--accent)]">
          {routeResult.total_latency_ms.toFixed(1)} ms
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-2.5">
        <Bar label="Fiber" value={totals.fiber} max={max} color="#6ee7b7" />
        <Bar label="Tower" value={totals.towers} max={max} color="#fcd34d" />
        <Bar label="Atmo" value={totals.atmosphere} max={max} color="#7dd3fc" />
        <Bar label="Void" value={totals.void} max={max} color="#a5b4fc" />
      </div>
    </section>
  );
}
