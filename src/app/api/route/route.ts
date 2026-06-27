import { NextResponse } from "next/server";
import { loadUniverseConfig } from "@/lib/universe/load";
import { findRoute } from "@/lib/universe/router";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    origin,
    destination,
    message = "Hello world",
    killed = [],
    killed_links = [],
  } = body;

  if (!origin || !destination) {
    return NextResponse.json(
      { ok: false, error: "origin and destination required" },
      { status: 400 },
    );
  }

  const config = loadUniverseConfig();
  const result = findRoute(
    config,
    origin,
    destination,
    new Set(killed as string[]),
    message,
    new Set(killed_links as string[]),
  );

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
