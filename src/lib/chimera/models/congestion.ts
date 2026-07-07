import type { CongestionPrediction, LinkLiveState } from "../types";
import { normalizeLinkId } from "../link-id";
import { TRAINED_PARAMS } from "./params";

const {
  saturation_load_ratio,
  congestion_onset_ratio,
  congestion_exponent,
  congestion_scale_ms,
} = TRAINED_PARAMS;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Predict Chimera congestion penalty from live load.
 *
 * Formula (explainable for Decision Audit):
 *   t = (load_ratio - onset) / (saturation - onset)
 *   penalty_ms = scale × t^exponent   for onset ≤ load < saturation
 *   saturated when status === "saturated" OR load_ratio ≥ saturation threshold (~0.91)
 */
export function predict(
  _linkId: string,
  liveState: LinkLiveState,
): CongestionPrediction {
  const { load_ratio, status } = liveState;

  const saturated =
    status === "saturated" || load_ratio >= saturation_load_ratio;

  if (saturated) {
    return { penalty_ms: Number.POSITIVE_INFINITY, saturated: true };
  }

  if (load_ratio < congestion_onset_ratio) {
    return { penalty_ms: 0, saturated: false };
  }

  const span = saturation_load_ratio - congestion_onset_ratio;
  const t = clamp01((load_ratio - congestion_onset_ratio) / span);
  const penalty_ms = congestion_scale_ms * t ** congestion_exponent;

  return { penalty_ms, saturated: false };
}

/** Expected total latency at this load (baseline + congestion penalty). */
export function expectedLatencyMs(
  linkId: string,
  liveState: LinkLiveState,
): number {
  const id = normalizeLinkId(linkId);
  const baseline = TRAINED_PARAMS.link_baselines_ms[id as keyof typeof TRAINED_PARAMS.link_baselines_ms];
  if (baseline === undefined) return Number.POSITIVE_INFINITY;

  const { penalty_ms, saturated } = predict(id, liveState);
  if (saturated) return Number.POSITIVE_INFINITY;
  return baseline + penalty_ms;
}

export const SATURATION_LOAD_RATIO = saturation_load_ratio;
