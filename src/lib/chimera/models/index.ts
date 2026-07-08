export { predict as predictCongestion, expectedLatencyMs, SATURATION_LOAD_RATIO } from "./congestion";
export { score as scoreTrust, SPOOFED_LINKS, isKnownSpoofedLink } from "./trust";
export { risk as targetingRisk, JAM_ONSET_SHARE } from "./targeting";
export { combineCosts, DEFAULT_COST_WEIGHTS } from "./cost";
export type { CostWeights } from "./cost";
export {
  explainCongestion,
  explainTrust,
  explainTargeting,
  explainLinkEvaluation,
} from "./explain";
export type { LinkEvaluationExplanation } from "./explain";
export {
  congestionTool,
  trustTool,
  targetingTool,
  runDiagnosticTools,
} from "./tools";
export { TRAINED_PARAMS } from "./params";
export type { TrainedParams } from "./params";

import type { LinkEvaluation, LinkLiveState, ModelScores, TrafficHistory } from "../types";
import { normalizeLinkId } from "../link-id";
import * as congestion from "./congestion";
import * as trust from "./trust";
import * as targeting from "./targeting";
import { combineCosts, type CostWeights, DEFAULT_COST_WEIGHTS } from "./cost";
import { explainLinkEvaluation } from "./explain";

/** Score all three models for one link (agent tool bundle). */
export function scoreLink(
  linkId: string,
  liveState: LinkLiveState,
  ourTrafficHistory?: TrafficHistory,
): ModelScores {
  const id = normalizeLinkId(linkId);
  const { penalty_ms, saturated } = congestion.predict(id, liveState);
  const { trust_score } = trust.score(id, liveState);
  const { risk_score } = targeting.risk(id, liveState, ourTrafficHistory);

  return {
    predicted_congestion_penalty_ms: saturated ? Number.POSITIVE_INFINITY : penalty_ms,
    trust_score,
    targeting_risk_score: risk_score,
  };
}

/**
 * Full per-link evaluation for `link_evaluations[]` + Decision Audit.
 * Person 2 passes physics baseline from Phase 1 void-hop latency.
 */
export function evaluateLink(
  linkId: string,
  liveState: LinkLiveState,
  physicsBaselineMs: number,
  ourTrafficHistory?: TrafficHistory,
  weights: CostWeights = DEFAULT_COST_WEIGHTS,
): LinkEvaluation {
  const id = normalizeLinkId(linkId);
  const scores = scoreLink(id, liveState, ourTrafficHistory);
  const combined_cost = combineCosts(physicsBaselineMs, scores, weights);

  return {
    link_id: id,
    predicted_congestion_penalty_ms: scores.predicted_congestion_penalty_ms,
    trust_score: scores.trust_score,
    targeting_risk_score: scores.targeting_risk_score,
    combined_cost,
  };
}

/** Evaluate link and return audit-ready explanation (live-day Decision Audit). */
export function evaluateLinkWithExplanation(
  linkId: string,
  liveState: LinkLiveState,
  physicsBaselineMs: number,
  ourTrafficHistory?: TrafficHistory,
  weights: CostWeights = DEFAULT_COST_WEIGHTS,
): { evaluation: LinkEvaluation; explanation: ReturnType<typeof explainLinkEvaluation> } {
  const evaluation = evaluateLink(
    linkId,
    liveState,
    physicsBaselineMs,
    ourTrafficHistory,
    weights,
  );
  const explanation = explainLinkEvaluation(
    linkId,
    liveState,
    physicsBaselineMs,
    ourTrafficHistory,
    {
      predicted_congestion_penalty_ms: evaluation.predicted_congestion_penalty_ms,
      trust_score: evaluation.trust_score,
      targeting_risk_score: evaluation.targeting_risk_score,
    },
  );
  return { evaluation, explanation };
}
