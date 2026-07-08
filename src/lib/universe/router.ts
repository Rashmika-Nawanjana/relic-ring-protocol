import type {
  HopLogEntry,
  LatencyComponents,
  Packet,
  PlanetNode,
  RouteResult,
  UniverseConfig,
} from "./types";
import { voidDistanceKm } from "./geometry";
import { buildPlanetTowerRoutes } from "./packet-path";
import {
  crustTransitTimeMs,
  departureLegMs,
  destinationReceiveMs,
  voidHopComponents,
  voidTravelTimeMs,
} from "./physics";
import { encodePayloadAscii } from "./codec";

export function voidEdgeKey(a: string, b: string): string {
  return [a, b].sort().join("-");
}

function buildAdjacency(
  config: UniverseConfig,
  killed: Set<string>,
  killedLinks: Set<string>,
): Map<string, { to: string; weight: number }[]> {
  const { nodes, universe_metadata: meta } = config;
  const scale = meta.coordinate_scale_unit_km;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<string, { to: string; weight: number }[]>();

  for (const node of nodes) {
    if (!killed.has(node.id)) adj.set(node.id, []);
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (killed.has(a.id) || killed.has(b.id)) continue;
      if (killedLinks.has(voidEdgeKey(a.id, b.id))) continue;

      const L = voidDistanceKm(a, b, scale);
      if (L <= 0 || L > meta.max_void_hop_distance_km) continue;

      const weight = departureLegMs(a.id, b.id, null, nodeMap, meta, scale);
      adj.get(a.id)!.push({ to: b.id, weight });
      adj.get(b.id)!.push({ to: a.id, weight });
    }
  }

  return adj;
}

type PrevState = { at: string; fromPrev: string | null };

/** Lowest-latency routing with path-dependent Tp via (planet, previous) state. */
function dijkstraLatency(
  config: UniverseConfig,
  adj: Map<string, { to: string }[]>,
  origin: string,
  destination: string,
): string[] | null {
  const meta = config.universe_metadata;
  const scale = meta.coordinate_scale_unit_km;
  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));

  const dist = new Map<string, number>();
  const parent = new Map<string, PrevState>();
  const visited = new Set<string>();

  const stateKey = (at: string, prev: string | null) =>
    `${at}|${prev ?? "∅"}`;

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
      const leg = departureLegMs(at, to, prev, nodeMap, meta, scale);
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

function buildPacket(
  origin: string,
  destination: string,
  route: string[],
  hops: HopLogEntry[],
  message: string,
  total_latency_ms: number,
): Packet {
  const encodingHops = hops.filter((h) => h.encoding);
  const lastEncoding = encodingHops[encodingHops.length - 1];
  return {
    origin_id: origin,
    destination_id: destination,
    current_id: destination,
    payload: lastEncoding?.encoding ?? encodePayloadAscii(message, 10),
    hop_log: hops,
    route,
    total_latency_ms,
  };
}

function buildRouteResult(
  config: UniverseConfig,
  route: string[],
  origin: string,
  destination: string,
  message: string,
): RouteResult {
  const meta = config.universe_metadata;
  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
  const scale = meta.coordinate_scale_unit_km;
  const towerRoutes = buildPlanetTowerRoutes(route, nodeMap, scale);
  const hops: HopLogEntry[] = [];
  const perHop: (LatencyComponents & { label: string })[] = [];
  let total = 0;

  for (let i = 0; i < route.length; i++) {
    const planetId = route[i];
    const planet = nodeMap.get(planetId)!;
    const tr = towerRoutes[i];
    const internal = crustTransitTimeMs(planet, meta, tr.segments);
    perHop.push({ ...internal, label: planetId });
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
      const voidComponents = voidHopComponents(planet, next, meta);
      perHop.push({
        ...voidComponents,
        label: `${planetId} → ${nextPlanet}`,
      });
      total += voidComponents.total_ms;
    }
  }

  const packet = buildPacket(origin, destination, route, hops, message, total);

  return {
    ok: true,
    message,
    route,
    total_latency_ms: total,
    hops,
    per_hop_latency: perHop,
    tower_routes: towerRoutes,
    packet,
  };
}

