export { predict as predictCongestion, predictPenaltyMs, expectedLatencyMs, SATURATION_LOAD_RATIO } from "./congestion";
export { score as scoreTrust, SPOOFED_LINKS, isKnownSpoofedLink } from "./trust";
export { risk as targetingRisk, calibratedShareRisk, SHARE_BINS } from "./targeting";
export { TRAINED_PARAMS } from "./params";
export type { TrainedParams } from "./params";

import type { LinkLiveState, ModelScores, TrafficHistory } from "../types";
import * as congestion from "./congestion";
import * as trust from "./trust";
import * as targeting from "./targeting";

/** Score all three models for one link (agent tool bundle). */
export function scoreLink(
  linkId: string,
  liveState: LinkLiveState,
  ourTrafficHistory?: TrafficHistory,
): ModelScores {
  const { penalty_ms, saturated } = congestion.predict(linkId, liveState);
  const { trust_score } = trust.score(linkId, liveState);
  const { risk_score } = targeting.risk(linkId, liveState, ourTrafficHistory);

  return {
    predicted_congestion_penalty_ms: saturated ? Number.POSITIVE_INFINITY : penalty_ms,
    trust_score,
    targeting_risk_score: risk_score,
  };
}
