import { NextResponse } from "next/server";
import { buildChimeraPanelData } from "@/lib/chimera/panel-data";

export async function GET() {
  try {
    const data = await buildChimeraPanelData();
    return NextResponse.json({ ok: true, ...data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chimera panel fetch failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
