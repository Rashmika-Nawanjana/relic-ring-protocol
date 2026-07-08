"use client";

import { useEffect, useState } from "react";
import { useUniverse } from "@/context/UniverseContext";
import type { LinkHealthStatus, LinkPanelRow } from "@/lib/chimera/panel-data";

const POLL_MS = 2500;

function healthColor(health: LinkHealthStatus): string {
  switch (health) {
    case "ok":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
    case "congested":
      return "bg-amber-500/15 text-amber-300 border-amber-500/25";
    case "danger":
      return "bg-red-500/15 text-red-300 border-red-500/25";
  }
}

function fmtPenalty(ms: number): string {
  if (!Number.isFinite(ms)) return "∞";
  if (ms >= 1_000_000) return `${(ms / 1_000_000).toFixed(1)}Ms`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(0)}k`;
  return `${Math.round(ms)}`;
}

export function ChimeraPanel() {
  const { setLinkHealthMap, chimeraTick, setChimeraTick } = useUniverse();
  const [links, setLinks] = useState<LinkPanelRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/chimera/panel", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "Panel fetch failed");
        }
        if (cancelled) return;
        setLinks(data.links);
        setChimeraTick(data.tick);
        const healthMap = new Map<string, LinkHealthStatus>();
        for (const row of data.links as LinkPanelRow[]) {
          healthMap.set(row.link_id, row.health);
        }
        setLinkHealthMap(healthMap);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Chimera offline");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [setLinkHealthMap, setChimeraTick]);

  return (
    <section className="panel-section" aria-label="Chimera link health">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-medium text-zinc-100">Chimera grid</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Live interplanetary links · tick {chimeraTick ?? "—"}
          </p>
        </div>
        <div className="flex gap-1 text-[10px] text-zinc-600">
          <span className="rounded border border-emerald-500/20 px-1.5 py-0.5">ok</span>
          <span className="rounded border border-amber-500/20 px-1.5 py-0.5">load</span>
          <span className="rounded border border-red-500/20 px-1.5 py-0.5">risk</span>
        </div>
      </div>

      {loading && links.length === 0 && (
        <p className="text-sm text-zinc-500">Polling Chimera /state…</p>
      )}
      {error && (
        <p className="mb-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
        {links.map((link) => (
          <li
            key={link.link_id}
            className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-zinc-200">{link.link_id}</span>
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${healthColor(link.health)}`}
              >
                {link.health}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px]">
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-400">
                load {(link.load_ratio * 100).toFixed(0)}%
              </span>
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-400">
                trust {link.trust_score.toFixed(2)}
              </span>
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-400">
                risk {link.targeting_risk_score.toFixed(2)}
              </span>
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-zinc-400">
                +{fmtPenalty(link.predicted_congestion_penalty_ms)} ms
              </span>
              {link.status === "saturated" && (
                <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-red-300">
                  saturated
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
