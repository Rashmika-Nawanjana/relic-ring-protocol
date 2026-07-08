import type { LinkLiveState } from "./types";
import { refreshLiveState } from "./state-cache";
import { scoreLink, isKnownSpoofedLink } from "./models";
import { loadUniverseConfig } from "@/lib/universe/load";
import { voidHopPhysicsMs } from "@/lib/copilot/cost";

export type LinkHealthStatus = "ok" | "congested" | "danger";

export type LinkPanelRow = {
  link_id: string;
  planet_a: string;
  planet_b: string;
  capacity_units: number;
  load_ratio: number;
  status: LinkLiveState["status"];
  traffic_share: number;
  predicted_congestion_penalty_ms: number;
  trust_score: number;
  targeting_risk_score: number;
  health: LinkHealthStatus;
};

export function classifyLinkHealth(
  live: LinkLiveState,
  scores: ReturnType<typeof scoreLink>,
): LinkHealthStatus {
  if (
    live.status === "saturated" ||
    live.self_reported_latency_ms === null ||
    !Number.isFinite(scores.predicted_congestion_penalty_ms)
  ) {
    return "danger";
  }
  if (
    scores.trust_score < 0.2 ||
    isKnownSpoofedLink(live.link_id)
  ) {
    return "danger";
  }
  if (
    live.load_ratio >= 0.5 ||
    scores.predicted_congestion_penalty_ms > 50_000 ||
    scores.targeting_risk_score > 0.5
  ) {
    return "congested";
  }
  return "ok";
}

export async function buildChimeraPanelData(): Promise<{
  tick: number;
  links: LinkPanelRow[];
}> {
  const config = loadUniverseConfig();
  const { tick, links: liveMap } = await refreshLiveState(true);
  const capacityByLink = new Map(
    (config.interplanetary_links ?? []).map((l) => [l.link_id, l.capacity_units]),
  );

  const rows: LinkPanelRow[] = [];
  for (const [linkId, live] of liveMap) {
    const physics = voidHopPhysicsMs(config, live.planet_a, live.planet_b);
    const scores = scoreLink(linkId, live);
    rows.push({
      link_id: linkId,
      planet_a: live.planet_a,
      planet_b: live.planet_b,
      capacity_units: capacityByLink.get(linkId) ?? live.capacity_units,
      load_ratio: live.load_ratio,
      status: live.status,
      traffic_share: live.traffic_share,
      predicted_congestion_penalty_ms: scores.predicted_congestion_penalty_ms,
      trust_score: scores.trust_score,
      targeting_risk_score: scores.targeting_risk_score,
      health: classifyLinkHealth(live, scores),
    });
  }

  rows.sort((a, b) => a.link_id.localeCompare(b.link_id));
  return { tick, links: rows };
}
