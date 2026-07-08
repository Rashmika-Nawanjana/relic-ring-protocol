import type { LinkLiveState, TrafficHistory } from "@/lib/chimera/types";
import { canonicalLinkId } from "@/lib/chimera/link-id";
import { isKnownSpoofedLink } from "@/lib/chimera/models";
import {
  explainLinkEvaluation,
  type LinkEvaluationExplanation,
} from "@/lib/chimera/models/explain";
import { detectLiveAnomalies, type LiveAnomaly } from "@/lib/chimera/anomaly";
import { refreshLiveState, saturatedLinkIds } from "@/lib/chimera/state-cache";
import { findRoute } from "@/lib/universe/router";
import type { UniverseConfig } from "@/lib/universe/types";
import type { ParsedRequest } from "./parser";
import {
  buildLinkEvaluations,
  estimatePathLatencyMs,
  findChimeraRoute,
} from "./router";
import {
  isLinkUnsafe,
  linkIdForHop,
  voidHopPhysicsMs,
} from "./cost";
import {
  type CopilotReport,
  type CopilotResult,
  validateCopilotReport,
} from "./schema";
import { runDiagnosticTools } from "./tools";

export type AgentOptions = {
  killed?: Set<string>;
  killedLinks?: Set<string>;
  excludeLinks?: Set<string>;
  trafficHistory?: TrafficHistory;
  /** Skip live API — supply states for tests. */
  liveStates?: Map<string, LinkLiveState>;
};

/** One sequential agent step: pause at a node, run the 3 diagnostic tools. */
export type AgentLogStep = {
  step: number;
  phase: "baseline" | "reroute";
  at_node: string;
  next_node: string;
  link_id: string;
  congestion_penalty_ms: number;
  saturated: boolean;
  trust_score: number;
  targeting_risk_score: number;
  verdict: "cleared" | "rejected";
  reason: string | null;
};

function buildExplanation(
  path: string[],
  evaluations: CopilotReport["link_evaluations"],
  baselinePath: string[],
  excluded: Set<string>,
  anomalies: LiveAnomaly[],
): string {
  const parts: string[] = [];

  if (path.join("→") !== baselinePath.join("→")) {
    parts.push(
      `Baseline physics path ${baselinePath.join(" → ")} overridden by Chimera analysis.`,
    );
  }

  for (const row of evaluations) {
    if (isKnownSpoofedLink(row.link_id) && row.trust_score < 0.2) {
      parts.push(
        `Avoided trusting ${row.link_id}: trust ${row.trust_score.toFixed(2)} (Chimera spoof footprint).`,
      );
    } else if (row.predicted_congestion_penalty_ms > 100_000) {
      parts.push(
        `${row.link_id} congested (+${Math.round(row.predicted_congestion_penalty_ms / 1000)}s penalty).`,
      );
    } else if (row.targeting_risk_score > 0.5) {
      parts.push(
        `${row.link_id} high targeting risk ${row.targeting_risk_score.toFixed(2)} — diversified route.`,
      );
    }
  }

  if (anomalies.length > 0) {
    const flagged = anomalies
      .slice(0, 3)
      .map((a) => `${a.link_id || "network"} (${a.reason})`)
      .join("; ");
    parts.push(
      `Uncertainty flagged — anomalous telemetry outside trained range: ${flagged}${anomalies.length > 3 ? ` and ${anomalies.length - 3} more` : ""}. Affected links treated as unavailable.`,
    );
  }

  if (excluded.size > 0) {
    parts.push(`Excluded links: ${[...excluded].join(", ")}.`);
  }

  if (parts.length === 0) {
    parts.push(
      `Chimera-clear path ${path.join(" → ")}; all links within trust and congestion thresholds.`,
    );
  }

  return parts.join(" ");
}

/** Evaluate one hop with all 3 tools, append to the agent log, return safety. */
function evaluateHop(
  config: UniverseConfig,
  a: string,
  b: string,
  liveStates: Map<string, LinkLiveState>,
  trafficHistory: TrafficHistory,
  phase: AgentLogStep["phase"],
  log: AgentLogStep[],
): { linkId: string; unsafe: boolean } {
  const linkId = linkIdForHop(a, b);
  const live = liveStates.get(linkId);
  const state = live ?? makeMissingState(linkId);
  const voidPhysics = voidHopPhysicsMs(config, a, b);

  const tools = runDiagnosticTools(linkId, state, trafficHistory);
  const unsafe = isLinkUnsafe(linkId, live, voidPhysics, trafficHistory);

  let reason: string | null = null;
  if (unsafe) {
    if (!live) reason = "No live telemetry — treated as unavailable";
    else if (state.status === "saturated" || state.self_reported_latency_ms === null)
      reason = "Saturated (null self-reported latency) — hard failure, not zero latency";
    else if (tools.trust.trust_score < 0.2)
      reason = `Trust ${tools.trust.trust_score.toFixed(2)} below 0.20 threshold (spoof suspected)`;
    else reason = "Combined cost infinite (congestion saturation)";
  }

  log.push({
    step: log.length + 1,
    phase,
    at_node: a,
    next_node: b,
    link_id: linkId,
    congestion_penalty_ms: tools.congestion.saturated
      ? Number.POSITIVE_INFINITY
      : tools.congestion.penalty_ms,
    saturated: tools.congestion.saturated,
    trust_score: tools.trust.trust_score,
    targeting_risk_score: tools.targeting.risk_score,
    verdict: unsafe ? "rejected" : "cleared",
    reason,
  });

  return { linkId, unsafe };
}

