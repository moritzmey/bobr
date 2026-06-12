import { NextRequest, NextResponse } from "next/server";
import { getSupabase, TrainRunRow } from "@/lib/supabase";
import { demoStats } from "@/lib/demo";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.has("demo")) {
    return NextResponse.json(demoStats(), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceDate = since.toISOString().slice(0, 10);

  // Collected network-wide, displayed corridor-only
  const { data, error } = await getSupabase()
    .from("train_runs")
    .select("*")
    .eq("corridor", true)
    .gte("service_date", sinceDate);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const runs = (data ?? []) as TrainRunRow[];

  // Per-train aggregation
  const byTrain: Record<
    string,
    {
      total: number;
      delayed: number;
      cancelled: number;
      totalDelay: number;
      category: string;
      route: string;
    }
  > = {};

  for (const run of runs) {
    const key = run.train_number;
    if (!byTrain[key]) {
      byTrain[key] = {
        total: 0,
        delayed: 0,
        cancelled: 0,
        totalDelay: 0,
        category: run.category,
        route: run.origin && run.destination ? `${run.origin} → ${run.destination}` : "",
      };
    }
    byTrain[key].total++;
    if (run.cancelled) byTrain[key].cancelled++;
    else if (run.final_delay > 5) byTrain[key].delayed++;
    byTrain[key].totalDelay += run.cancelled ? 0 : run.final_delay;
  }

  const trains = Object.entries(byTrain).map(([number, s]) => ({
    trainNumber: number,
    category: s.category,
    route: s.route,
    totalRecorded: s.total,
    onTimePercent:
      s.total > 0
        ? Math.round(((s.total - s.delayed - s.cancelled) / s.total) * 100)
        : null,
    avgDelay:
      s.total - s.cancelled > 0 ? Math.round(s.totalDelay / (s.total - s.cancelled)) : 0,
    cancelledCount: s.cancelled,
  }));

  // Daily averages
  const byDay: Record<string, { count: number; totalDelay: number; cancelled: number }> = {};
  for (const run of runs) {
    if (!byDay[run.service_date]) byDay[run.service_date] = { count: 0, totalDelay: 0, cancelled: 0 };
    if (run.cancelled) {
      byDay[run.service_date].cancelled++;
    } else {
      byDay[run.service_date].count++;
      byDay[run.service_date].totalDelay += run.final_delay;
    }
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
