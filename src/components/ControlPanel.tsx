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
    <section className="panel-section" aria-label="Network controls">
      <div className="mb-4">
        <h2 className="text-base font-medium text-zinc-100">Transmit</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          {config.universe_metadata.system_name} · max hop{" "}
          {(config.universe_metadata.max_void_hop_distance_km / 1e6).toFixed(0)}
          M km
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label>
          <span className="field-label">Origin</span>
          <select
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="field-input"
          >
            {nodeIds.map((id) => (
              <option key={id} value={id} disabled={killed.has(id)}>
                {id}
                {killed.has(id) ? " · offline" : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="field-label">Destination</span>
          <select
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="field-input"
          >
            {nodeIds.map((id) => (
              <option key={id} value={id} disabled={killed.has(id)}>
                {id}
                {killed.has(id) ? " · offline" : ""}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="field-label">Message</span>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="field-input font-mono text-sm"
            placeholder="Packet payload (ASCII)"
          />
          <span className="mt-1 block text-[11px] text-zinc-600">
            Edit then press Send — trace updates on send, not while typing.
          </span>
        </label>

        <button
          type="button"
          onClick={() => sendPacket(origin, destination, message)}
          disabled={isSending || origin === destination}
          className="mt-1 min-h-10 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSending ? "Computing route…" : "Send packet"}
        </button>
      </div>

      {routeResult && !routeResult.ok && (
        <p className="mt-3 rounded-md border border-white/6 bg-white/[0.03] px-3 py-2 text-sm text-zinc-400">
          {routeResult.error}
        </p>
      )}

      <div className="mt-5 border-t border-white/5 pt-4">
        <p className="mb-2 text-xs text-zinc-600">
          Click a planet in the view to select it
        </p>
        <button
          type="button"
          onClick={() => selectedId && toggleKill(selectedId)}
          disabled={!selectedId}
          className="min-h-9 w-full rounded-lg border border-white/8 px-3 py-2 text-sm text-zinc-400 transition hover:border-white/12 hover:bg-white/[0.04] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {selectedId
            ? killed.has(selectedId)
              ? `Restore ${selectedId}`
              : `Kill ${selectedId}`
            : "Kill selected planet"}
        </button>
        {killed.size > 0 && (
          <p className="mt-2 text-xs text-zinc-500">
            Offline: {[...killed].join(", ")}
          </p>
        )}
      </div>
    </section>
  );
}
