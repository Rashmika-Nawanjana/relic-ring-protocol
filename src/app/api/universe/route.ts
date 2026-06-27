import { NextResponse } from "next/server";
import { loadUniverseConfig } from "@/lib/universe/load";

export async function GET() {
  return NextResponse.json(loadUniverseConfig());
}
