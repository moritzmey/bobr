import { NextRequest, NextResponse } from "next/server";
import { getSupabase, TrainRunRow } from "@/lib/supabase";
import { demoLeaderboard } from "@/lib/demo";

export interface LeaderboardEntry {
  trainNumber: string;
  category: string;
  origin: string;
  destination: string;
  schedDep: string | null;
  schedArr: string | null;
  runs: number;
  totalDelay: number; // accumulated final delay over all runs, minutes
  avgDelay: number;
  maxDelay: number;
  cancelledCount: number;
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.has("demo")) {
    return NextResponse.json(
      { entries: demoLeaderboard(), days: 30 },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceDate = since.toISOString().slice(0, 10);

  // Data is collected for all of South Tyrol, but the leaderboard
  // shows only trains serving the Bozen–Brixen corridor
  const { data, error } = await getSupabase()
    .from("train_runs")
    .select("*")
    .eq("corridor", true)
    .gte("service_date", sinceDate);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byTrain = new Map<string, LeaderboardEntry & { delaySum: number }>();

  for (const run of (data ?? []) as TrainRunRow[]) {
    let entry = byTrain.get(run.train_number);
    if (!entry) {
      entry = {
        trainNumber: run.train_number,
        category: run.category,
        origin: run.origin,
        destination: run.destination,
        schedDep: run.sched_dep,
        schedArr: run.sched_arr,
        runs: 0,
        totalDelay: 0,
        avgDelay: 0,
        maxDelay: 0,
        cancelledCount: 0,
        delaySum: 0,
      };
      byTrain.set(run.train_number, entry);
    }
    entry.runs++;
    if (run.cancelled) {
      entry.cancelledCount++;
    } else {
      entry.delaySum += run.final_delay;
      entry.maxDelay = Math.max(entry.maxDelay, run.max_delay);
    }
    // prefer the most recent run's route metadata
    if (run.origin) entry.origin = run.origin;
    if (run.destination) entry.destination = run.destination;
    if (run.sched_dep) entry.schedDep = run.sched_dep;
    if (run.sched_arr) entry.schedArr = run.sched_arr;
  }

  const entries: LeaderboardEntry[] = [...byTrain.values()]
    .map(({ delaySum, ...e }) => ({
      ...e,
      totalDelay: delaySum,
      avgDelay: e.runs - e.cancelledCount > 0 ? Math.round(delaySum / (e.runs - e.cancelledCount)) : 0,
    }))
    .sort((a, b) => b.totalDelay + b.cancelledCount * 60 - (a.totalDelay + a.cancelledCount * 60));

  return NextResponse.json(
    { entries, days: 30 },
    { headers: { "Cache-Control": "max-age=120" } }
  );
}
