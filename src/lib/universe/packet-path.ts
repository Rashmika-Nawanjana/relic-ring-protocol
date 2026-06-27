import * as THREE from "three";
import type { PlanetNode, ScenePlanet, UniverseConfig } from "./types";
import {
  closestTowerPair,
  fiberSegmentCount,
  towerAngleRad,
  towerIndicesOnFiberArc,
} from "./geometry";

export type PlanetTowerRoute = {
  planetId: string;
  entryTower: number;
  exitTower: number;
  viaTowers: number[];
  segments: number;
};

export type PacketPathPoint = [number, number, number];

export function towerTipHeight(planet: ScenePlanet): number {
  return planet.visualRadius * 0.16 * 1.35;
}

export function towerRingRadius(planet: ScenePlanet): number {
  return planet.visualRadius * 1.02;
}

/** Beacon tip in planet-local space (inside the spinning group). */
export function towerTipLocal(
  planet: ScenePlanet,
  towerIdx: number,
): [number, number, number] {
  const t = planet.towers[towerIdx];
  const tipY = towerTipHeight(planet);
  return [t.local[0], t.local[1] + tipY, t.local[2]];
}

function ringPointLocal(
  planet: ScenePlanet,
  towerIndex: number,
  tipY: number,
): [number, number, number] {
  const N = planet.node.active_towers;
  const angle = towerAngleRad(towerIndex, N);
  const r = towerRingRadius(planet);
  return [Math.sin(angle) * r, tipY, Math.cos(angle) * r];
}

/** Smooth fiber-arc samples along the equatorial ring at tower beacon height. */
export function fiberArcLocalPoints(
  planet: ScenePlanet,
  viaTowers: number[],
  samplesPerSegment = 5,
): [number, number, number][] {
  if (viaTowers.length === 0) return [];
  if (viaTowers.length === 1) return [towerTipLocal(planet, viaTowers[0])];

  const N = planet.node.active_towers;
  const tipY = towerTipHeight(planet);
  const points: [number, number, number][] = [];

  for (let i = 0; i < viaTowers.length - 1; i++) {
    const from = viaTowers[i];
    const to = viaTowers[i + 1];
    const cw = (to - from + N) % N;
    const ccw = (from - to + N) % N;
    const useCw = cw <= ccw;
    const segCount = useCw ? cw : ccw;
    const steps = Math.max(segCount * samplesPerSegment, 1);

    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const frac =
        useCw ? from + t * segCount : from - t * segCount;
      points.push(ringPointLocal(planet, frac, tipY));
    }
  }

  points.push(towerTipLocal(planet, viaTowers[viaTowers.length - 1]));
  return points;
}

function localToWorld(
  planet: ScenePlanet,
  local: [number, number, number],
  spinY: number,
): THREE.Vector3 {
  const v = new THREE.Vector3(...local);
  v.applyAxisAngle(new THREE.Vector3(0, 1, 0), spinY);
  return v.add(new THREE.Vector3(...planet.position));
}

export function towerTipWorld(
  planet: ScenePlanet,
  towerIdx: number,
  spinY: number,
): THREE.Vector3 {
  return localToWorld(planet, towerTipLocal(planet, towerIdx), spinY);
}

function towerAtmosphereWorld(
  planet: ScenePlanet,
  towerIdx: number,
  spinY: number,
): THREE.Vector3 {
  const tip = towerTipWorld(planet, towerIdx, spinY);
  const center = new THREE.Vector3(...planet.position);
  const radial = tip.clone().sub(center);
  if (radial.lengthSq() < 1e-8) radial.set(0, 1, 0);
  radial.normalize();
  return center.clone().add(radial.multiplyScalar(planet.atmosphereRadius));
}

