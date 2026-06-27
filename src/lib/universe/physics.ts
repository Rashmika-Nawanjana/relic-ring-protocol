import type { PlanetNode, UniverseMetadata } from "./types";
import { voidDistanceKm } from "./geometry";
import { buildPlanetTowerRoutes } from "./packet-path";

export function voidTravelTimeMs(
  a: PlanetNode,
  b: PlanetNode,
  meta: UniverseMetadata,
): number {
  const L = voidDistanceKm(a, b, meta.coordinate_scale_unit_km);
  if (L <= 0) return Infinity;
  const c = meta.speed_of_light_kms;
  const numerator =
    a.atmosphere_thickness_km * a.refraction_index +
    b.atmosphere_thickness_km * b.refraction_index +
    L;
  return (numerator / c) * 1000;
}

/** Internal crust transit (fiber + towers only — atmosphere is in Tv). */
export function crustTransitTimeMs(
  planet: PlanetNode,
  meta: UniverseMetadata,
  segments = 1,
): import("./types").LatencyComponents {
  const N = planet.active_towers;
  const s = Math.min(segments, N - 1);
  const m = s === 0 ? 1 : s + 1;
  const c = meta.speed_of_light_kms;
  const f = meta.fiber_speed_fraction;
  const dt = meta.tower_processing_delay_ms;

  const fiber_ms = ((2 * Math.PI * planet.radius_km * s) / (N * f * c)) * 1000;
  const towers_ms = m * dt;
  const void_ms = 0;

  return {
    fiber_ms,
    towers_ms,
    atmosphere_ms: 0,
    void_ms,
    total_ms: fiber_ms + towers_ms,
  };
}

/** Split Tv into atmosphere + pure void for per-hop breakdown display. */
export function voidHopComponents(
  a: PlanetNode,
  b: PlanetNode,
  meta: UniverseMetadata,
): import("./types").LatencyComponents {
  const c = meta.speed_of_light_kms;
  const atmosphere_ms =
    ((a.atmosphere_thickness_km * a.refraction_index +
      b.atmosphere_thickness_km * b.refraction_index) /
      c) *
    1000;
  const void_ms = voidTravelTimeMs(a, b, meta) - atmosphere_ms;
  return {
    fiber_ms: 0,
    towers_ms: 0,
    atmosphere_ms,
    void_ms,
    total_ms: atmosphere_ms + void_ms,
  };
}

/** Tp for a planet on a mini-route [prev?, planet, next?]. */
export function planetTransitMs(
  miniRoute: string[],
  planetIndex: number,
  nodeMap: Map<string, PlanetNode>,
  meta: UniverseMetadata,
  scale: number,
): number {
  const towerRoutes = buildPlanetTowerRoutes(miniRoute, nodeMap, scale);
  const planet = nodeMap.get(miniRoute[planetIndex])!;
  return crustTransitTimeMs(
    planet,
    meta,
    towerRoutes[planetIndex].segments,
  ).total_ms;
}

/** Cost to leave `from` toward `to`, having arrived from `prev` (null at origin). */
export function departureLegMs(
  from: string,
  to: string,
  prev: string | null,
  nodeMap: Map<string, PlanetNode>,
  meta: UniverseMetadata,
  scale: number,
): number {
  const a = nodeMap.get(from)!;
  const b = nodeMap.get(to)!;
  const miniRoute =
    prev === null ? [from, to] : [prev, from, to];
  const idx = prev === null ? 0 : 1;
  return planetTransitMs(miniRoute, idx, nodeMap, meta, scale) + voidTravelTimeMs(a, b, meta);
}

/** Receive-only Tp on destination after void hop from `from`. */
export function destinationReceiveMs(
  from: string,
  to: string,
  nodeMap: Map<string, PlanetNode>,
  meta: UniverseMetadata,
  scale: number,
): number {
  return planetTransitMs([from, to], 1, nodeMap, meta, scale);
}
