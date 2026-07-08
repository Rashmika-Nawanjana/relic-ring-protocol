import type { ModelScores } from "../types";

/** Tunable weights for Person 2 true-cost router (documented for Decision Audit). */
export type CostWeights = {
  /** Multiplier on (1 - trust_score) × physics baseline. */
  trust_scale: number;
  /** Multiplier on targeting_risk_score × physics baseline. */
  risk_scale: number;
};

export const DEFAULT_COST_WEIGHTS: CostWeights = {
  trust_scale: 0.5,
  risk_scale: 0.3,
};

/**
 * Combine physics baseline with Person 1 model scores into a single edge weight.
 *
 * Formula (team_plan Person 2):
 *   combined = physics + congestion + (1-trust)×physics×trust_scale + risk×physics×risk_scale
 *
 * Saturated links return Infinity so Dijkstra never selects them.
 */
export function combineCosts(
  physicsBaselineMs: number,
  scores: ModelScores,
  weights: CostWeights = DEFAULT_COST_WEIGHTS,
): number {
  if (
    !Number.isFinite(physicsBaselineMs) ||
    !Number.isFinite(scores.predicted_congestion_penalty_ms)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const trustAdj =
    (1 - scores.trust_score) * physicsBaselineMs * weights.trust_scale;
  const riskAdj =
    scores.targeting_risk_score * physicsBaselineMs * weights.risk_scale;

  return (
    physicsBaselineMs +
    scores.predicted_congestion_penalty_ms +
    trustAdj +
    riskAdj
  );
}
