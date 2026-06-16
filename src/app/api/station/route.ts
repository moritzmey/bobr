import { NextRequest, NextResponse } from "next/server";
import { fetchArrivals, fetchDepartures } from "@/lib/trenitalia";
import { demoArrivals, demoDepartures } from "@/lib/demo";

export const runtime = "edge";

// Departures + arrivals for a single station, addressed by raw Viaggiatreno id
// (the map's NET_STATIONS carry these ids). Used by the map station panel.
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const id = params.get("id");

  if (params.has("demo")) {
    return NextResponse.json(
      { departures: demoDepartures("BOLZANO"), arrivals: demoArrivals("BOLZANO") },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!id) {
    return NextResponse.json({ error: "Missing station id" }, { status: 400 });
  }

  try {
    const [departures, arrivals] = await Promise.all([
      fetchDepartures(id),
      fetchArrivals(id),
    ]);
    return NextResponse.json(
      { departures, arrivals },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    console.error("Station fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch station board" }, { status: 502 });
  }
}
