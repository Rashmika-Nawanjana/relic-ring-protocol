"use client";

import { useUniverse } from "@/context/UniverseContext";

function fmtMs(ms: number): string {
  if (!Number.isFinite(ms)) return "unavailable";
  if (ms >= 1_000_000) return `${(ms / 1_000_000).toFixed(2)}M ms`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}k ms`;
  return `${ms.toFixed(1)} ms`;
}

export function CopilotTrace() {
  const { copilotReport, copilotError, isCopilotSending } = useUniverse();

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

      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{report.explanation}</p>

      <div className="mt-4 overflow-x-auto">
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
              <tr key={row.link_id} className="border-b border-white/[0.03] text-zinc-300">
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

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-400">
          Raw JSON
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-white/5 bg-black/40 p-2 font-mono text-[10px] text-zinc-400">
          {JSON.stringify(report, null, 2)}
        </pre>
      </details>
    </section>
  );
}
