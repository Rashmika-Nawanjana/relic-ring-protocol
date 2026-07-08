/**
 * Unseen-vector guard: validate live /state data against the trained input
 * domain. Links reporting values outside what the models were trained on are
 * flagged and treated as unavailable rather than silently mis-scored.
 */
import type { LinkLiveState } from "./types";
import type { UniverseConfig } from "@/lib/universe/types";

export type LiveAnomaly = {
  link_id: string;
  reason: string;
};

const VALID_STATUSES = new Set(["ok", "saturated"]);

function isBadNumber(value: unknown): boolean {
  return typeof value !== "number" || !Number.isFinite(value);
}

/**
 * Returns per-link anomalies plus network-wide anomalies (empty link_id).
 * Any link listed here must be routed around, not trusted.
 */
export function detectLiveAnomalies(
  liveStates: Map<string, LinkLiveState>,
  config: UniverseConfig,
): LiveAnomaly[] {
  const anomalies: LiveAnomaly[] = [];
  const knownLinks = new Set(
    (config.interplanetary_links ?? []).map((l) => l.link_id),
  );

  for (const [linkId, live] of liveStates) {
    if (knownLinks.size > 0 && !knownLinks.has(linkId)) {
      anomalies.push({
        link_id: linkId,
        reason: `Unknown link "${linkId}" not present in universe config`,
      });
      continue;
    }

    if (isBadNumber(live.load_ratio) || live.load_ratio < 0 || live.load_ratio > 1.05) {
      anomalies.push({
        link_id: linkId,
        reason: `load_ratio ${String(live.load_ratio)} outside trained range [0, 1]`,
      });
      continue;
    }

    if (
      live.self_reported_latency_ms !== null &&
      (isBadNumber(live.self_reported_latency_ms) || live.self_reported_latency_ms < 0)
    ) {
      anomalies.push({
        link_id: linkId,
        reason: `self_reported_latency_ms ${String(live.self_reported_latency_ms)} is negative or non-numeric`,
      });
      continue;
    }

    if (isBadNumber(live.traffic_share) || live.traffic_share < 0 || live.traffic_share > 1) {
      anomalies.push({
        link_id: linkId,
        reason: `traffic_share ${String(live.traffic_share)} outside [0, 1]`,
      });
      continue;
    }

    if (!VALID_STATUSES.has(live.status)) {
      anomalies.push({
        link_id: linkId,
        reason: `Unrecognized status "${String(live.status)}" (expected ok|saturated)`,
      });
    }
  }

  for (const linkId of knownLinks) {
    if (!liveStates.has(linkId)) {
      anomalies.push({
        link_id: linkId,
        reason: `No live telemetry for ${linkId} this tick — treated as unavailable`,
      });
    }
  }

  return anomalies;
}
