import { NextResponse } from "next/server";
import { fetchDepartures, STATIONS } from "@/lib/trenitalia";
import { getSupabaseAdmin, TrainSnapshotInsert } from "@/lib/supabase";

// Called by Vercel Cron every 5 minutes
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const errors: string[] = [];

  for (const [stationKey, stationData] of Object.entries(STATIONS)) {
    try {
      const departures = await fetchDepartures(stationData.id);
      const direction =
        stationKey === "BOLZANO" ? "BZ_BX" : "BX_BZ";

      const rows: TrainSnapshotInsert[] = departures
        .filter((d) => {
          // Only keep trains relevant to our corridor
          const dest = d.destination.toUpperCase();
          return (
            dest.includes("BRESSANONE") ||
            dest.includes("BRIXEN") ||
            dest.includes("BOLZANO") ||
            dest.includes("BOZEN") ||
            dest.includes("INNSBRUCK") ||
            dest.includes("BRENNERO") ||
            dest.includes("TRENTO") ||
            dest.includes("VERONA")
          );
        })
        .map((d) => ({
          train_number: d.trainNumber,
          category: d.category,
          direction: direction as "BZ_BX" | "BX_BZ",
          scheduled_departure: d.scheduledTime,
          delay_minutes: d.delayMinutes,
          cancelled: d.cancelled,
          origin_station: stationData.name,
          destination_station: d.destination,
        }));

      if (rows.length > 0) {
        const { error } = await supabase.from("train_snapshots").insert(rows);
        if (error) errors.push(`${stationKey}: ${error.message}`);
      }
    } catch (err) {
      errors.push(`${stationKey}: ${String(err)}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    errors,
    recordedAt: new Date().toISOString(),
  });
}
