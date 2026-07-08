import type { LinkLiveState, TrafficHistory } from "@/lib/chimera/types";
import { canonicalLinkId } from "@/lib/chimera/link-id";
import { isKnownSpoofedLink } from "@/lib/chimera/models";
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

function buildExplanation(
  path: string[],
  evaluations: CopilotReport["link_evaluations"],
  baselinePath: string[],
  excluded: Set<string>,
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

/**
 * Sequential CoPilot agent:
 * 1. Baseline physics route
 * 2. Per-hop diagnostic tools on baseline
 * 3. Reroute with true-cost graph when any hop is unsafe
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

  const saturated = saturatedLinkIds(liveStates);
  const excluded = new Set([...excludeLinks, ...saturated]);

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

  // Sequential evaluation on baseline hops
  for (let i = 0; i < baselinePath.length - 1; i++) {
    const a = baselinePath[i]!;
    const b = baselinePath[i + 1]!;
    const linkId = linkIdForHop(a, b);
    const live = liveStates.get(linkId);
    const voidPhysics = voidHopPhysicsMs(config, a, b);

    runDiagnosticTools(linkId, live ?? makeMissingState(linkId), trafficHistory);

    if (isLinkUnsafe(linkId, live, voidPhysics, trafficHistory)) {
      excluded.add(linkId);
    }
  }

  let chosenPath = baselinePath;

  if (excluded.size > 0 || baselinePath.some((_, i, arr) => {
    if (i === arr.length - 1) return false;
    const lid = canonicalLinkId(arr[i]!, arr[i + 1]!);
    return excluded.has(lid);
  })) {
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
    ),
  };

  validateCopilotReport(report);
  return { ok: true, report };
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
