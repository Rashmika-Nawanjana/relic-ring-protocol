import { fetchChimeraState, type ChimeraStateResponse } from "./client";
import type { LinkLiveState } from "./types";
import { normalizeLinkId } from "./link-id";

const DEFAULT_POLL_MS = 2_500;

type CacheEntry = {
  tick: number;
  links: Map<string, LinkLiveState>;
  fetchedAt: number;
};

let cache: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;

function toLinkMap(response: ChimeraStateResponse): Map<string, LinkLiveState> {
  const map = new Map<string, LinkLiveState>();
  for (const link of response.links) {
    map.set(normalizeLinkId(link.link_id), link);
  }
  return map;
}

function pollIntervalMs(): number {
  const raw = process.env.CHIMERA_POLL_MS;
  if (!raw) return DEFAULT_POLL_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_POLL_MS;
}

/** Refresh /state if cache is stale. Reuses in-flight request when polling concurrently. */
export async function refreshLiveState(force = false): Promise<CacheEntry> {
  const now = Date.now();
  if (!force && cache && now - cache.fetchedAt < pollIntervalMs()) {
    return cache;
  }

  if (!inflight) {
    inflight = fetchChimeraState()
      .then((response) => {
        const entry: CacheEntry = {
          tick: response.tick,
          links: toLinkMap(response),
          fetchedAt: Date.now(),
        };
        cache = entry;
        return entry;
      })
      .finally(() => {
        inflight = null;
      });
  }

  return inflight;
}

export async function getLiveLinkState(
  linkId: string,
): Promise<LinkLiveState | undefined> {
  const { links } = await refreshLiveState();
  return links.get(normalizeLinkId(linkId));
}

export async function getAllLiveStates(): Promise<Map<string, LinkLiveState>> {
  const { links } = await refreshLiveState();
  return new Map(links);
}

export async function getCurrentTick(): Promise<number> {
  const { tick } = await refreshLiveState();
  return tick;
}

/** Links Chimera marks saturated — hard unavailable for this tick. */
export function saturatedLinkIds(
  links: Map<string, LinkLiveState>,
): Set<string> {
  const out = new Set<string>();
  for (const [id, link] of links) {
    if (link.status === "saturated" || link.self_reported_latency_ms === null) {
      out.add(id);
    }
  }
  return out;
}

export function clearStateCache(): void {
  cache = null;
}
