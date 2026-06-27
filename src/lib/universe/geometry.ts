import type { PlanetNode, ScenePlanet, TowerPosition, UniverseConfig } from "./types";

const PLANET_COLORS: Record<string, string> = {
  Aegis: "#6366f1",
  Boreas: "#38bdf8",
  Dawn: "#fbbf24",
  Elysium: "#34d399",
  Fenix: "#f87171",
  Caelum: "#c084fc",
};

/** Map config coordinates to 3D scene units (XZ plane, Y-up). */
const POSITION_SCALE = 0.018;
const RADIUS_SCALE = 0.00035;
const MIN_ORBIT_FROM_SUN = 2.8;

export function visualRadius(radiusKm: number): number {
  return Math.max(0.15, Math.pow(radiusKm, 0.45) * RADIUS_SCALE);
}

export function planetOrbitRadius(node: PlanetNode): number {
  const d = Math.hypot(node.x, node.y) * POSITION_SCALE;
  return Math.max(MIN_ORBIT_FROM_SUN, d);
}

export function planetScenePosition(node: PlanetNode): [number, number, number] {
  const r = planetOrbitRadius(node);
  if (node.x === 0 && node.y === 0) {
    return [r, 0, 0];
  }
  const angle = Math.atan2(-node.y, node.x);
  return [r * Math.cos(angle), 0, r * Math.sin(angle)];
}

export function centerDistanceKm(a: PlanetNode, b: PlanetNode, scale: number): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy) * scale;
}

/** Void distance L per Equations.md / image2. */
export function voidDistanceKm(
  a: PlanetNode,
  b: PlanetNode,
  scale: number,
): number {
  const center = centerDistanceKm(a, b, scale);
  return (
    center - (a.radius_km + a.atmosphere_thickness_km) - (b.radius_km + b.atmosphere_thickness_km)
  );
}

/** Tower angle: clockwise from +Z (12 o'clock), on equator. */
export function towerAngleRad(index: number, total: number): number {
  return -index * ((Math.PI * 2) / total);
}

export function towerLocalPosition(
  index: number,
  total: number,
  surfaceRadius: number,
): [number, number, number] {
  const angle = towerAngleRad(index, total);
  return [
    Math.sin(angle) * surfaceRadius,
    0,
    Math.cos(angle) * surfaceRadius,
  ];
}

export function buildTowerPositions(
  node: PlanetNode,
  worldCenter: [number, number, number],
  surfaceRadius: number,
): TowerPosition[] {
  return Array.from({ length: node.active_towers }, (_, index) => {
    const local = towerLocalPosition(index, node.active_towers, surfaceRadius);
    return {
      index,
      label: `T_${index}`,
      local,
      world: [
        worldCenter[0] + local[0],
        worldCenter[1] + local[1],
        worldCenter[2] + local[2],
      ],
    };
  });
}

export function buildScenePlanets(config: UniverseConfig): ScenePlanet[] {
  return config.nodes.map((node) => {
    const position = planetScenePosition(node);
    const visualR = visualRadius(node.radius_km);
    const atmosphereR = visualR * (1 + node.atmosphere_thickness_km / node.radius_km);
    return {
      node,
      position,
      visualRadius: visualR,
      atmosphereRadius: atmosphereR,
      color: PLANET_COLORS[node.id] ?? "#94a3b8",
      towers: buildTowerPositions(node, position, visualR * 1.02),
    };
  });
}

export function getPlanetById(config: UniverseConfig, id: string): PlanetNode | undefined {
  return config.nodes.find((n) => n.id === id);
}
