import type { LinkLiveState, TargetingRisk, TrafficHistory } from "../types";
import { normalizeLinkId } from "../link-id";
import { TRAINED_PARAMS } from "./params";

const { targeting, route_entropy_weight } = TRAINED_PARAMS;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Calibrated jam probability from traffic_share bins (Laplace-smoothed training rates).
 * Explainable: "At 14% network share, historical jam rate was 17.6%."
 */
export function calibratedShareRisk(trafficShare: number): number {
  const { share_bins, share_jam_rates } = targeting;
  for (let i = 0; i < share_bins.length - 1; i++) {
    if (trafficShare >= share_bins[i]! && trafficShare < share_bins[i + 1]!) {
      return share_jam_rates[i] ?? share_jam_rates[share_jam_rates.length - 1]!;
    }
  }
  return share_jam_rates[share_jam_rates.length - 1]!;
}

/**
 * Targeting risk 0–1 from calibrated traffic_share + optional route entropy.
 */
export function risk(
  linkId: string,
  liveState: LinkLiveState,
  ourTrafficHistory: TrafficHistory = [],
): TargetingRisk {
  const id = normalizeLinkId(linkId);
  let riskScore = calibratedShareRisk(liveState.traffic_share);

  if (ourTrafficHistory.length > 0) {
    const ourUses = ourTrafficHistory.filter((h) => normalizeLinkId(h) === id).length;
    const ourShare = ourUses / ourTrafficHistory.length;
    riskScore = clamp01(riskScore + ourShare * route_entropy_weight);
  }

  return { risk_score: clamp01(riskScore) };
}

export const SHARE_BINS: readonly number[] = targeting.share_bins;
