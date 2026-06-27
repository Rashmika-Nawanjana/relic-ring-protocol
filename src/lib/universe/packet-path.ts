import * as THREE from "three";
import type { PlanetNode, ScenePlanet, UniverseConfig } from "./types";
import {
  closestTowerPair,
  fiberSegmentCount,
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

function towerEquatorPoint(planet: ScenePlanet, towerIdx: number): THREE.Vector3 {
  const t = planet.towers[towerIdx];
  return new THREE.Vector3(
    planet.position[0] + t.local[0],
    planet.position[1] + t.local[1],
    planet.position[2] + t.local[2],
  );
}

function towerAtmospherePoint(planet: ScenePlanet, towerIdx: number): THREE.Vector3 {
  const equator = towerEquatorPoint(planet, towerIdx);
  const center = new THREE.Vector3(...planet.position);
  const radial = equator.clone().sub(center);
  if (radial.lengthSq() < 1e-8) radial.set(0, 1, 0);
  radial.normalize();
  return center.add(radial.multiplyScalar(planet.atmosphereRadius));
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

/** World-space polyline: equatorial fiber arcs, atmosphere exits, and void hops. */
export function buildPacketPathWaypoints(
  planets: ScenePlanet[],
  route: string[],
  config: UniverseConfig,
): PacketPathPoint[] {
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

    if (i > 0) {
      points.push(towerAtmospherePoint(planet, tr.entryTower));
      points.push(towerEquatorPoint(planet, tr.entryTower));
    }

    const arcStart = i > 0 ? 1 : 0;
    for (let j = arcStart; j < tr.viaTowers.length; j++) {
      points.push(towerEquatorPoint(planet, tr.viaTowers[j]));
    }

    if (i < route.length - 1) {
      const nextPlanet = planetMap.get(route[i + 1]);
      const nextTr = towerRoutes[i + 1];
      if (!nextPlanet) continue;

      points.push(towerAtmospherePoint(planet, tr.exitTower));
      points.push(towerAtmospherePoint(nextPlanet, nextTr.entryTower));
    }
  }

  return points.map((p) => p.toArray() as PacketPathPoint);
}

export function sampleAlongPath(
  waypoints: PacketPathPoint[],
  progress: number,
): THREE.Vector3 {
  if (waypoints.length === 0) return new THREE.Vector3();
  if (waypoints.length === 1) return new THREE.Vector3(...waypoints[0]);

  const pts = waypoints.map((w) => new THREE.Vector3(...w));
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
