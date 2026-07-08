"use client";

import { useMemo, useState } from "react";
import { useUniverse } from "@/context/UniverseContext";

function fmtMs(ms: number): string {
  if (!Number.isFinite(ms)) return "unavailable";
  if (ms >= 1_000_000) return `${(ms / 1_000_000).toFixed(2)}M ms`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}k ms`;
  return `${ms.toFixed(1)} ms`;
}

/** Normalized Shannon entropy of our recent link usage (1 = fully diversified). */
function routeEntropy(history: string[]): {
  entropy: number;
  hops: number;
  links: number;
  top: { link: string; share: number } | null;
} {
  if (history.length === 0) return { entropy: 0, hops: 0, links: 0, top: null };
  const counts = new Map<string, number>();
  for (const link of history) counts.set(link, (counts.get(link) ?? 0) + 1);

  const n = history.length;
  let h = 0;
  let top: { link: string; share: number } | null = null;
  for (const [link, count] of counts) {
    const p = count / n;
    h -= p * Math.log2(p);
    if (!top || p > top.share) top = { link, share: p };
  }
  const max = Math.log2(counts.size);
  return {
    entropy: max > 0 ? h / max : 1,
    hops: n,
    links: counts.size,
    top,
  };
}

export function CopilotTrace() {
  const { copilotReport, copilotMeta, copilotError, isCopilotSending, trafficHistory } =
    useUniverse();
  const [auditLink, setAuditLink] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);

  const entropy = useMemo(() => routeEntropy(trafficHistory), [trafficHistory]);

  if (isCopilotSending) {
    return (
      <section className="panel-section" aria-label="CoPilot trace">
        <h2 className="text-base font-medium text-zinc-100">CoPilot report</h2>
        <p className="mt-2 text-sm text-zinc-500">Running sequential agent evaluation…</p>
      </section>
    );
  }

  if (copilotError) {
    return (
      <section className="panel-section" aria-label="CoPilot trace">
        <h2 className="text-base font-medium text-zinc-100">CoPilot report</h2>
        <p className="mt-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {copilotError}
        </p>
      </section>
    );
  }

  if (!copilotReport) {
    return (
      <section className="panel-section" aria-label="CoPilot trace">
        <h2 className="text-base font-medium text-zinc-100">CoPilot report</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          Use CoPilot send to get the unified routing report with per-link
          evaluations and explanation.
        </p>
      </section>
    );
  }

  const report = copilotReport;
  const anomalies = copilotMeta?.anomalies ?? [];
  const agentLog = copilotMeta?.agent_log ?? [];
  const audit = copilotMeta?.audit ?? [];
  const activeAudit = audit.find((a) => a.link_id === auditLink) ?? null;

  return (
    <section className="panel-section" aria-label="CoPilot trace">
      <h2 className="text-base font-medium text-zinc-100">CoPilot report</h2>

      <div className="mt-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
          chosen_path
        </p>
        <p className="mt-1 font-mono text-sm text-[var(--accent)]">
          {report.chosen_path.join(" → ")}
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Est. latency {fmtMs(report.final_latency_estimate_ms)}
        </p>
      </div>

      {anomalies.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-amber-300">
            Uncertainty flagged — {anomalies.length} telemetry{" "}
            {anomalies.length === 1 ? "anomaly" : "anomalies"}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {anomalies.slice(0, 4).map((a, i) => (
              <li key={`${a.link_id}-${i}`} className="text-[11px] text-amber-200/80">
                {a.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{report.explanation}</p>

      <div className="mt-4 overflow-x-auto">
        <p className="mb-1 text-[11px] text-zinc-600">
          Click a row for the Decision Audit breakdown
        </p>
        <table className="w-full min-w-[280px] text-left text-[11px]">
          <thead>
            <tr className="border-b border-white/5 text-zinc-500">
              <th className="pb-2 pr-2 font-medium">link_id</th>
              <th className="pb-2 pr-2 font-medium">cong.</th>
              <th className="pb-2 pr-2 font-medium">trust</th>
              <th className="pb-2 pr-2 font-medium">risk</th>
              <th className="pb-2 font-medium">cost</th>
            </tr>
          </thead>
          <tbody>
            {report.link_evaluations.map((row) => (
              <tr
                key={row.link_id}
                onClick={() =>
                  setAuditLink(auditLink === row.link_id ? null : row.link_id)
                }
                className={`cursor-pointer border-b border-white/[0.03] transition ${
                  auditLink === row.link_id
                    ? "bg-white/[0.06] text-zinc-100"
                    : "text-zinc-300 hover:bg-white/[0.03]"
                }`}
              >
                <td className="py-2 pr-2 font-mono">{row.link_id}</td>
                <td className="py-2 pr-2">{fmtMs(row.predicted_congestion_penalty_ms)}</td>
                <td className="py-2 pr-2">{row.trust_score.toFixed(2)}</td>
                <td className="py-2 pr-2">{row.targeting_risk_score.toFixed(2)}</td>
                <td className="py-2">{fmtMs(row.combined_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeAudit && (
        <div className="mt-2 rounded-md border border-[var(--accent)]/25 bg-[var(--accent-muted)] px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--accent)]">
            Decision Audit · {activeAudit.link_id}
          </p>
          <dl className="mt-2 flex flex-col gap-1.5 text-[11px] leading-relaxed">
            <div>
              <dt className="font-medium text-zinc-300">Congestion</dt>
              <dd className="text-zinc-400">{activeAudit.congestion}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-300">Trust</dt>
              <dd className="text-zinc-400">{activeAudit.trust}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-300">Targeting</dt>
              <dd className="text-zinc-400">{activeAudit.targeting}</dd>
            </div>
            <div>
              <dt className="font-medium text-zinc-300">Combined cost</dt>
              <dd className="font-mono text-[10px] text-zinc-400">
                {activeAudit.combined_cost}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {agentLog.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            className="text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            {showLog ? "▾" : "▸"} Sequential agent log ({agentLog.length} tool steps)
          </button>
          {showLog && (
            <ol className="mt-2 flex flex-col gap-1.5">
              {agentLog.map((step) => (
                <li
                  key={`${step.phase}-${step.step}`}
                  className="rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5 text-[11px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-zinc-300">
                      {step.step}. {step.at_node} → {step.next_node}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {step.phase === "reroute" && (
                        <span className="rounded bg-white/5 px-1 py-0.5 text-[9px] uppercase text-zinc-500">
                          reroute
                        </span>
                      )}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                          step.verdict === "cleared"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-red-500/15 text-red-300"
                        }`}
                      >
                        {step.verdict}
                      </span>
                    </span>
                  </div>
                  <p className="mt-1 text-zinc-500">
                    congestion {fmtMs(step.congestion_penalty_ms)} · trust{" "}
                    {step.trust_score.toFixed(2)} · risk{" "}
                    {step.targeting_risk_score.toFixed(2)}
                  </p>
                  {step.reason && (
                    <p className="mt-0.5 text-red-300/80">{step.reason}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {entropy.hops > 0 && (
        <div className="mt-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Route entropy
            </p>
            <span className="font-mono text-xs text-zinc-300">
              {entropy.entropy.toFixed(2)}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/6">
            <div
              className={`h-full rounded-full ${
                entropy.entropy > 0.7
                  ? "bg-emerald-400/80"
                  : entropy.entropy > 0.4
                    ? "bg-amber-400/80"
                    : "bg-red-400/80"
              }`}
              style={{ width: `${Math.max(entropy.entropy * 100, 4)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            {entropy.hops} recent hops over {entropy.links} links
            {entropy.top &&
              ` · heaviest ${entropy.top.link} (${Math.round(entropy.top.share * 100)}%)`}
            {" — diversification keeps Chimera from predicting our next packet"}
          </p>
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400">
          Raw JSON (unified report)
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-white/5 bg-black/40 p-2 font-mono text-[10px] text-zinc-400">
          {JSON.stringify(report, null, 2)}
        </pre>
      </details>
    </section>
  );
}