/**
 * Sequential CoPilot agent:
 * 1. Baseline physics route
 * 2. Per-hop diagnostic tools on baseline (each step logged)
 * 3. Anomaly guard on live telemetry (unseen-vector safety)
 * 4. Reroute with true-cost graph when any hop is unsafe, re-evaluating new hops
 */
export async function runCopilotAgent(
  config: UniverseConfig,
  request: ParsedRequest,
  options: AgentOptions = {},
): Promise<CopilotResult> {
  const {
    killed = new Set(),
    killedLinks = new Set(),
    excludeLinks = new Set(),
    trafficHistory = [],
  } = options;

  const { origin_id, destination_id } = request;

  if (killed.has(origin_id) || killed.has(destination_id)) {
    return { ok: false, error: "Origin or destination planet is offline" };
  }

  const liveEntry = options.liveStates
    ? { links: options.liveStates, tick: 0 }
    : await refreshLiveState(true);
  const liveStates = liveEntry.links;

  const anomalies = detectLiveAnomalies(liveStates, config);
  const anomalousLinks = new Set(
    anomalies.map((a) => a.link_id).filter((id) => id.length > 0),
  );

  const saturated = saturatedLinkIds(liveStates);
  const excluded = new Set([...excludeLinks, ...saturated, ...anomalousLinks]);

  const baseline = findRoute(
    config,
    origin_id,
    destination_id,
    killed,
    request.message,
    killedLinks,
  );

  if (!baseline.ok) {
    return { ok: false, error: baseline.error };
  }

  const baselinePath = baseline.route;
  const agentLog: AgentLogStep[] = [];

  // Sequential evaluation: pause at each baseline node, run the 3 tools
  for (let i = 0; i < baselinePath.length - 1; i++) {
    const { linkId, unsafe } = evaluateHop(
      config,
      baselinePath[i]!,
      baselinePath[i + 1]!,
      liveStates,
      trafficHistory,
      "baseline",
      agentLog,
    );
    if (unsafe) excluded.add(linkId);
  }

  let chosenPath = baselinePath;

  const baselineBlocked = baselinePath.some((_, i, arr) => {
    if (i === arr.length - 1) return false;
    return excluded.has(canonicalLinkId(arr[i]!, arr[i + 1]!));
  });

  if (excluded.size > 0 || baselineBlocked) {
    const rerouted = findChimeraRoute(config, origin_id, destination_id, {
      killed,
      killedLinks,
      excludedLinks: excluded,
      trafficHistory,
      liveStates,
    });
    if (!rerouted) {
      return {
        ok: false,
        error:
          "Undeliverable — Chimera saturation or trust failures block all routes within Lmax.",
      };
    }
    chosenPath = rerouted;

    // Re-run diagnostics on new hops so the log covers the executed path
    if (chosenPath.join("→") !== baselinePath.join("→")) {
      for (let i = 0; i < chosenPath.length - 1; i++) {
        evaluateHop(
          config,
          chosenPath[i]!,
          chosenPath[i + 1]!,
          liveStates,
          trafficHistory,
          "reroute",
          agentLog,
        );
      }
    }
  }

  const link_evaluations = buildLinkEvaluations(
    config,
    chosenPath,
    liveStates,
    trafficHistory,
  );

  const final_latency_estimate_ms = estimatePathLatencyMs(link_evaluations);
  if (!Number.isFinite(final_latency_estimate_ms)) {
    return {
      ok: false,
      error: "Chosen path contains saturated or untrusted links",
    };
  }

  const report: CopilotReport = {
    origin_id,
    destination_id,
    chosen_path: chosenPath,
    link_evaluations,
    final_latency_estimate_ms,
    explanation: buildExplanation(
      chosenPath,
      link_evaluations,
      baselinePath,
      excluded,
      anomalies,
    ),
  };

  validateCopilotReport(report);

  // Decision Audit bundle: per-link scoring rationale for the chosen path
  const audit: LinkEvaluationExplanation[] = [];
  for (let i = 0; i < chosenPath.length - 1; i++) {
    const a = chosenPath[i]!;
    const b = chosenPath[i + 1]!;
    const linkId = canonicalLinkId(a, b);
    const live = liveStates.get(linkId) ?? makeMissingState(linkId);
    audit.push(
      explainLinkEvaluation(
        linkId,
        live,
        voidHopPhysicsMs(config, a, b),
        trafficHistory,
      ),
    );
  }

  return { ok: true, report, agent_log: agentLog, anomalies, audit };
}

function makeMissingState(linkId: string): LinkLiveState {
  const [planet_a, planet_b] = linkId.split("-") as [string, string];
  return {
    link_id: linkId,
    planet_a,
    planet_b,
    capacity_units: 0,
    current_load: 0,
    load_ratio: 1,
    self_reported_latency_ms: null,
    traffic_share: 0,
    status: "saturated",
  };
}
