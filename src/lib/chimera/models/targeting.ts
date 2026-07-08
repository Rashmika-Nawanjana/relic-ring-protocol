import type { LinkLiveState, TargetingRisk, TrafficHistory } from "../types";
import { normalizeLinkId } from "../link-id";
import { TRAINED_PARAMS } from "./params";

const {
  targeting_jam_onset_share,
  targeting_steepness,
  targeting_bias_weight,
  targeting_prev_jam_weight,
  link_jam_rates,
  global_jam_rate,
} = TRAINED_PARAMS;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Targeting risk 0–1 from traffic_share, per-link jam bias, and route history.
 *
 * Trained via MLE logistic regression on Day 1 incident data.
 * Features: traffic_share (logistic), per-link historical jam rate offset,
 * prev-tick jam indicator, and our own route entropy.
 */
export function risk(
  linkId: string,
  liveState: LinkLiveState,
  ourTrafficHistory: TrafficHistory = [],
): TargetingRisk {
  const id = normalizeLinkId(linkId);
  const share = liveState.traffic_share;

  const linkRate =
    link_jam_rates[id as keyof typeof link_jam_rates] ?? global_jam_rate;
  const bias = (linkRate - global_jam_rate) * targeting_bias_weight;

  let z = targeting_steepness * (share - targeting_jam_onset_share) + bias;

  // prev-jam feature: if this link was in recent traffic history (proxy for
  // recently-used links that Chimera may target), scale by prev_jam weight
  if (ourTrafficHistory.length > 0) {
    const recentUses = ourTrafficHistory.filter(
      (h) => normalizeLinkId(h) === id,
    ).length;
    const recentShare = recentUses / ourTrafficHistory.length;
    z += recentShare * targeting_prev_jam_weight;
    // Route entropy penalty on top
    z += recentShare * 0.35;
  }

  const riskScore = clamp01(logistic(z));
  return { risk_score: riskScore };
}

export const JAM_ONSET_SHARE = targeting_jam_onset_share;
