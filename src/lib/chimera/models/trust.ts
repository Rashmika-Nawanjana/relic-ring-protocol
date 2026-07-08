import type { LinkLiveState, TrustScore } from "../types";
import { normalizeLinkId } from "../link-id";
import { expectedLatencyMs } from "./congestion";
import { TRAINED_PARAMS } from "./params";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

type TrustProfile = (typeof TRAINED_PARAMS.link_trust)[keyof typeof TRAINED_PARAMS.link_trust];

/**
 * Trust score 0–1 using per-link training profiles + live lie detection.
 *
 * Spoofed links (Aegis-Elysium, Boreas-Fenix) keep near-zero trust.
 * Honest links use link-specific p95 noise thresholds to avoid false flags.
 */
export function score(linkId: string, liveState: LinkLiveState): TrustScore {
  const id = normalizeLinkId(linkId);

  if (liveState.status === "saturated" || liveState.self_reported_latency_ms === null) {
    return { trust_score: 0 };
  }

  const prof: TrustProfile | undefined =
    TRAINED_PARAMS.link_trust[id as keyof typeof TRAINED_PARAMS.link_trust];
  const prior: number = prof?.prior ?? 0.9;

  const expected = expectedLatencyMs(id, liveState);
  if (!Number.isFinite(expected) || expected <= 0) {
    return { trust_score: clamp01(prior) };
  }

  const selfReported = liveState.self_reported_latency_ms;
  const relativeGap = (expected - selfReported) / expected;

  if (TRAINED_PARAMS.spoofed_links.includes(id as (typeof TRAINED_PARAMS.spoofed_links)[number])) {
    return { trust_score: clamp01(0.05 + 0.1 * sigmoid(-relativeGap * 10)) };
  }

  const threshold = (prof?.p95_gap ?? 0.05) + 0.03;
  let trust = prior;
  if (relativeGap > threshold) {
    trust *= 1 - Math.min(0.4, (relativeGap - threshold) * 1.5);
  }

  return { trust_score: clamp01(trust) };
}

export const SPOOFED_LINKS: readonly string[] = TRAINED_PARAMS.spoofed_links;

export function isKnownSpoofedLink(linkId: string): boolean {
  return SPOOFED_LINKS.includes(normalizeLinkId(linkId));
}
