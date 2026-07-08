import type { LinkLiveState, TrafficHistory } from "../types";
import { normalizeLinkId } from "../link-id";
import { predict as predictCongestion, SATURATION_LOAD_RATIO } from "./congestion";
import { score as scoreTrust, isKnownSpoofedLink } from "./trust";
import { risk as targetingRisk, JAM_ONSET_SHARE } from "./targeting";
import { TRAINED_PARAMS } from "./params";
import { combineCosts, DEFAULT_COST_WEIGHTS } from "./cost";
import type { ModelScores } from "../types";

export type LinkEvaluationExplanation = {
  link_id: string;
  congestion: string;
  trust: string;
  targeting: string;
  combined_cost: string;
  summary: string;
};

function fmtMs(ms: number): string {
  if (!Number.isFinite(ms)) return "unavailable";
  if (ms >= 1_000_000) return `${(ms / 1_000_000).toFixed(2)}M ms`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}k ms`;
  return `${ms.toFixed(1)} ms`;
}

/** Human-readable congestion rationale for Decision Audit. */
export function explainCongestion(linkId: string, liveState: LinkLiveState): string {
  const id = normalizeLinkId(linkId);
  const { penalty_ms, saturated } = predictCongestion(id, liveState);
  const { load_ratio, status } = liveState;

  if (saturated || status === "saturated") {
    return `Link ${id} is saturated (load_ratio=${load_ratio.toFixed(3)}, threshold=${SATURATION_LOAD_RATIO}). Treat as hard failure — not zero latency.`;
  }

  if (load_ratio < TRAINED_PARAMS.congestion_onset_ratio) {
    return `Load ratio ${load_ratio.toFixed(3)} is below onset ${TRAINED_PARAMS.congestion_onset_ratio}; no Chimera congestion penalty applied.`;
  }

  const span = TRAINED_PARAMS.saturation_load_ratio - TRAINED_PARAMS.congestion_onset_ratio;
  const t = (load_ratio - TRAINED_PARAMS.congestion_onset_ratio) / span;
  return (
    `At load_ratio=${load_ratio.toFixed(3)}, normalized t=${t.toFixed(3)}. ` +
    `Penalty = ${TRAINED_PARAMS.congestion_scale_ms.toFixed(0)} × t^${TRAINED_PARAMS.congestion_exponent} = ${fmtMs(penalty_ms)}.`
  );
}

/** Human-readable trust rationale for Decision Audit. */
export function explainTrust(linkId: string, liveState: LinkLiveState): string {
  const id = normalizeLinkId(linkId);
  const { trust_score } = scoreTrust(id, liveState);

  if (liveState.status === "saturated" || liveState.self_reported_latency_ms === null) {
    return `Link ${id} is saturated with null self-reported latency; trust forced to 0.`;
  }

  const prior =
    TRAINED_PARAMS.link_trust_priors[id as keyof typeof TRAINED_PARAMS.link_trust_priors] ??
    0.9;
  const knownSpoof = isKnownSpoofedLink(id);

  let detail = `Historical prior=${prior.toFixed(2)}`;
  if (knownSpoof) {
    detail += " (flagged systematic spoofer in training telemetry)";
  }

  if (liveState.self_reported_latency_ms !== null) {
    detail += `; self-reported=${fmtMs(liveState.self_reported_latency_ms)} vs load-implied expected latency`;
  }

  return `${detail}. Final trust_score=${trust_score.toFixed(2)}.`;
}

/** Human-readable targeting rationale for Decision Audit. */
export function explainTargeting(
  linkId: string,
  liveState: LinkLiveState,
  ourTrafficHistory: TrafficHistory = [],
): string {
  const id = normalizeLinkId(linkId);
  const { risk_score } = targetingRisk(id, liveState, ourTrafficHistory);
  const share = liveState.traffic_share;

  let detail =
    `Network traffic_share=${(share * 100).toFixed(2)}% (jam onset ~${(JAM_ONSET_SHARE * 100).toFixed(1)}%). ` +
    `Logistic risk=${risk_score.toFixed(3)}.`;

  if (ourTrafficHistory.length > 0) {
    const ourUses = ourTrafficHistory.filter((h) => normalizeLinkId(h) === id).length;
    const ourShare = ourUses / ourTrafficHistory.length;
    detail += ` Route entropy: we used this link ${ourUses}/${ourTrafficHistory.length} recent hops (${(ourShare * 100).toFixed(0)}%).`;
  }

  return detail;
}

/** Full per-link explanation bundle for judges (Decision Audit). */
export function explainLinkEvaluation(
  linkId: string,
  liveState: LinkLiveState,
  physicsBaselineMs: number,
  ourTrafficHistory: TrafficHistory = [],
  scores?: ModelScores,
): LinkEvaluationExplanation {
  const id = normalizeLinkId(linkId);
  const resolvedScores = scores ?? {
    predicted_congestion_penalty_ms: predictCongestion(id, liveState).penalty_ms,
    trust_score: scoreTrust(id, liveState).trust_score,
    targeting_risk_score: targetingRisk(id, liveState, ourTrafficHistory).risk_score,
  };

  if (predictCongestion(id, liveState).saturated) {
    resolvedScores.predicted_congestion_penalty_ms = Number.POSITIVE_INFINITY;
  }

  const combined = combineCosts(physicsBaselineMs, resolvedScores);
  const w = DEFAULT_COST_WEIGHTS;

  const combinedExplain =
    !Number.isFinite(combined)
      ? "Link unavailable (saturated or invalid baseline)."
      : `physics(${fmtMs(physicsBaselineMs)}) + congestion(${fmtMs(resolvedScores.predicted_congestion_penalty_ms)}) + ` +
        `trust_adj((1-${resolvedScores.trust_score.toFixed(2)})×${fmtMs(physicsBaselineMs)}×${w.trust_scale}) + ` +
        `risk_adj(${resolvedScores.targeting_risk_score.toFixed(2)}×${fmtMs(physicsBaselineMs)}×${w.risk_scale}) = ${fmtMs(combined)}`;

  const congestion = explainCongestion(id, liveState);
  const trust = explainTrust(id, liveState);
  const targeting = explainTargeting(id, liveState, ourTrafficHistory);

  const summary =
    combined === Number.POSITIVE_INFINITY
      ? `${id}: saturated — exclude from routing.`
      : `${id}: combined_cost ${fmtMs(combined)} (trust ${resolvedScores.trust_score.toFixed(2)}, risk ${resolvedScores.targeting_risk_score.toFixed(2)}).`;

  return {
    link_id: id,
    congestion,
    trust,
    targeting,
    combined_cost: combinedExplain,
    summary,
  };
}
