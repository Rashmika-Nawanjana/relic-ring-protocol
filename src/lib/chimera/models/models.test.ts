/**
 * Held-out validation (ticks 400–499) for Person 1 models.
 * Run: npm run test:models
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import type { LinkLiveState } from "../types";
import { predict as predictCongestion } from "./congestion";
import { score as scoreTrust, SPOOFED_LINKS } from "./trust";
import { risk as targetingRisk } from "./targeting";
import { TRAINED_PARAMS } from "./params";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const HOLD_OUT = TRAINED_PARAMS.hold_out_from_tick;
const METRICS = TRAINED_PARAMS.validation_metrics;

type CsvRow = Record<string, string>;

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0]!.split(",");
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row: CsvRow = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function loadCsv(name: string): CsvRow[] {
  return parseCsv(readFileSync(path.join(ROOT, "challenge", name), "utf-8"));
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = xs[i]! - mx;
    const vy = ys[i]! - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  return num / Math.sqrt(dx * dy) || 0;
}


function toLiveState(row: CsvRow, linkId: string): LinkLiveState {
  const saturated = row.status === "saturated";
  return {
    link_id: linkId,
    planet_a: linkId.split("-")[0]!,
    planet_b: linkId.split("-")[1]!,
    capacity_units: 100,
    current_load: parseFloat(row.load_units || "0") || 0,
    load_ratio: parseFloat(row.load_ratio || "0"),
    self_reported_latency_ms: saturated ? null : parseFloat(row.observed_latency_ms || "0") || 0,
    traffic_share: 0.05,
    status: saturated ? "saturated" : "ok",
  };
}

describe("Person 1 models — held-out validation", () => {
  it("congestion penalty correlates with observed delta on validation ticks", () => {
    const traffic = loadCsv("link_traffic_history.csv").filter(
      (r) => parseInt(r.tick!, 10) >= HOLD_OUT,
    );

    const predicted: number[] = [];
    const actual: number[] = [];

    for (const row of traffic) {
      if (!row.observed_latency_ms || row.status === "saturated") continue;
      const lid = row.link_id!;
      const curve =
        TRAINED_PARAMS.link_congestion[
          lid as keyof typeof TRAINED_PARAMS.link_congestion
        ];
      const live = toLiveState(row, lid);
      const { penalty_ms, saturated } = predictCongestion(lid, live);
      if (saturated) continue;
      const actPen = parseFloat(row.observed_latency_ms) - curve.baseline_ms;
      if (actPen < 0) continue;
      predicted.push(penalty_ms);
      actual.push(actPen);
    }

    const r = pearson(predicted, actual);
    assert.ok(r > 0.9, `congestion Pearson r=${r.toFixed(3)} expected > 0.9`);
  });

  it("trust model flags spoofed links without killing honest links", () => {
    const telemetry = loadCsv("link_telemetry.csv").filter(
      (r) => parseInt(r.tick!, 10) >= HOLD_OUT,
    );
    const trafficByKey = new Map<string, CsvRow>();
    for (const row of loadCsv("link_traffic_history.csv")) {
      trafficByKey.set(`${row.link_id}:${row.tick}`, row);
    }

    const spoofScores: number[] = [];
    const honestScores: number[] = [];

    for (const row of telemetry) {
      if (!row.self_reported_latency_ms || !row.measured_latency_ms) continue;
      const lid = row.link_id!;
      const traffic = trafficByKey.get(`${lid}:${row.tick}`);
      if (!traffic || traffic.status === "saturated") continue;

      const live: LinkLiveState = {
        link_id: lid,
        planet_a: lid.split("-")[0]!,
        planet_b: lid.split("-")[1]!,
        capacity_units: 100,
        current_load: parseFloat(traffic.load_units || "0") || 0,
        load_ratio: parseFloat(traffic.load_ratio || "0"),
        self_reported_latency_ms: parseFloat(row.self_reported_latency_ms),
        traffic_share: 0.05,
        status: "ok",
      };
      const { trust_score } = scoreTrust(lid, live);
      if (SPOOFED_LINKS.includes(lid as (typeof SPOOFED_LINKS)[number])) {
        spoofScores.push(trust_score);
      } else {
        honestScores.push(trust_score);
      }
    }

    const spoofAvg = spoofScores.reduce((a, b) => a + b, 0) / spoofScores.length;
    const honestAvg = honestScores.reduce((a, b) => a + b, 0) / honestScores.length;
    const falseFlagRate =
      honestScores.filter((s) => s < 0.5).length / honestScores.length;

    assert.ok(spoofAvg < 0.15, `spoof avg trust=${spoofAvg.toFixed(3)}`);
    assert.ok(honestAvg > 0.8, `honest avg trust=${honestAvg.toFixed(3)}`);
    assert.ok(falseFlagRate < 0.05, `honest false flag rate=${falseFlagRate.toFixed(3)}`);
  });

  it("targeting risk ranks jammed links above safe links on validation ticks", () => {
    const incidents = loadCsv("link_incident_history.csv").filter(
      (r) => parseInt(r.tick!, 10) >= HOLD_OUT && r.traffic_share,
    );
    const trafficByKey = new Map<string, CsvRow>();
    for (const row of loadCsv("link_traffic_history.csv")) {
      trafficByKey.set(`${row.link_id}:${row.tick}`, row);
    }

    let jamRiskSum = 0;
    let jamCount = 0;
    let safeRiskSum = 0;
    let safeCount = 0;

    for (const row of incidents) {
      const traffic = trafficByKey.get(`${row.link_id}:${row.tick}`);
      if (!traffic || traffic.status === "saturated") continue;
      const share = parseFloat(row.traffic_share!);
      const live: LinkLiveState = {
        link_id: row.link_id!,
        planet_a: row.link_id!.split("-")[0]!,
        planet_b: row.link_id!.split("-")[1]!,
        capacity_units: 100,
        current_load: 50,
        load_ratio: 0.3,
        self_reported_latency_ms: 50_000,
        traffic_share: share,
        status: "ok",
      };
      const { risk_score } = targetingRisk(row.link_id!, live);
      if (row.jammed_flag === "True") {
        jamRiskSum += risk_score;
        jamCount++;
      } else {
        safeRiskSum += risk_score;
        safeCount++;
      }
    }

    const jamAvg = jamRiskSum / jamCount;
    const safeAvg = safeRiskSum / safeCount;
    assert.ok(jamAvg > safeAvg, `jam avg risk=${jamAvg.toFixed(3)} safe=${safeAvg.toFixed(3)}`);
    assert.ok(
      METRICS.targeting_auc > 0.65,
      `training targeting AUC=${METRICS.targeting_auc} expected > 0.65`,
    );
  });

  it("saturated links are marked unavailable by congestion model", () => {
    const live: LinkLiveState = {
      link_id: "Aegis-Boreas",
      planet_a: "Aegis",
      planet_b: "Boreas",
      capacity_units: 208,
      current_load: 200,
      load_ratio: 0.95,
      self_reported_latency_ms: null,
      traffic_share: 0.1,
      status: "saturated",
    };
    const result = predictCongestion("Aegis-Boreas", live);
    assert.equal(result.saturated, true);
    assert.equal(result.penalty_ms, Number.POSITIVE_INFINITY);
  });

  it("embedded training metrics meet improvement thresholds", () => {
    assert.ok(METRICS.congestion_pearson > 0.93);
    assert.ok(METRICS.congestion_mape < 0.78);
    assert.ok(METRICS.trust_honest_false_flag < 0.05);
    assert.ok(METRICS.targeting_auc > 0.65);
  });
});
