import { NextResponse } from "next/server";
import { fetchDisruptions } from "@/lib/disruptions";

export const runtime = "edge";

export async function GET() {
  try {
    const disruptions = await fetchDisruptions();
    return NextResponse.json(
      { disruptions, updatedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (err) {
    console.error("Disruptions fetch error:", err);
    // Soft-fail: the banner simply renders nothing rather than breaking the app.
    return NextResponse.json({ disruptions: [] }, { status: 200 });
  }
}
