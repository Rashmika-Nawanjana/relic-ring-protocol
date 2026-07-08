import type { LinkEvaluation } from "@/lib/chimera/types";
import type { LiveAnomaly } from "@/lib/chimera/anomaly";
import type { LinkEvaluationExplanation } from "@/lib/chimera/models/explain";
import { canonicalLinkId, normalizeLinkId } from "@/lib/chimera/link-id";
import type { AgentLogStep } from "./agent";

/** Mandatory Phase 2 unified routing report (phase2.md). */
export type CopilotReport = {
  origin_id: string;
  destination_id: string;
  chosen_path: string[];
  link_evaluations: LinkEvaluation[];
  final_latency_estimate_ms: number;
  explanation: string;
};

export type CopilotError = {
  ok: false;
  error: string;
};

/**
 * Agent result: the mandated report plus demo/audit metadata kept OUTSIDE
 * the unified schema (judges' report object stays byte-exact).
 */
export type CopilotResult =
  | {
      ok: true;
      report: CopilotReport;
      agent_log: AgentLogStep[];
      anomalies: LiveAnomaly[];
      audit: LinkEvaluationExplanation[];
    }
  | CopilotError;

export function isCopilotReport(value: unknown): value is CopilotReport {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.origin_id === "string" &&
    typeof r.destination_id === "string" &&
    Array.isArray(r.chosen_path) &&
    Array.isArray(r.link_evaluations) &&
    typeof r.final_latency_estimate_ms === "number" &&
    typeof r.explanation === "string"
  );
}

export function validateCopilotReport(report: CopilotReport): void {
  if (report.chosen_path.length < 2) {
    throw new Error("chosen_path must include at least origin and destination");
  }
  if (report.chosen_path[0] !== report.origin_id) {
    throw new Error("chosen_path must start with origin_id");
  }
  if (report.chosen_path[report.chosen_path.length - 1] !== report.destination_id) {
    throw new Error("chosen_path must end with destination_id");
  }

  const hops = report.chosen_path.length - 1;
  if (report.link_evaluations.length !== hops) {
    throw new Error(
      `link_evaluations length ${report.link_evaluations.length} must match hops ${hops}`,
    );
  }

  for (let i = 0; i < hops; i++) {
    const a = report.chosen_path[i]!;
    const b = report.chosen_path[i + 1]!;
    const expected = canonicalLinkId(a, b);
    const row = report.link_evaluations[i]!;
    if (row.link_id !== expected) {
      throw new Error(`link_evaluations[${i}] id ${row.link_id} != ${expected}`);
    }
    if (typeof row.predicted_congestion_penalty_ms !== "number") {
      throw new Error(`link_evaluations[${i}] missing congestion penalty`);
    }
    if (typeof row.trust_score !== "number") {
      throw new Error(`link_evaluations[${i}] missing trust_score`);
    }
    if (typeof row.targeting_risk_score !== "number") {
      throw new Error(`link_evaluations[${i}] missing targeting_risk_score`);
    }
    if (typeof row.combined_cost !== "number") {
      throw new Error(`link_evaluations[${i}] missing combined_cost`);
    }
  }
}
