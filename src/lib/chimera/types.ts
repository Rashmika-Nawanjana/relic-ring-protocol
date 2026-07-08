/** Live link row from Chimera GET /state (Person 2 owns the client; shared contract). */
export type LinkLiveState = {
  link_id: string;
  planet_a: string;
  planet_b: string;
  capacity_units: number;
  current_load: number;
  load_ratio: number;
  self_reported_latency_ms: number | null;
  traffic_share: number;
  status: "ok" | "saturated";
};

export type CongestionPrediction = {
  penalty_ms: number;
  saturated: boolean;
};

export type TrustScore = {
  trust_score: number;
};

export type TargetingRisk = {
  risk_score: number;
};

export type ModelScores = {
  predicted_congestion_penalty_ms: number;
  trust_score: number;
  targeting_risk_score: number;
};

/** Recent link_ids our router chose — optional entropy input for targeting. */
export type TrafficHistory = string[];

/** One row in the mandatory Phase 2 `link_evaluations[]` report. */
export type LinkEvaluation = {
  link_id: string;
  predicted_congestion_penalty_ms: number;
  trust_score: number;
  targeting_risk_score: number;
  combined_cost: number;
};
