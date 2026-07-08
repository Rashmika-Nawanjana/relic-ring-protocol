"use client";

import { useMemo, useState } from "react";
import { useUniverse } from "@/context/UniverseContext";
import { listValidVoidLinks } from "@/lib/universe/router";

export function ControlPanel() {
  const {
    config,
    killed,
    killedLinks,
    selectedId,
    isSending,
    isCopilotSending,
    routeResult,
    sendPacket,
    sendCopilot,
    toggleKill,
    toggleKillLink,
  } = useUniverse();

  const nodeIds = config.nodes.map((n) => n.id);
  const voidLinks = useMemo(() => listValidVoidLinks(config), [config]);
  const [origin, setOrigin] = useState("Aegis");
  const [destination, setDestination] = useState("Caelum");
  const [message, setMessage] = useState("Hello world");
  const [nlRequest, setNlRequest] = useState(
    "Send Caelum to Aegis: Hello world",
  );
  const [linkKey, setLinkKey] = useState(voidLinks[0]?.key ?? "");
  const busy = isSending || isCopilotSending;

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
          disabled={busy || origin === destination}
          className="mt-1 min-h-10 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-zinc-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSending ? "Computing route…" : "Send packet (Phase 1)"}
        </button>
      </div>

      <div className="mt-5 border-t border-white/5 pt-4">
        <h3 className="text-sm font-medium text-zinc-200">CoPilot (Phase 2)</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          Natural-language request → live Chimera evaluation
        </p>
        <label className="mt-3 block">
          <span className="field-label">NL request</span>
          <textarea
            value={nlRequest}
            onChange={(e) => setNlRequest(e.target.value)}
            rows={2}
            className="field-input resize-none font-mono text-sm"
            placeholder="Send Caelum to Aegis: Hello world"
          />
        </label>
        <button
          type="button"
          onClick={() => sendCopilot({ text: nlRequest })}
          disabled={busy || !nlRequest.trim()}
          className="mt-2 min-h-10 w-full rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-muted)] px-4 py-2 text-sm font-medium text-[var(--accent)] transition hover:border-[var(--accent)]/60 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isCopilotSending ? "CoPilot evaluating…" : "CoPilot send"}
        </button>
        <button
          type="button"
          onClick={() =>
            sendCopilot({ origin, destination, message })
          }
          disabled={busy || origin === destination}
          className="mt-2 min-h-9 w-full rounded-lg border border-white/8 px-3 py-2 text-xs text-zinc-400 transition hover:border-white/12 hover:bg-white/[0.04] disabled:opacity-40"
        >
          CoPilot with dropdowns above
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
            Offline nodes: {[...killed].join(", ")}
          </p>
        )}

        <div className="mt-4">
          <span className="field-label">Void link (M4 chaos)</span>
          <select
            value={linkKey}
            onChange={(e) => setLinkKey(e.target.value)}
            className="field-input"
          >
            {voidLinks.map((link) => (
              <option key={link.key} value={link.key}>
                {link.from} ↔ {link.to}
                {killedLinks.has(link.key) ? " · severed" : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => linkKey && toggleKillLink(linkKey)}
            disabled={!linkKey}
            className="mt-2 min-h-9 w-full rounded-lg border border-white/8 px-3 py-2 text-sm text-zinc-400 transition hover:border-white/12 hover:bg-white/[0.04] hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {killedLinks.has(linkKey) ? "Restore void link" : "Sever void link"}
          </button>
          {killedLinks.size > 0 && (
            <p className="mt-2 text-xs text-zinc-500">
              Severed links: {[...killedLinks].join(", ")}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
