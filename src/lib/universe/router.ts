import type {
  HopLogEntry,
  LatencyComponents,
  PlanetNode,
  RouteResult,
  UniverseConfig,
} from "./types";
import { voidDistanceKm } from "./geometry";
import { buildPlanetTowerRoutes } from "./packet-path";
import { crustTransitTimeMs, voidTravelTimeMs } from "./physics";
import { encodePayloadAscii } from "./codec";

function buildAdjacency(
  config: UniverseConfig,
  killed: Set<string>,
): Map<string, { to: string; weight: number }[]> {
  const { nodes, universe_metadata: meta } = config;
  const adj = new Map<string, { to: string; weight: number }[]>();

  for (const node of nodes) {
    if (!killed.has(node.id)) adj.set(node.id, []);
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (killed.has(a.id) || killed.has(b.id)) continue;

      const L = voidDistanceKm(a, b, meta.coordinate_scale_unit_km);
      if (L <= 0 || L > meta.max_void_hop_distance_km) continue;

      const weight = voidTravelTimeMs(a, b, meta);
      adj.get(a.id)!.push({ to: b.id, weight });
      adj.get(b.id)!.push({ to: a.id, weight });
    }
  }

  return adj;
}

function dijkstra(
  adj: Map<string, { to: string; weight: number }[]>,
  origin: string,
  destination: string,
): string[] | null {
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const id of adj.keys()) {
    dist.set(id, Infinity);
    prev.set(id, null);
  }
  dist.set(origin, 0);

  while (visited.size < adj.size) {
    let u: string | null = null;
    let best = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < best) {
        best = d;
        u = id;
      }
    }
    if (u === null || best === Infinity) break;
    if (u === destination) break;
    visited.add(u);

    for (const { to, weight } of adj.get(u) ?? []) {
      const alt = best + weight;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, u);
      }
    }
  }

  if ((dist.get(destination) ?? Infinity) === Infinity) return null;

  const path: string[] = [];
  let cur: string | null = destination;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur) ?? null;
  }
  return path;
}

export function findRoute(
  config: UniverseConfig,
  origin: string,
  destination: string,
  killed: Set<string> = new Set(),
  message = "Hello world",
): RouteResult {
  if (origin === destination) {
    return { ok: false, error: "Origin and destination must differ." };
  }
  if (killed.has(origin) || killed.has(destination)) {
    return { ok: false, error: "Origin or destination planet is offline." };
  }

  const adj = buildAdjacency(config, killed);
  const route = dijkstra(adj, origin, destination);
  if (!route) {
    return { ok: false, error: "Undeliverable — no route within Lmax constraints." };
  }

  const meta = config.universe_metadata;
  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
  const towerRoutes = buildPlanetTowerRoutes(route, nodeMap, meta.coordinate_scale_unit_km);
  const hops: HopLogEntry[] = [];
  const perHop: LatencyComponents[] = [];
  let total = 0;

  for (let i = 0; i < route.length; i++) {
    const planetId = route[i];
    const planet = nodeMap.get(planetId)!;
    const tr = towerRoutes[i];
    const internal = crustTransitTimeMs(planet, meta, tr.segments);
    perHop.push(internal);
    total += internal.total_ms;

    const nextPlanet = route[i + 1];
    const encodingPlanet = nextPlanet ? nodeMap.get(nextPlanet)! : planet;
    const encoding = encodePayloadAscii(message, encodingPlanet.codex);
    const encodingBase = encodingPlanet.codex;

    for (let t = 0; t < tr.viaTowers.length; t++) {
      const towerIdx = tr.viaTowers[t];
      const isLastTower = t === tr.viaTowers.length - 1;
      const isFinalPlanet = i === route.length - 1;

      let action: HopLogEntry["action"];
      if (isFinalPlanet && isLastTower) action = "receive";
      else if (!isFinalPlanet && isLastTower) action = "send";
      else action = "transit";

      hops.push({
        planet: planetId,
        tower: `T_${towerIdx}`,
        action,
        latency_ms: t === 0 ? internal.total_ms : 0,
        encoding: isLastTower ? encoding : undefined,
        encoding_base: isLastTower ? encodingBase : undefined,
        components: t === 0 ? internal : undefined,
      });
    }

    if (nextPlanet) {
      const next = nodeMap.get(nextPlanet)!;
      const voidMs = voidTravelTimeMs(planet, next, meta);
      const voidComponents: LatencyComponents = {
        fiber_ms: 0,
        towers_ms: 0,
        atmosphere_ms: 0,
        void_ms: voidMs,
        total_ms: voidMs,
      };
      perHop.push(voidComponents);
      total += voidMs;
    }
  }

  return {
    ok: true,
    message,
    route,
    total_latency_ms: total,
    hops,
    per_hop_latency: perHop,
    tower_routes: towerRoutes,
  };
}

export function buildVoidEdges(config: UniverseConfig, killed: Set<string>): {
  from: string;
  to: string;
  voidDistanceKm: number;
  valid: boolean;
}[] {
  const meta = config.universe_metadata;
  const edges: { from: string; to: string; voidDistanceKm: number; valid: boolean }[] = [];

  for (let i = 0; i < config.nodes.length; i++) {
    for (let j = i + 1; j < config.nodes.length; j++) {
      const a = config.nodes[i];
      const b = config.nodes[j];
      const L = voidDistanceKm(a, b, meta.coordinate_scale_unit_km);
      const valid =
        !killed.has(a.id) &&
        !killed.has(b.id) &&
        L > 0 &&
        L <= meta.max_void_hop_distance_km;
      edges.push({ from: a.id, to: b.id, voidDistanceKm: L, valid });
    }
  }
  return edges;
}

export function getNodeMap(config: UniverseConfig): Map<string, PlanetNode> {
  return new Map(config.nodes.map((n) => [n.id, n]));
}
