import { NextRequest, NextResponse } from "next/server";
import { fetchTrainStatus } from "@/lib/trenitalia";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const trainNumber = req.nextUrl.searchParams.get("number");
  const originId = req.nextUrl.searchParams.get("origin");
  const date = req.nextUrl.searchParams.get("date");

  if (!trainNumber || !originId || !date) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  try {
    const status = await fetchTrainStatus(originId, trainNumber, date);
    return NextResponse.json(status, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Train status error:", err);
    return NextResponse.json({ error: "Failed to fetch train status" }, { status: 502 });
  }
}
