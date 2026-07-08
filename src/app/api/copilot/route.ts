import { NextResponse } from "next/server";
import { loadUniverseConfig } from "@/lib/universe/load";
import { runCopilotAgent } from "@/lib/copilot/agent";
import { parseCopilotInput } from "@/lib/copilot/parser";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = parseCopilotInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const config = loadUniverseConfig();
    const killed = new Set<string>((body.killed as string[] | undefined) ?? []);
    const killedLinks = new Set<string>(
      (body.killed_links as string[] | undefined) ?? [],
    );
    const excludeLinks = new Set<string>(
      (body.exclude_links as string[] | undefined) ?? [],
    );
    const trafficHistory = (body.traffic_history as string[] | undefined) ?? [];

    const result = await runCopilotAgent(config, parsed.request, {
      killed,
      killedLinks,
      excludeLinks,
      trafficHistory,
    });

    if (!result.ok) {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json({ ok: true, ...result.report });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Copilot agent failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/copilot",
    usage: {
      POST: {
        text: "Send Caelum to Aegis: Hello world",
        or: { origin: "Aegis", destination: "Caelum", message: "Hello world" },
      },
    },
  });
}
