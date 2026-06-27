"use client";

import { useMemo } from "react";
import { useUniverse } from "@/context/UniverseContext";

export function PacketTrace() {
  const { routeResult } = useUniverse();

  const encodingSteps = useMemo(() => {
    if (!routeResult?.ok) return [];
    return routeResult.hops.filter((h) => h.encoding);
  }, [routeResult]);

  if (!routeResult?.ok) {
    return (
      <section className="panel-section" aria-label="Packet trace">
        <h2 className="text-base font-medium text-zinc-100">Packet trace</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Send a packet to see how your message is re-encoded at each hop.
        </p>
      </section>
    );
  }

  const asciiBytes = [...routeResult.message].map((ch) => ch.charCodeAt(0));

  return (
    <section className="panel-section" aria-label="Packet trace">
      <h2 className="text-base font-medium text-zinc-100">Packet trace</h2>

      <div className="mt-3 space-y-3">
        <div className="rounded-md bg-white/[0.03] px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            ASCII (internal)
          </p>
          <p className="mt-1 font-mono text-sm text-zinc-200">
            &quot;{routeResult.message}&quot;
          </p>
          <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-zinc-500">
            [{asciiBytes.join(", ")}]
          </p>
        </div>

        {encodingSteps.length === 0 ? (
          <p className="text-sm text-zinc-500">No encoding hops recorded.</p>
        ) : (
          encodingSteps.map((hop, i) => (
            <div
              key={`${hop.planet}-${hop.tower}-${i}`}
              className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-zinc-200">
                  {hop.planet}
                </span>
                <span className="font-mono text-xs text-zinc-500">
                  {hop.tower}
                </span>
                <span className="text-xs capitalize text-zinc-600">
                  {hop.action}
                </span>
                {hop.encoding_base != null && (
                  <span className="rounded bg-[var(--accent-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                    Base {hop.encoding_base}
                  </span>
                )}
              </div>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-amber-200/90">
                {hop.encoding}
              </pre>
            </div>
          ))
        )}
      </div>

      <details className="mt-4 group">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400">
          Full hop log ({routeResult.hops.length} tower events)
        </summary>
        <div className="mt-2 max-h-48 overflow-auto rounded-md bg-black/30">
          <table className="w-full text-left text-[11px]">
            <thead>
              <tr className="border-b border-white/5 text-zinc-600">
                <th className="px-2 py-1.5 font-medium">Planet</th>
                <th className="px-2 py-1.5 font-medium">Tower</th>
                <th className="px-2 py-1.5 font-medium">Action</th>
                <th className="px-2 py-1.5 font-medium">ms</th>
              </tr>
            </thead>
            <tbody>
              {routeResult.hops.map((hop, i) => (
                <tr key={i} className="border-b border-white/[0.03] text-zinc-400">
                  <td className="px-2 py-1.5 text-zinc-300">{hop.planet}</td>
                  <td className="px-2 py-1.5 font-mono">{hop.tower}</td>
                  <td className="px-2 py-1.5 capitalize">{hop.action}</td>
                  <td className="px-2 py-1.5 font-mono">
                    {hop.latency_ms > 0 ? hop.latency_ms.toFixed(1) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
