import type { PlanetTowerRoute } from "./packet-path";

export type PacketLegPhase = "idle" | "fiber" | "void" | "tower" | "delivered";

export type PacketLiveSnapshot = {
  phase: PacketLegPhase;
  progress: number;
  hopIndex: number;
  planet: string | null;
  tower: string | null;
  nextPlanet: string | null;
  encoding: string | null;
  encodingBase: number | null;
};

/** Map 0–1 path progress to a human-readable leg (synced with 3D packet loop). */
export function packetLegAtProgress(
  progress: number,
  route: string[],
  towerRoutes: PlanetTowerRoute[],
  encodingsByPlanet: Map<string, { encoding: string; base: number }>,
): PacketLiveSnapshot {
  if (route.length < 2) {
    return {
      phase: "idle",
      progress: 0,
      hopIndex: 0,
      planet: null,
      tower: null,
      nextPlanet: null,
      encoding: null,
      encodingBase: null,
    };
  }

  const loop = progress % 1;
  const legs = route.length - 1;
  const t = loop * legs;
  const hopIndex = Math.min(Math.floor(t), legs - 1);
  const local = t - hopIndex;

  const planet = route[hopIndex];
  const nextPlanet = route[hopIndex + 1];
  const tr = towerRoutes[hopIndex];
  const enc = encodingsByPlanet.get(planet);

  if (loop > 0.98) {
    const dest = route[route.length - 1];
    const destEnc = encodingsByPlanet.get(dest);
    return {
      phase: "delivered",
      progress: loop,
      hopIndex: legs - 1,
      planet: dest,
      tower: `T_${towerRoutes[towerRoutes.length - 1]?.exitTower ?? 0}`,
      nextPlanet: null,
      encoding: destEnc?.encoding ?? null,
      encodingBase: destEnc?.base ?? null,
    };
  }

  if (local < 0.38) {
    return {
      phase: "fiber",
      progress: loop,
      hopIndex,
      planet,
      tower: `T_${tr.exitTower}`,
      nextPlanet,
      encoding: enc?.encoding ?? null,
      encodingBase: enc?.base ?? null,
    };
  }

  if (local < 0.72) {
    return {
      phase: "void",
      progress: loop,
      hopIndex,
      planet,
      tower: `T_${tr.exitTower}`,
      nextPlanet,
      encoding: enc?.encoding ?? null,
      encodingBase: enc?.base ?? null,
    };
  }

  return {
    phase: "tower",
    progress: loop,
    hopIndex: hopIndex + 1,
    planet: nextPlanet,
    tower: `T_${towerRoutes[hopIndex + 1]?.entryTower ?? 0}`,
    nextPlanet: route[hopIndex + 2] ?? null,
    encoding: encodingsByPlanet.get(nextPlanet)?.encoding ?? null,
    encodingBase: encodingsByPlanet.get(nextPlanet)?.base ?? null,
  };
}
