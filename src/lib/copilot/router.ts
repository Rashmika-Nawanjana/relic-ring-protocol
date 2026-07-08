import type { LinkLiveState, TrafficHistory } from "@/lib/chimera/types";
import { canonicalLinkId } from "@/lib/chimera/link-id";
import { voidDistanceKm } from "@/lib/universe/geometry";
import { departureLegMs, destinationReceiveMs } from "@/lib/universe/physics";
import type { UniverseConfig } from "@/lib/universe/types";
import { voidEdgeKey } from "@/lib/universe/router";
import {
  chimeraSurchargeMs,
  isLinkUnsafe,
  linkIdForHop,
  voidHopPhysicsMs,
} from "./cost";
import { evaluateLink } from "./tools";

type PrevState = { at: string; fromPrev: string | null };

export type ChimeraRouteOptions = {
  killed?: Set<string>;
  killedLinks?: Set<string>;
  excludedLinks?: Set<string>;
  trafficHistory?: TrafficHistory;
  liveStates: Map<string, LinkLiveState>;
};

function buildAdjacency(
  config: UniverseConfig,
  options: ChimeraRouteOptions,
): Map<string, { to: string }[]> {
  const { killed = new Set(), killedLinks = new Set(), excludedLinks = new Set() } =
    options;
  const { nodes, universe_metadata: meta } = config;
  const scale = meta.coordinate_scale_unit_km;
  const adj = new Map<string, { to: string }[]>();

  for (const node of nodes) {
    if (!killed.has(node.id)) adj.set(node.id, []);
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (killed.has(a.id) || killed.has(b.id)) continue;

      const key = voidEdgeKey(a.id, b.id);
      if (killedLinks.has(key) || excludedLinks.has(key)) continue;

      const L = voidDistanceKm(a, b, scale);
      if (L <= 0 || L > meta.max_void_hop_distance_km) continue;

      const live = options.liveStates.get(key);
      const voidPhysics = voidHopPhysicsMs(config, a.id, b.id);
      if (isLinkUnsafe(key, live, voidPhysics, options.trafficHistory)) continue;

      adj.get(a.id)!.push({ to: b.id });
      adj.get(b.id)!.push({ to: a.id });
    }
  }

  return adj;
}

function legWeight(
  config: UniverseConfig,
  from: string,
  to: string,
  prev: string | null,
  options: ChimeraRouteOptions,
): number {
  const meta = config.universe_metadata;
  const scale = meta.coordinate_scale_unit_km;
  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
  const linkId = linkIdForHop(from, to);
  const live = options.liveStates.get(linkId);
  if (!live) return Number.POSITIVE_INFINITY;
  const voidPhysics = voidHopPhysicsMs(config, from, to);
  const physicsLeg = departureLegMs(from, to, prev, nodeMap, meta, scale);
  const surcharge = chimeraSurchargeMs(
    linkId,
    live,
    voidPhysics,
    options.trafficHistory,
  );
  if (!Number.isFinite(surcharge)) return Number.POSITIVE_INFINITY;
  return physicsLeg + surcharge;
}

/** Dijkstra with Phase 1 path-dependent fiber + Chimera surcharges on void hops. */
export function findChimeraRoute(
  config: UniverseConfig,
  origin: string,
  destination: string,
  options: ChimeraRouteOptions,
): string[] | null {
  const meta = config.universe_metadata;
  const scale = meta.coordinate_scale_unit_km;
  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
  const adj = buildAdjacency(config, options);

  const dist = new Map<string, number>();
  const parent = new Map<string, PrevState>();
  const visited = new Set<string>();
  const stateKey = (at: string, prev: string | null) => `${at}|${prev ?? "∅"}`;

  dist.set(stateKey(origin, null), 0);
  parent.set(stateKey(origin, null), { at: origin, fromPrev: null });

  while (visited.size < dist.size) {
    let bestKey: string | null = null;
    let best = Infinity;
    for (const [key, d] of dist) {
      if (!visited.has(key) && d < best) {
        best = d;
        bestKey = key;
      }
    }
    if (bestKey === null || best === Infinity) break;
    visited.add(bestKey);

    const [at, prevStr] = bestKey.split("|");
    const prev = prevStr === "∅" ? null : prevStr;
    if (at === destination) continue;

    for (const { to } of adj.get(at) ?? []) {
      const leg = legWeight(config, at, to, prev, options);
      if (!Number.isFinite(leg)) continue;
      const nextKey = stateKey(to, at);
      const alt = best + leg;
      if (alt < (dist.get(nextKey) ?? Infinity)) {
        dist.set(nextKey, alt);
        parent.set(nextKey, { at, fromPrev: prev });
      }
    }
  }

  let bestTotal = Infinity;
  let bestArrivalKey: string | null = null;
  for (const [key, d] of dist) {
    const [at, prevStr] = key.split("|");
    if (at !== destination) continue;
    const prev = prevStr === "∅" ? null : prevStr;
    if (prev === null) continue;
    const receive = destinationReceiveMs(prev, destination, nodeMap, meta, scale);
    const total = d + receive;
    if (total < bestTotal) {
      bestTotal = total;
      bestArrivalKey = key;
    }
  }

  if (bestArrivalKey === null) return null;

  const path: string[] = [destination];
  let key = bestArrivalKey;
  while (true) {
    const state = parent.get(key);
    if (!state || state.at === origin) {
      path.unshift(origin);
      break;
    }
    path.unshift(state.at);
    key = stateKey(state.at, state.fromPrev);
  }

  return path;
}

export function buildLinkEvaluations(
  config: UniverseConfig,
  path: string[],
  liveStates: Map<string, LinkLiveState>,
  trafficHistory: TrafficHistory = [],
) {
  const rows = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const linkId = canonicalLinkId(a, b);
    const live = liveStates.get(linkId);
    const physics = voidHopPhysicsMs(config, a, b);
    if (!live) {
      rows.push({
        link_id: linkId,
        predicted_congestion_penalty_ms: Number.POSITIVE_INFINITY,
        trust_score: 0,
        targeting_risk_score: 1,
        combined_cost: Number.POSITIVE_INFINITY,
      });
      continue;
    }
    rows.push(evaluateLink(linkId, live, physics, trafficHistory));
  }
  return rows;
}

export function estimatePathLatencyMs(
  evaluations: { combined_cost: number }[],
): number {
  let total = 0;
  for (const row of evaluations) {
    if (!Number.isFinite(row.combined_cost)) return Number.POSITIVE_INFINITY;
    total += row.combined_cost;
  }
  return total;
}
