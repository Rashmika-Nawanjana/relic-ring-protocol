import type { LinkLiveState, TrustScore } from "../types";
import { normalizeLinkId } from "../link-id";
import { expectedLatencyMs } from "./congestion";
import { TRAINED_PARAMS } from "./params";

const { live_lie_gap_threshold, honest_noise_p95, live_lie_penalty_mult } = TRAINED_PARAMS;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Trust score 0–1 from self-reported telemetry vs load-implied latency.
 *
 * Training isolated Aegis-Elysium and Boreas-Fenix as systematic spoofers
 * (self-reported ≈30–70% below measured). Honest links stay within ~5% p95 noise.
 */
export function score(linkId: string, liveState: LinkLiveState): TrustScore {
  const id = normalizeLinkId(linkId);

  if (liveState.status === "saturated" || liveState.self_reported_latency_ms === null) {
    return { trust_score: 0 };
  }

  const prior: number =
    TRAINED_PARAMS.link_trust_priors[id as keyof typeof TRAINED_PARAMS.link_trust_priors] ??
    0.9;

  const expected = expectedLatencyMs(id, liveState);
  if (!Number.isFinite(expected) || expected <= 0) {
    return { trust_score: clamp01(prior) };
  }

  const selfReported = liveState.self_reported_latency_ms;
  const relativeGap = (expected - selfReported) / expected;

  let trust = prior;

  // Live lie detection: self reports much faster than load implies
  if (relativeGap > live_lie_gap_threshold) {
    const liePenalty = Math.min(0.85, (relativeGap - live_lie_gap_threshold) * live_lie_penalty_mult);
    trust *= 1 - liePenalty;
  }

  // Small upward noise (self slightly higher than measured) is normal
  if (relativeGap < -honest_noise_p95) {
    trust = Math.min(1, trust * 1.02);
  }

  return { trust_score: clamp01(trust) };
}

export const SPOOFED_LINKS: readonly string[] = TRAINED_PARAMS.spoofed_links;

export function isKnownSpoofedLink(linkId: string): boolean {
  return SPOOFED_LINKS.includes(normalizeLinkId(linkId));
}
