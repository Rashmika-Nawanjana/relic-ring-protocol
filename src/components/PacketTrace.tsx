"use client";

import { useUniverse } from "@/context/UniverseContext";

export function PacketTrace() {
  const { routeResult } = useUniverse();

  if (!routeResult?.ok) {
    return (
      <section
        className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 backdrop-blur-md"
        aria-label="Packet trace"
      >
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
          Packet Trace
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Send a packet to see multi-hop encoding (M2).
        </p>
      </section>
    );
  }

  return (
    <section
      className="rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 backdrop-blur-md"
      aria-label="Packet trace"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
        Packet Trace · M2
      </h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="pb-2 pr-3 font-medium">Planet</th>
              <th className="pb-2 pr-3 font-medium">Tower</th>
              <th className="pb-2 pr-3 font-medium">Action</th>
              <th className="pb-2 pr-3 font-medium">Latency</th>
              <th className="pb-2 font-medium">Payload encoding</th>
            </tr>
          </thead>
          <tbody>
            {routeResult.hops.map((hop, i) => (
              <tr key={i} className="border-b border-zinc-800/60 text-zinc-300">
                <td className="py-2 pr-3 font-medium text-zinc-100">
                  {hop.planet}
                </td>
                <td className="py-2 pr-3 font-mono">{hop.tower}</td>
                <td className="py-2 pr-3 capitalize">{hop.action}</td>
                <td className="py-2 pr-3 font-mono">
                  {hop.latency_ms.toFixed(2)} ms
                </td>
                <td className="max-w-[180px] truncate py-2 font-mono text-indigo-300">
                  {hop.encoding ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
