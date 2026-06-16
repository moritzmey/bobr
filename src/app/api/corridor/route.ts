import { NextRequest, NextResponse } from "next/server";
import { fetchCorridorTrains, STATIONS } from "@/lib/trenitalia";
import { demoCorridor } from "@/lib/demo";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const from = params.get("from") ?? "BOLZANO";
  const to = params.get("to") ?? "BRESSANONE";
  const timeParam = params.get("time");
  const whenMs = timeParam ? Number(timeParam) : Date.now();

  if (params.has("demo")) {
    return NextResponse.json(
      { trains: demoCorridor(from, to, whenMs) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const fromId = STATIONS[from as keyof typeof STATIONS]?.id ?? STATIONS.BOLZANO.id;
  const toId = STATIONS[to as keyof typeof STATIONS]?.id ?? STATIONS.BRESSANONE.id;

  try {
    const trains = await fetchCorridorTrains(fromId, toId, whenMs);
    return NextResponse.json(
      { trains },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    console.error("Corridor fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch corridor trains" }, { status: 502 });
  }
}
