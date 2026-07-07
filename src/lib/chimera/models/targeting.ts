import type { LinkLiveState, TargetingRisk, TrafficHistory } from "../types";
import { normalizeLinkId } from "../link-id";
import { TRAINED_PARAMS } from "./params";

const { targeting_jam_onset_share, targeting_steepness } = TRAINED_PARAMS;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Targeting risk 0–1 from network traffic_share and optional route history.
 *
 * Chimera jams predictable high-share links. Logistic centered at ~8.7% share
 * (median jammed traffic in training). Route entropy penalty boosts risk when
 * we recently over-used this link.
 */
export function risk(
  linkId: string,
  liveState: LinkLiveState,
  ourTrafficHistory: TrafficHistory = [],
): TargetingRisk {
  const id = normalizeLinkId(linkId);
  const share = liveState.traffic_share;

  let riskScore = logistic(targeting_steepness * (share - targeting_jam_onset_share));

  if (ourTrafficHistory.length > 0) {
    const ourUses = ourTrafficHistory.filter((h) => normalizeLinkId(h) === id).length;
    const ourShare = ourUses / ourTrafficHistory.length;
    riskScore = clamp01(riskScore + ourShare * 0.35);
  }

  return { risk_score: clamp01(riskScore) };
}

export const JAM_ONSET_SHARE = targeting_jam_onset_share;
