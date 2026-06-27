export type UniverseMetadata = {
  system_name: string;
  speed_of_light_kms: number;
  max_void_hop_distance_km: number;
  coordinate_scale_unit_km: number;
  tower_processing_delay_ms: number;
  fiber_speed_fraction: number;
};

export type PlanetNode = {
  id: string;
  codex: number;
  x: number;
  y: number;
  radius_km: number;
  active_towers: number;
  atmosphere_thickness_km: number;
  refraction_index: number;
};

export type UniverseConfig = {
  universe_metadata: UniverseMetadata;
  nodes: PlanetNode[];
};

export type TowerPosition = {
  index: number;
  label: string;
  local: [number, number, number];
  world: [number, number, number];
};

export type ScenePlanet = {
  node: PlanetNode;
  position: [number, number, number];
  visualRadius: number;
  atmosphereRadius: number;
  color: string;
  towers: TowerPosition[];
};

export type VoidEdge = {
  from: string;
  to: string;
  voidDistanceKm: number;
  valid: boolean;
};

export type LatencyComponents = {
  fiber_ms: number;
  towers_ms: number;
  atmosphere_ms: number;
  void_ms: number;
  total_ms: number;
};

export type HopLogEntry = {
  planet: string;
  tower: string;
  action: "receive" | "send" | "transit";
  latency_ms: number;
  encoding?: string;
  components?: LatencyComponents;
};

export type Packet = {
  origin_id: string;
  destination_id: string;
  current_id: string;
  payload: string;
  hop_log: HopLogEntry[];
  route: string[];
  total_latency_ms: number;
};

export type RouteResult =
  | {
      ok: true;
      route: string[];
      total_latency_ms: number;
      hops: HopLogEntry[];
      per_hop_latency: LatencyComponents[];
    }
  | { ok: false; error: string };
