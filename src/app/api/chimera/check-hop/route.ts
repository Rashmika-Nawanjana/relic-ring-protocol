import { NextResponse } from "next/server";
import { refreshLiveState } from "@/lib/chimera/state-cache";
import { scoreLink } from "@/lib/chimera/models";
import { normalizeLinkId } from "@/lib/chimera/link-id";
import { loadUniverseConfig } from "@/lib/universe/load";
import { voidHopPhysicsMs, isLinkUnsafe } from "@/lib/copilot/cost";

/**
 * GET /api/chimera/check-hop?link=Aegis-Boreas
 * Quick single-hop safety check against latest Chimera /state.
 * Returns { safe, reason, scores } so the client can gate before void entry.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLink = searchParams.get("link");
  if (!rawLink) {
    return NextResponse.json(
      { ok: false, error: "Missing ?link= parameter" },
      { status: 400 },
    );
  }

  try {
    const linkId = normalizeLinkId(rawLink);
    const config = loadUniverseConfig();
    const { links, tick } = await refreshLiveState(true);
    const live = links.get(linkId);

    if (!live) {
      return NextResponse.json({
        ok: true,
        tick,
        link_id: linkId,
        safe: false,
        reason: "No live telemetry — link unknown or offline",
        scores: null,
      });
    }

    const [planetA, planetB] = linkId.split("-") as [string, string];
    const physics = voidHopPhysicsMs(config, planetA, planetB);
    const scores = scoreLink(linkId, live);
    const unsafe = isLinkUnsafe(linkId, live, physics);

    let reason: string | null = null;
    if (unsafe) {
      if (live.status === "saturated" || live.self_reported_latency_ms === null) {
        reason = "Saturated — hard failure, link closed this tick";
      } else if (scores.trust_score < 0.2) {
        reason = `Trust ${scores.trust_score.toFixed(2)} — Chimera spoof suspected`;
      } else if (!Number.isFinite(scores.predicted_congestion_penalty_ms)) {
        reason = "Congestion penalty infinite — link overloaded";
      } else {
        reason = "Combined risk too high";
      }
    }

    return NextResponse.json({
      ok: true,
      tick,
      link_id: linkId,
      safe: !unsafe,
      reason,
      scores: {
        load_ratio: live.load_ratio,
        status: live.status,
        congestion_penalty_ms: scores.predicted_congestion_penalty_ms,
        trust_score: scores.trust_score,
        targeting_risk_score: scores.targeting_risk_score,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Check failed" },
      { status: 500 },
    );
  }
}