function validateFixedRoute(
  config: UniverseConfig,
  route: string[],
  origin: string,
  destination: string,
  killed: Set<string>,
  killedLinks: Set<string>,
): string | null {
  if (route.length < 2) return "Route must include at least two planets";
  if (route[0] !== origin || route[route.length - 1] !== destination) {
    return "Route must start at origin and end at destination";
  }
  const meta = config.universe_metadata;
  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
  for (const id of route) {
    if (!nodeMap.has(id)) return `Unknown planet in route: ${id}`;
    if (killed.has(id)) return `Planet offline on route: ${id}`;
  }
  for (let i = 0; i < route.length - 1; i++) {
    const a = nodeMap.get(route[i]!)!;
    const b = nodeMap.get(route[i + 1]!)!;
    const key = voidEdgeKey(a.id, b.id);
    if (killedLinks.has(key)) return `Void link severed: ${key}`;
    const L = voidDistanceKm(a, b, meta.coordinate_scale_unit_km);
    if (L <= 0 || L > meta.max_void_hop_distance_km) {
      return `Hop ${key} exceeds Lmax`;
    }
  }
  return null;
}

/** Build hop log and packet for a predetermined planet path (CoPilot chosen_path). */
export function traceFixedRoute(
  config: UniverseConfig,
  route: string[],
  message = "Hello world",
  killed: Set<string> = new Set(),
  killedLinks: Set<string> = new Set(),
): RouteResult {
  if (route.length < 2) {
    return { ok: false, error: "Route must include at least two planets" };
  }
  const origin = route[0]!;
  const destination = route[route.length - 1]!;
  const err = validateFixedRoute(
    config,
    route,
    origin,
    destination,
    killed,
    killedLinks,
  );
  if (err) return { ok: false, error: err };
  return buildRouteResult(config, route, origin, destination, message);
}

export function findRoute(
  config: UniverseConfig,
  origin: string,
  destination: string,
  killed: Set<string> = new Set(),
  message = "Hello world",
  killedLinks: Set<string> = new Set(),
): RouteResult {
  if (origin === destination) {
    return { ok: false, error: "Origin and destination must differ." };
  }
  if (killed.has(origin) || killed.has(destination)) {
    return { ok: false, error: "Origin or destination planet is offline." };
  }

  const adj = buildAdjacency(config, killed, killedLinks);
  const route = dijkstraLatency(config, adj, origin, destination);
  if (!route) {
    return { ok: false, error: "Undeliverable — no route within Lmax constraints." };
  }

  return buildRouteResult(config, route, origin, destination, message);
}

export function buildVoidEdges(
  config: UniverseConfig,
  killed: Set<string>,
  killedLinks: Set<string> = new Set(),
): {
  from: string;
  to: string;
  voidDistanceKm: number;
  valid: boolean;
  key: string;
}[] {
  const meta = config.universe_metadata;
  const edges: {
    from: string;
    to: string;
    voidDistanceKm: number;
    valid: boolean;
    key: string;
  }[] = [];

  const pairs =
    config.interplanetary_links?.map((l) => [l.planet_a, l.planet_b] as const) ??
    config.nodes.flatMap((a, i) =>
      config.nodes.slice(i + 1).map((b) => [a.id, b.id] as const),
    );

  for (const [from, to] of pairs) {
    const a = config.nodes.find((n) => n.id === from);
    const b = config.nodes.find((n) => n.id === to);
    if (!a || !b) continue;
    const key = voidEdgeKey(a.id, b.id);
    const L = voidDistanceKm(a, b, meta.coordinate_scale_unit_km);
    const valid =
      !killed.has(a.id) &&
      !killed.has(b.id) &&
      !killedLinks.has(key) &&
      L > 0 &&
      L <= meta.max_void_hop_distance_km;
    edges.push({ from: a.id, to: b.id, voidDistanceKm: L, valid, key });
  }
  return edges;
}

export function getNodeMap(config: UniverseConfig): Map<string, PlanetNode> {
  return new Map(config.nodes.map((n) => [n.id, n]));
}

export function listValidVoidLinks(config: UniverseConfig): { key: string; from: string; to: string }[] {
  return buildVoidEdges(config, new Set(), new Set())
    .filter((e) => e.valid)
    .map((e) => ({ key: e.key, from: e.from, to: e.to }));
}
