export {
  combineCosts,
  DEFAULT_COST_WEIGHTS,
  type CostWeights,
} from "@/lib/chimera/models/cost";

import type { LinkLiveState, TrafficHistory } from "@/lib/chimera/types";
import { canonicalLinkId } from "@/lib/chimera/link-id";
import { combineCosts, DEFAULT_COST_WEIGHTS } from "@/lib/chimera/models/cost";
import { scoreLink } from "@/lib/chimera/models";
import { voidTravelTimeMs } from "@/lib/universe/physics";
import type { UniverseConfig } from "@/lib/universe/types";

const TRUST_UNSAFE_THRESHOLD = 0.2;

/** Phase 1 void-hop physics between two planets (km/s propagation). */
export function voidHopPhysicsMs(
  config: UniverseConfig,
  planetA: string,
  planetB: string,
): number {
  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
  const a = nodeMap.get(planetA);
  const b = nodeMap.get(planetB);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return voidTravelTimeMs(a, b, config.universe_metadata);
}

/** Chimera surcharge on top of void physics (congestion + trust + targeting). */
export function chimeraSurchargeMs(
  linkId: string,
  liveState: LinkLiveState,
  voidPhysicsMs: number,
  history: TrafficHistory = [],
): number {
  const scores = scoreLink(linkId, liveState, history);
  const combined = combineCosts(voidPhysicsMs, scores, DEFAULT_COST_WEIGHTS);
  if (!Number.isFinite(combined)) return Number.POSITIVE_INFINITY;
  return Math.max(0, combined - voidPhysicsMs);
}

export function isLinkUnsafe(
  linkId: string,
  liveState: LinkLiveState | undefined,
  voidPhysicsMs: number,
  history: TrafficHistory = [],
): boolean {
  if (!liveState) return true;
  if (liveState.status === "saturated" || liveState.self_reported_latency_ms === null) {
    return true;
  }
  const scores = scoreLink(linkId, liveState, history);
  if (!Number.isFinite(scores.predicted_congestion_penalty_ms)) return true;
  if (scores.trust_score < TRUST_UNSAFE_THRESHOLD) return true;
  const combined = combineCosts(voidPhysicsMs, scores, DEFAULT_COST_WEIGHTS);
  return !Number.isFinite(combined);
}

export function linkIdForHop(planetA: string, planetB: string): string {
  return canonicalLinkId(planetA, planetB);
}
