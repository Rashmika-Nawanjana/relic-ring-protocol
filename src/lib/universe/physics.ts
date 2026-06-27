import type { LatencyComponents, PlanetNode, UniverseMetadata } from "./types";
import { voidDistanceKm } from "./geometry";

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

export function crustTransitTimeMs(
  planet: PlanetNode,
  meta: UniverseMetadata,
  segments = 1,
): LatencyComponents {
  const N = planet.active_towers;
  const s = Math.min(segments, N - 1);
  const m = s === 0 ? 1 : s + 1;
  const c = meta.speed_of_light_kms;
  const f = meta.fiber_speed_fraction;
  const dt = meta.tower_processing_delay_ms;

  const fiber_ms = ((2 * Math.PI * planet.radius_km * s) / (N * f * c)) * 1000;
  const towers_ms = m * dt;
  const atmosphere_ms =
    ((planet.atmosphere_thickness_km * planet.refraction_index) / c) * 1000;
  const void_ms = 0;

  return {
    fiber_ms,
    towers_ms,
    atmosphere_ms,
    void_ms,
    total_ms: fiber_ms + towers_ms + atmosphere_ms,
  };
}

export function voidHopComponents(
  a: PlanetNode,
  b: PlanetNode,
  meta: UniverseMetadata,
): LatencyComponents {
  const void_ms = voidTravelTimeMs(a, b, meta);
  return {
    fiber_ms: 0,
    towers_ms: 0,
    atmosphere_ms:
      ((a.atmosphere_thickness_km * a.refraction_index +
        b.atmosphere_thickness_km * b.refraction_index) /
        meta.speed_of_light_kms) *
      1000,
    void_ms: void_ms - ((a.atmosphere_thickness_km * a.refraction_index + b.atmosphere_thickness_km * b.refraction_index) / meta.speed_of_light_kms) * 1000,
    total_ms: void_ms,
  };
}