export function buildPlanetTowerRoutes(
  route: string[],
  nodeMap: Map<string, PlanetNode>,
  scale: number,
): PlanetTowerRoute[] {
  const result: PlanetTowerRoute[] = [];

  for (let i = 0; i < route.length; i++) {
    const planetId = route[i];
    const planet = nodeMap.get(planetId)!;
    let entryTower: number;
    let exitTower: number;

    if (i === 0) {
      entryTower = 0;
      const next = nodeMap.get(route[i + 1])!;
      exitTower = closestTowerPair(planet, next, scale).sendIdx;
    } else if (i === route.length - 1) {
      const prev = nodeMap.get(route[i - 1])!;
      entryTower = closestTowerPair(prev, planet, scale).recvIdx;
      exitTower = entryTower;
    } else {
      const prev = nodeMap.get(route[i - 1])!;
      const next = nodeMap.get(route[i + 1])!;
      entryTower = closestTowerPair(prev, planet, scale).recvIdx;
      exitTower = closestTowerPair(planet, next, scale).sendIdx;
    }

    const viaTowers = towerIndicesOnFiberArc(
      entryTower,
      exitTower,
      planet.active_towers,
    );
    const segments = fiberSegmentCount(
      entryTower,
      exitTower,
      planet.active_towers,
    );

    result.push({ planetId, entryTower, exitTower, viaTowers, segments });
  }

  return result;
}

/** World-space path that tracks spinning planets and tower beacon tips. */
export function buildAnimatedPacketPath(
  planets: ScenePlanet[],
  route: string[],
  config: UniverseConfig,
  spinByPlanetId: Map<string, number>,
): THREE.Vector3[] {
  if (route.length < 2) return [];

  const planetMap = new Map(planets.map((p) => [p.node.id, p]));
  const nodeMap = new Map(config.nodes.map((n) => [n.id, n]));
  const scale = config.universe_metadata.coordinate_scale_unit_km;
  const towerRoutes = buildPlanetTowerRoutes(route, nodeMap, scale);
  const points: THREE.Vector3[] = [];

  for (let i = 0; i < towerRoutes.length; i++) {
    const tr = towerRoutes[i];
    const planet = planetMap.get(tr.planetId);
    if (!planet) continue;

    const spinY = spinByPlanetId.get(tr.planetId) ?? 0;

    if (i > 0) {
      points.push(towerAtmosphereWorld(planet, tr.entryTower, spinY));
      points.push(towerTipWorld(planet, tr.entryTower, spinY));
    }

    const fiberLocal = fiberArcLocalPoints(planet, tr.viaTowers);
    const arcStart = i > 0 ? 1 : 0;
    for (let j = arcStart; j < fiberLocal.length; j++) {
      points.push(localToWorld(planet, fiberLocal[j], spinY));
    }

    if (i < route.length - 1) {
      const nextPlanet = planetMap.get(route[i + 1]);
      const nextTr = towerRoutes[i + 1];
      if (!nextPlanet) continue;

      const nextSpin = spinByPlanetId.get(nextTr.planetId) ?? 0;
      points.push(towerAtmosphereWorld(planet, tr.exitTower, spinY));
      points.push(
        towerAtmosphereWorld(nextPlanet, nextTr.entryTower, nextSpin),
      );
    }
  }

  return points;
}

export function pathLength(waypoints: THREE.Vector3[]): number {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += waypoints[i].distanceTo(waypoints[i + 1]);
  }
  return total;
}

export function sampleAlongPath(
  waypoints: THREE.Vector3[] | PacketPathPoint[],
  progress: number,
): THREE.Vector3 {
  if (waypoints.length === 0) return new THREE.Vector3();
  const pts =
    waypoints[0] instanceof THREE.Vector3
      ? (waypoints as THREE.Vector3[])
      : (waypoints as PacketPathPoint[]).map((w) => new THREE.Vector3(...w));

  if (pts.length === 1) return pts[0].clone();

  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = pts[i].distanceTo(pts[i + 1]);
    lengths.push(len);
    total += len;
  }

  if (total < 1e-8) return pts[0].clone();

  let target = (progress % 1) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i]) {
      const t = lengths[i] > 0 ? target / lengths[i] : 0;
      return pts[i].clone().lerp(pts[i + 1], t);
    }
    target -= lengths[i];
  }

  return pts[pts.length - 1].clone();
}

/** @deprecated Use buildAnimatedPacketPath in useFrame */
export function buildPacketPathWaypoints(
  planets: ScenePlanet[],
  route: string[],
  config: UniverseConfig,
): PacketPathPoint[] {
  const spin = new Map(planets.map((p) => [p.node.id, 0]));
  return buildAnimatedPacketPath(planets, route, config, spin).map(
    (p) => p.toArray() as PacketPathPoint,
  );
}
