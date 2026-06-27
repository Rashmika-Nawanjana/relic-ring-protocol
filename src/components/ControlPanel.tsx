"use client";

import { useState } from "react";
import { useUniverse } from "@/context/UniverseContext";

export function ControlPanel() {
  const {
    config,
    killed,
    selectedId,
    isSending,
    routeResult,
    sendPacket,
    toggleKill,
  } = useUniverse();

  const nodeIds = config.nodes.map((n) => n.id);
  const [origin, setOrigin] = useState("Aegis");
  const [destination, setDestination] = useState("Caelum");
  const [message, setMessage] = useState("Hello world");

  return (
    <aside
      className="flex w-full flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-950/90 p-4 backdrop-blur-md sm:max-w-xs"
      aria-label="Network controls"
    >
      <header>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
          Relic Ring Control
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          {config.universe_metadata.system_name} · Lmax{" "}
          {(config.universe_metadata.max_void_hop_distance_km / 1e6).toFixed(0)}M km
        </p>
      </header>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">Origin</span>
        <select
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-indigo-500 focus:outline-none"
        >
          {nodeIds.map((id) => (
            <option key={id} value={id} disabled={killed.has(id)}>
              {id} {killed.has(id) ? "(offline)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">Destination</span>
        <select
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-indigo-500 focus:outline-none"
        >
          {nodeIds.map((id) => (
            <option key={id} value={id} disabled={killed.has(id)}>
              {id} {killed.has(id) ? "(offline)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-400">Message</span>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-indigo-500 focus:outline-none"
        />
      </label>

      <button
        type="button"
        onClick={() => sendPacket(origin, destination, message)}
        disabled={isSending || origin === destination}
        className="min-h-11 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSending ? "Routing…" : "Send Packet"}
      </button>

      {routeResult && !routeResult.ok && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {routeResult.error}
        </p>
      )}

      {routeResult?.ok && (
        <p className="rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-300">
          Route: {routeResult.route.join(" → ")} ·{" "}
          {routeResult.total_latency_ms.toFixed(1)} ms
        </p>
      )}

      <div className="border-t border-zinc-800 pt-3">
        <p className="mb-2 text-xs text-zinc-500">
          Click a planet to select · M4 chaos test
        </p>
        <button
          type="button"
          onClick={() => selectedId && toggleKill(selectedId)}
          disabled={!selectedId}
          className="min-h-11 w-full rounded-lg border border-red-800/60 px-4 py-2.5 text-sm text-red-300 transition hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {selectedId
            ? killed.has(selectedId)
              ? `Restore ${selectedId}`
              : `Kill ${selectedId}`
            : "Kill Selected Planet"}
        </button>
      </div>

      {killed.size > 0 && (
        <p className="text-xs text-red-400">
          Offline: {[...killed].join(", ")}
        </p>
      )}
    </aside>
  );
}
