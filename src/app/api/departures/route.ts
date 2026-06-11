import { NextRequest, NextResponse } from "next/server";
import { fetchDepartures, STATIONS } from "@/lib/trenitalia";
import { demoDepartures } from "@/lib/demo";

export const runtime = "edge";
export const revalidate = 60;

export async function GET(req: NextRequest) {
  const station = req.nextUrl.searchParams.get("station") ?? "BOLZANO";

  if (req.nextUrl.searchParams.has("demo")) {
    return NextResponse.json(demoDepartures(station), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const stationId =
    STATIONS[station as keyof typeof STATIONS]?.id ?? STATIONS.BOLZANO.id;

  try {
    const departures = await fetchDepartures(stationId);
    return NextResponse.json(departures, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Trenitalia fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch departures" }, { status: 502 });
  }
}
