import type { LinkLiveState } from "./types";

const DEFAULT_API_URL = "https://chimera.launch26.space";

export type ChimeraServiceInfo = {
  service?: string;
  endpoints?: string[];
  [key: string]: unknown;
};

export type ChimeraLinkInfo = {
  link_id: string;
  planet_a: string;
  planet_b: string;
  capacity_units: number;
};

export type ChimeraStateResponse = {
  tick: number;
  links: LinkLiveState[];
};

function apiUrl(): string {
  return (process.env.CHIMERA_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");
}

function teamKey(): string {
  const key = process.env.CHIMERA_TEAM_KEY;
  if (!key) {
    throw new Error("CHIMERA_TEAM_KEY is not set");
  }
  return key;
}

async function chimeraFetch<T>(path: string, auth = false): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (auth) headers["X-Team-Key"] = teamKey();

  const res = await fetch(`${apiUrl()}${path}`, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Chimera API ${path} failed (${res.status}): ${body}`);
  }

  return res.json() as Promise<T>;
}

/** GET / — service info (no key). */
export function fetchChimeraInfo(): Promise<ChimeraServiceInfo> {
  return chimeraFetch<ChimeraServiceInfo>("/");
}

/** GET /links — link list with capacities (no key). */
export function fetchChimeraLinks(): Promise<ChimeraLinkInfo[]> {
  return chimeraFetch<ChimeraLinkInfo[]>("/links");
}

/** GET /state — live link conditions (requires X-Team-Key). */
export function fetchChimeraState(): Promise<ChimeraStateResponse> {
  return chimeraFetch<ChimeraStateResponse>("/state", true);
}
