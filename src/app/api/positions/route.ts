import { NextRequest, NextResponse } from "next/server";
import { collectLiveTrains } from "@/lib/collect";
import { LiveTrain } from "@/lib/route";
import { demoLiveTrains } from "@/lib/demo";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.has("demo")) {
    return NextResponse.json(
      { trains: demoLiveTrains(), updatedAt: new Date().toISOString(), demo: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const { trains: collected } = await collectLiveTrains();

  const trains: LiveTrain[] = collected
    .filter((t) => t.pos !== null)
    .map((t) => ({
      trainNumber: t.trainNumber,
      category: t.category,
      destination: t.status.destination,
      delayMinutes: t.status.delayMinutes,
      lineId: t.pos!.lineId,
      frac: t.pos!.frac,
      heading: t.pos!.heading,
      atStation: t.pos!.atStation,
      nextStation: t.pos!.nextStation,
      lastSeenAt: t.status.lastSeenAt,
      originId: t.originId,
      departureDateMs: t.departureDateMs,
    }));

  // CDN-cache briefly: upstream load stays constant regardless of visitors
  return NextResponse.json(
    { trains, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" } }
  );
}
