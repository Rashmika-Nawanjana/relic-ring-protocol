/**
 * Agent tool surface for Person 2 CoPilot — wraps Person 1 models.
 * Each tool matches the sequential evaluation loop in phase2.md.
 */
import type { LinkLiveState, TrafficHistory } from "../types";
import { normalizeLinkId } from "../link-id";
import { predict as predictCongestion } from "./congestion";
import { score as scoreTrust } from "./trust";
import { risk as targetingRisk } from "./targeting";

export type CongestionToolResult = ReturnType<typeof predictCongestion>;
export type TrustToolResult = ReturnType<typeof scoreTrust>;
export type TargetingToolResult = ReturnType<typeof targetingRisk>;

/** Tool 1: predict Chimera congestion penalty from live /state row. */
export function congestionTool(
  linkId: string,
  liveState: LinkLiveState,
): CongestionToolResult {
  return predictCongestion(normalizeLinkId(linkId), liveState);
}

/** Tool 2: score telemetry trust from self-reported vs load-implied latency. */
export function trustTool(linkId: string, liveState: LinkLiveState): TrustToolResult {
  return scoreTrust(normalizeLinkId(linkId), liveState);
}

/** Tool 3: estimate targeting risk from traffic_share and route history. */
export function targetingTool(
  linkId: string,
  liveState: LinkLiveState,
  ourTrafficHistory?: TrafficHistory,
): TargetingToolResult {
  return targetingRisk(normalizeLinkId(linkId), liveState, ourTrafficHistory);
}

/** All three tools in one call (per-hop agent step). */
export function runDiagnosticTools(
  linkId: string,
  liveState: LinkLiveState,
  ourTrafficHistory?: TrafficHistory,
): {
  congestion: CongestionToolResult;
  trust: TrustToolResult;
  targeting: TargetingToolResult;
} {
  const id = normalizeLinkId(linkId);
  return {
    congestion: congestionTool(id, liveState),
    trust: trustTool(id, liveState),
    targeting: targetingTool(id, liveState, ourTrafficHistory),
  };
}
