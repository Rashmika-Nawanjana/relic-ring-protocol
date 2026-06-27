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
        <Bar label="Fiber" value={totals.fiber} max={max} color="#a8a29e" />
        <Bar label="Tower" value={totals.towers} max={max} color="#d4a574" />
        <Bar label="Atmo" value={totals.atmosphere} max={max} color="#94a3b8" />
        <Bar label="Void" value={totals.void} max={max} color="#cbd5e1" />
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border border-white/5">
        <table className="w-full min-w-[20rem] text-left text-[10px]">
          <thead>
            <tr className="border-b border-white/5 text-zinc-600">
              <th className="px-2 py-1.5 font-medium">Hop</th>
              <th className="px-2 py-1.5 font-medium text-right">Fiber</th>
              <th className="px-2 py-1.5 font-medium text-right">Tower</th>
              <th className="px-2 py-1.5 font-medium text-right">Atmo</th>
              <th className="px-2 py-1.5 font-medium text-right">Void</th>
              <th className="px-2 py-1.5 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {routeResult.per_hop_latency.map((hop, i) => (
              <tr
                key={`${hop.label}-${i}`}
                className="border-b border-white/[0.03] text-zinc-400"
              >
                <td className="px-2 py-1.5 font-mono text-zinc-300">
                  {hop.label}
                </td>
                <td className="px-2 py-1.5 text-right font-mono">
                  {hop.fiber_ms > 0 ? hop.fiber_ms.toFixed(1) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono">
                  {hop.towers_ms > 0 ? hop.towers_ms.toFixed(1) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono">
                  {hop.atmosphere_ms > 0 ? hop.atmosphere_ms.toFixed(1) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono">
                  {hop.void_ms > 0 ? hop.void_ms.toFixed(1) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-zinc-200">
                  {hop.total_ms.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
