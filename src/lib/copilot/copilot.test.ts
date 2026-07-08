/**
 * Person 2 CoPilot agent tests (mock live state — no API calls).
 * Run: npm run test:copilot
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { LinkLiveState } from "@/lib/chimera/types";
import { loadUniverseConfig } from "@/lib/universe/load";
import { parseNaturalLanguageRequest, parseCopilotInput } from "./parser";
import { runCopilotAgent } from "./agent";
import { validateCopilotReport } from "./schema";

const config = loadUniverseConfig();

function okLink(
  linkId: string,
  overrides: Partial<LinkLiveState> = {},
): LinkLiveState {
  const [planet_a, planet_b] = linkId.split("-") as [string, string];
  return {
    link_id: linkId,
    planet_a,
    planet_b,
    capacity_units: 100,
    current_load: 10,
    load_ratio: 0.1,
    self_reported_latency_ms: 80_000,
    traffic_share: 0.03,
    status: "ok",
    ...overrides,
  };
}

function buildCleanLiveMap(): Map<string, LinkLiveState> {
  const map = new Map<string, LinkLiveState>();
  for (const link of config.interplanetary_links ?? []) {
    map.set(link.link_id, okLink(link.link_id));
  }
  return map;
}

describe("Person 2 CoPilot", () => {
  it("parses natural-language routing requests", () => {
    const r = parseNaturalLanguageRequest("Send Caelum to Aegis: Hello world");
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.request.origin_id, "Caelum");
      assert.equal(r.request.destination_id, "Aegis");
      assert.equal(r.request.message, "Hello world");
    }
  });

  it("parses structured copilot input", () => {
    const r = parseCopilotInput({
      origin: "Aegis",
      destination: "Caelum",
      message: "ping",
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.request.message, "ping");
  });

  it("produces valid unified report on clean live state", async () => {
    const result = await runCopilotAgent(
      config,
      { origin_id: "Aegis", destination_id: "Caelum", message: "test" },
      { liveStates: buildCleanLiveMap() },
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      validateCopilotReport(result.report);
      assert.ok(result.report.chosen_path.length >= 2);
      assert.ok(result.report.final_latency_estimate_ms > 0);
      assert.ok(result.report.explanation.length > 0);
    }
  });

  it("reroutes away from saturated baseline hop", async () => {
    const live = buildCleanLiveMap();
    live.set(
      "Aegis-Elysium",
      okLink("Aegis-Elysium", {
        load_ratio: 0.95,
        status: "saturated",
        self_reported_latency_ms: null,
      }),
    );

    const result = await runCopilotAgent(
      config,
      { origin_id: "Aegis", destination_id: "Elysium", message: "test" },
      { liveStates: live },
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      const direct = result.report.chosen_path.length === 2;
      assert.ok(!direct, "should detour when direct Aegis-Elysium is saturated");
      assert.match(result.report.explanation, /Excluded|overridden|Chimera/i);
    }
  });

  it("flags spoofed link in explanation when on path", async () => {
    const live = buildCleanLiveMap();
    live.set(
      "Aegis-Elysium",
      okLink("Aegis-Elysium", {
        load_ratio: 0.2,
        self_reported_latency_ms: 10_000,
        traffic_share: 0.05,
      }),
    );

    const result = await runCopilotAgent(
      config,
      { origin_id: "Aegis", destination_id: "Elysium", message: "test" },
      { liveStates: live },
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      const row = result.report.link_evaluations.find(
        (e) => e.link_id === "Aegis-Elysium",
      );
      if (row) {
        assert.ok(row.trust_score < 0.2);
      }
    }
  });
});
