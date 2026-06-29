import { NextRequest, NextResponse } from "next/server";
import { fetchTrainStatus } from "@/lib/trenitalia";
import { fetchOebbTrainStatus, isOebbJourneyId } from "@/lib/oebb";
import { demoTrainStatus } from "@/lib/demo";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const trainNumber = req.nextUrl.searchParams.get("number");

  if (req.nextUrl.searchParams.has("demo")) {
    return NextResponse.json(demoTrainStatus(trainNumber ?? "20401"), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const originId = req.nextUrl.searchParams.get("origin");
  const date = req.nextUrl.searchParams.get("date");

  if (!trainNumber || !originId || !date) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    // ÖBB live-map trains carry a HAFAS journey-id in place of a Viaggiatreno
    // origin id, so they resolve against the ÖBB upstream instead.
    const status = isOebbJourneyId(originId)
      ? await fetchOebbTrainStatus(originId)
      : await fetchTrainStatus(originId, trainNumber, date);
    return NextResponse.json(status, {
      headers: { "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40" },
    });
  } catch (err) {
    console.error("Train status error:", err);
    return NextResponse.json({ error: "Failed to fetch train status" }, { status: 502 });
  }
}
