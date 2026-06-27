import type { PlanetNode, ScenePlanet, TowerPosition, UniverseConfig } from "./types";

const PLANET_COLORS: Record<string, string> = {
  Aegis: "#6366f1",
  Boreas: "#38bdf8",
  Dawn: "#fbbf24",
  Elysium: "#34d399",
  Fenix: "#f87171",
  Caelum: "#c084fc",
};

/** Extra palette for planets not in PLANET_COLORS — stable pick by id hash. */
const PLANET_COLOR_PALETTE = [
  "#f472b6",
  "#fb923c",
  "#facc15",
  "#a3e635",
  "#2dd4bf",
  "#22d3ee",
  "#60a5fa",
  "#818cf8",
  "#c084fc",
  "#e879f9",
  "#f87171",
  "#fb7185",
  "#fdba74",
  "#86efac",
  "#67e8f9",
  "#93c5fd",
];

function hashPlanetId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getPlanetColor(id: string): string {
  if (PLANET_COLORS[id]) return PLANET_COLORS[id];
  return PLANET_COLOR_PALETTE[hashPlanetId(id) % PLANET_COLOR_PALETTE.length];
}

/** Map config coordinates to 3D scene units (XZ plane, Y-up). */
const POSITION_SCALE = 0.021;
const MIN_ORBIT_FROM_SUN = 4.2;

/** Visual-only sizing — does not affect physics/routing math. */
export function visualRadius(radiusKm: number): number {
  const earthRef = 6371;
  const normalized = radiusKm / earthRef;
  return Math.max(0.5, Math.pow(normalized, 0.32) * 0.9);
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
      color: getPlanetColor(node.id),
      towers: buildTowerPositions(node, position, visualR * 1.02),
    };
  });
}

export function getPlanetById(config: UniverseConfig, id: string): PlanetNode | undefined {
  return config.nodes.find((n) => n.id === id);
}

/** Tower center in km on the 2D universe grid (clockwise from +y). */
export function towerKmPosition(
  planet: PlanetNode,
  towerIndex: number,
  scale: number,
): [number, number] {
  const cx = planet.x * scale;
  const cy = planet.y * scale;
  const angle = towerAngleRad(towerIndex, planet.active_towers);
  const r = planet.radius_km;
  return [cx + Math.sin(angle) * r, cy + Math.cos(angle) * r];
}

/** Closest tower pair for a void hop (send on `from`, receive on `to`). */
export function closestTowerPair(
  from: PlanetNode,
  to: PlanetNode,
  scale: number,
): { sendIdx: number; recvIdx: number } {
  let best = Infinity;
  let sendIdx = 0;
  let recvIdx = 0;

  for (let i = 0; i < from.active_towers; i++) {
    for (let j = 0; j < to.active_towers; j++) {
      const [ax, ay] = towerKmPosition(from, i, scale);
      const [bx, by] = towerKmPosition(to, j, scale);
      const d = Math.hypot(bx - ax, by - ay);
      if (d < best) {
        best = d;
        sendIdx = i;
        recvIdx = j;
      }
    }
  }

  return { sendIdx, recvIdx };
}

/** Fiber ring segments between entry and exit towers (shortest arc). */
export function fiberSegmentCount(
  entryTower: number,
  exitTower: number,
  totalTowers: number,
): number {
  if (entryTower === exitTower) return 0;
  const cw = (exitTower - entryTower + totalTowers) % totalTowers;
  const ccw = (entryTower - exitTower + totalTowers) % totalTowers;
  return Math.min(cw, ccw);
}

/** Tower indices visited along the shortest fiber arc (inclusive). */
export function towerIndicesOnFiberArc(
  entryTower: number,
  exitTower: number,
  totalTowers: number,
): number[] {
  if (entryTower === exitTower) return [entryTower];

  const cw = (exitTower - entryTower + totalTowers) % totalTowers;
  const ccw = (entryTower - exitTower + totalTowers) % totalTowers;
  const indices: number[] = [];
  let cur = entryTower;

  if (cw <= ccw) {
    while (true) {
      indices.push(cur);
      if (cur === exitTower) break;
      cur = (cur + 1) % totalTowers;
    }
  } else {
    while (true) {
      indices.push(cur);
      if (cur === exitTower) break;
      cur = (cur - 1 + totalTowers) % totalTowers;
    }
  }

  return indices;
}
