import type { CongestionPrediction, LinkLiveState } from "../types";
import { normalizeLinkId } from "../link-id";
import { TRAINED_PARAMS } from "./params";

const {
  saturation_load_ratio,
  congestion_onset_ratio,
  power_law_weight,
  load_bin_count,
} = TRAINED_PARAMS;

type LinkCurve = (typeof TRAINED_PARAMS.link_congestion)[keyof typeof TRAINED_PARAMS.link_congestion];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function getCurve(linkId: string): LinkCurve | undefined {
  const id = normalizeLinkId(linkId);
  return TRAINED_PARAMS.link_congestion[id as keyof typeof TRAINED_PARAMS.link_congestion];
}

/**
 * Hybrid per-link congestion penalty (explainable for Decision Audit):
 *   power = scale × t^exponent
 *   binned = median penalty at this load bin from training history
 *   penalty_ms = w × power + (1 − w) × binned
 */
export function predictPenaltyMs(linkId: string, loadRatio: number): number {
  const curve = getCurve(linkId);
  if (!curve) return Number.POSITIVE_INFINITY;

  if (loadRatio >= saturation_load_ratio) {
    return Number.POSITIVE_INFINITY;
  }
  if (loadRatio < congestion_onset_ratio) {
    return 0;
  }

  const span = saturation_load_ratio - congestion_onset_ratio;
  const t = clamp01((loadRatio - congestion_onset_ratio) / span);
  const power = curve.scale_ms * t ** curve.exponent;
  const binIdx = Math.min(load_bin_count - 1, Math.floor(loadRatio * load_bin_count));
  const binned = curve.load_bin_penalty_ms[binIdx] ?? power;

  return power_law_weight * power + (1 - power_law_weight) * binned;
}

export function predict(
  linkId: string,
  liveState: LinkLiveState,
): CongestionPrediction {
  const { load_ratio, status } = liveState;

  const saturated =
    status === "saturated" || load_ratio >= saturation_load_ratio;

  if (saturated) {
    return { penalty_ms: Number.POSITIVE_INFINITY, saturated: true };
  }

  return {
    penalty_ms: predictPenaltyMs(linkId, load_ratio),
    saturated: false,
  };
}

export function expectedLatencyMs(
  linkId: string,
  liveState: LinkLiveState,
): number {
  const id = normalizeLinkId(linkId);
  const curve = getCurve(id);
  if (!curve) return Number.POSITIVE_INFINITY;

  const penalty = predictPenaltyMs(id, liveState.load_ratio);
  if (!Number.isFinite(penalty)) return Number.POSITIVE_INFINITY;
  return curve.baseline_ms + penalty;
}

export const SATURATION_LOAD_RATIO = saturation_load_ratio;
