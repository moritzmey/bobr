import { NextRequest, NextResponse } from "next/server";
import { getSupabase, TrainRunRow, TrainStopEventRow } from "@/lib/supabase";
import { STATIONS } from "@/lib/trenitalia";
import { demoReliability } from "@/lib/demo";

export type CorridorDir = "NB" | "SB"; // NB = Bozen→Brixen, SB = Brixen→Bozen

export interface ReliabilityEntry {
  trainNumber: string;
  category: string;
  direction: CorridorDir;
  origin: string; // German label of the corridor origin
  destination: string; // German label of the corridor destination
  schedDep: string | null; // scheduled departure at corridor origin
  schedArr: string | null; // scheduled arrival at corridor destination
  runs: number; // corridor runs with a measured arrival delay
  avgArrDelay: number; // avg arrival delay at destination endpoint (min 0)
  maxArrDelay: number;
  avgDepDelay: number; // avg departure delay at origin endpoint
  onTimePct: number; // % of runs arriving ≤ 5 min late
  cancelledCount: number;
}

export interface ReliabilityResponse {
  entries: ReliabilityEntry[];
  daily: { date: string; avgDelay: number; runs: number }[];
  days: number;
}

const BZ = STATIONS.BOLZANO.id;
const BX = STATIONS.BRESSANONE.id;
const ALLOWED_DAYS = new Set([7, 30, 90]);

function sinceDate(days: number): string {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since.toISOString().slice(0, 10);
}

interface Accum {
  trainNumber: string;
  direction: CorridorDir;
  schedDep: string | null;
  schedArr: string | null;
  arrSum: number;
  arrCount: number;
  maxArr: number;
  onTime: number;
  depSum: number;
  depCount: number;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const trainFilter = params.get("train");
  let days = Number(params.get("days") ?? 30);
  if (!ALLOWED_DAYS.has(days)) days = 30;

  if (params.has("demo")) {
    return NextResponse.json(demoReliability(days, trainFilter), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const since = sinceDate(days);
  const supabase = getSupabase();

  // Corridor endpoint stop-events drive the path delays
  const { data: evData, error: evErr } = await supabase
    .from("train_stop_events")
    .select("service_date, train_number, seq, station_id, sched_arr, arr_delay, sched_dep, dep_delay")
    .in("station_id", [BZ, BX])
    .gte("service_date", since);

  if (evErr) {
    return NextResponse.json({ error: evErr.message }, { status: 500 });
  }

  type Ev = Pick<
    TrainStopEventRow,
    "service_date" | "train_number" | "seq" | "station_id" | "sched_arr" | "arr_delay" | "sched_dep" | "dep_delay"
  >;
  const events = (evData ?? []) as Ev[];

  // Group endpoints per run (service_date + train_number)
  const byRun = new Map<string, { bz?: Ev; bx?: Ev }>();
  for (const e of events) {
    const key = `${e.service_date}|${e.train_number}`;
    let run = byRun.get(key);
    if (!run) byRun.set(key, (run = {}));
    if (e.station_id === BZ) run.bz = e;
    else if (e.station_id === BX) run.bx = e;
  }

  const byTrain = new Map<string, Accum>();
  const byDay = new Map<string, { sum: number; count: number }>();

  for (const [key, { bz, bx }] of byRun) {
    if (!bz || !bx) continue; // not a corridor run
    const serviceDate = key.split("|")[0];
    const northbound = bz.seq < bx.seq;
    const dest = northbound ? bx : bz;
    const origin = northbound ? bz : bx;
    const direction: CorridorDir = northbound ? "NB" : "SB";

    let acc = byTrain.get(bz.train_number);
    if (!acc) {
      byTrain.set(
        bz.train_number,
        (acc = {
          trainNumber: bz.train_number,
          direction,
          schedDep: origin.sched_dep ?? origin.sched_arr ?? null,
          schedArr: dest.sched_arr ?? null,
          arrSum: 0,
          arrCount: 0,
          maxArr: 0,
          onTime: 0,
          depSum: 0,
          depCount: 0,
        })
      );
    }
    // keep latest schedule metadata
    acc.direction = direction;
    if (origin.sched_dep ?? origin.sched_arr) acc.schedDep = origin.sched_dep ?? origin.sched_arr;
    if (dest.sched_arr) acc.schedArr = dest.sched_arr;

    if (dest.arr_delay != null) {
      const d = Math.max(0, dest.arr_delay);
      acc.arrSum += d;
      acc.arrCount++;
      acc.maxArr = Math.max(acc.maxArr, d);
      if (d <= 5) acc.onTime++;

      const day = byDay.get(serviceDate) ?? { sum: 0, count: 0 };
      day.sum += d;
      day.count++;
      byDay.set(serviceDate, day);
    }
    if (origin.dep_delay != null) {
      acc.depSum += Math.max(0, origin.dep_delay);
      acc.depCount++;
    }
  }

  // Cancellations + category/label metadata from train_runs (corridor only)
  const { data: runData } = await supabase
    .from("train_runs")
    .select("train_number, category, cancelled, corridor")
    .eq("corridor", true)
    .gte("service_date", since);

  const cancelledByTrain = new Map<string, number>();
  const categoryByTrain = new Map<string, string>();
  for (const r of (runData ?? []) as Pick<TrainRunRow, "train_number" | "category" | "cancelled" | "corridor">[]) {
    if (r.category) categoryByTrain.set(r.train_number, r.category);
    if (r.cancelled) cancelledByTrain.set(r.train_number, (cancelledByTrain.get(r.train_number) ?? 0) + 1);
  }

  let entries: ReliabilityEntry[] = [...byTrain.values()].map((a) => {
    const origin = a.direction === "NB" ? "Bozen" : "Brixen";
    const destination = a.direction === "NB" ? "Brixen" : "Bozen";
    return {
      trainNumber: a.trainNumber,
      category: categoryByTrain.get(a.trainNumber) ?? "",
      direction: a.direction,
      origin,
      destination,
      schedDep: a.schedDep,
      schedArr: a.schedArr,
      runs: a.arrCount,
      avgArrDelay: a.arrCount > 0 ? Math.round(a.arrSum / a.arrCount) : 0,
      maxArrDelay: a.maxArr,
      avgDepDelay: a.depCount > 0 ? Math.round(a.depSum / a.depCount) : 0,
      onTimePct: a.arrCount > 0 ? Math.round((a.onTime / a.arrCount) * 100) : 100,
      cancelledCount: cancelledByTrain.get(a.trainNumber) ?? 0,
    };
  });

  // Drop trains with no measured arrival yet and no cancellations (noise)
  entries = entries.filter((e) => e.runs > 0 || e.cancelledCount > 0);

  // Most unreliable first: arrival delay, with cancellations weighted in
  entries.sort(
    (a, b) =>
      b.avgArrDelay + b.cancelledCount * 5 - (a.avgArrDelay + a.cancelledCount * 5) ||
      b.runs - a.runs
  );

  if (trainFilter) {
    entries = entries.filter((e) => e.trainNumber === trainFilter);
  }

  const daily = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => ({ date, avgDelay: Math.round(s.sum / s.count), runs: s.count }));

  return NextResponse.json(
    { entries, daily, days } satisfies ReliabilityResponse,
    { headers: { "Cache-Control": "max-age=120" } }
  );
}
