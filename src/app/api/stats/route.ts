import { NextRequest, NextResponse } from "next/server";
import { getSupabase, TrainSnapshotRow } from "@/lib/supabase";
import { demoStats } from "@/lib/demo";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.has("demo")) {
    return NextResponse.json(demoStats(), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const supabase = getSupabase();

  // Last 30 days
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data, error } = await supabase
    .from("train_snapshots")
    .select("train_number, category, direction, delay_minutes, cancelled, recorded_at")
    .gte("recorded_at", since.toISOString())
    .order("recorded_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate per train
  const byTrain: Record<
    string,
    { total: number; delayed: number; cancelled: number; totalDelay: number; direction: string; category: string }
  > = {};

  for (const row of (data ?? []) as TrainSnapshotRow[]) {
    const key = row.train_number;
    if (!byTrain[key]) {
      byTrain[key] = {
        total: 0,
        delayed: 0,
        cancelled: 0,
        totalDelay: 0,
        direction: row.direction,
        category: row.category,
      };
    }
    byTrain[key].total++;
    if (row.cancelled) byTrain[key].cancelled++;
    if (row.delay_minutes > 5) byTrain[key].delayed++;
    byTrain[key].totalDelay += row.delay_minutes;
  }

  const trains = Object.entries(byTrain).map(([number, s]) => ({
    trainNumber: number,
    category: s.category,
    direction: s.direction,
    totalRecorded: s.total,
    onTimePercent:
      s.total > 0
        ? Math.round(((s.total - s.delayed - s.cancelled) / s.total) * 100)
        : null,
    avgDelay: s.total > 0 ? Math.round(s.totalDelay / s.total) : 0,
    cancelledCount: s.cancelled,
  }));

  // Daily delay average for chart
  const byDay: Record<string, { count: number; totalDelay: number; cancelled: number }> = {};
  for (const row of (data ?? []) as TrainSnapshotRow[]) {
    const day = row.recorded_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { count: 0, totalDelay: 0, cancelled: 0 };
    byDay[day].count++;
    byDay[day].totalDelay += row.delay_minutes;
    if (row.cancelled) byDay[day].cancelled++;
  }

  const daily = Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => ({
      date,
      avgDelay: s.count > 0 ? Math.round(s.totalDelay / s.count) : 0,
      cancelled: s.cancelled,
    }));

  return NextResponse.json({ trains, daily });
}
