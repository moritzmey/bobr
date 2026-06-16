import { NextResponse } from "next/server";
import { collectLiveTrains, serviceDateRome } from "@/lib/collect";
import { crossesCorridorByName } from "@/lib/route";
import {
  getSupabaseAdmin,
  TrainObservationInsert,
  TrainRunRow,
  TrainRunUpsert,
  TrainStopEventInsert,
} from "@/lib/supabase";

// Called by Vercel Cron every 5 minutes: snapshots every active train in
// South Tyrol into the observation time series and keeps one aggregated
// row per train run per day.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Night pause: no trains run roughly 01:00–04:30, spare the API
  const romeHour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date())
  );
  if (romeHour >= 1 && romeHour < 5) {
    return NextResponse.json({ ok: true, skipped: "night pause" });
  }

  const supabase = getSupabaseAdmin();
  const errors: string[] = [];
  const nowIso = new Date().toISOString();

  const { trains, cancelled } = await collectLiveTrains();

  // --- Observations: detailed time series for trains currently in the region
  const observations: TrainObservationInsert[] = trains
    .filter((t) => t.pos !== null)
    .map((t) => ({
      service_date: serviceDateRome(t.departureDateMs),
      train_number: t.trainNumber,
      category: t.category,
      line_id: t.pos!.lineId,
      frac: Math.round(t.pos!.frac * 1000) / 1000,
      delay_minutes: t.status.delayMinutes,
      at_station: t.pos!.atStation,
      next_station: t.pos!.nextStation,
    }));

  if (observations.length > 0) {
    const { error } = await supabase.from("train_observations").insert(observations);
    if (error) errors.push(`observations: ${error.message}`);
  }

  // --- Runs: one aggregated row per (service_date, train_number)
  const runUpserts = new Map<string, TrainRunUpsert>();

  for (const t of trains) {
    const serviceDate = serviceDateRome(t.departureDateMs);
    const firstStop = t.status.stops[0];
    const lastStop = t.status.stops[t.status.stops.length - 1];
    runUpserts.set(`${serviceDate}|${t.trainNumber}`, {
      service_date: serviceDate,
      train_number: t.trainNumber,
      category: t.category,
      origin: t.status.origin,
      destination: t.status.destination,
      sched_dep: firstStop?.scheduledDeparture ?? null,
      sched_arr: lastStop?.scheduledArrival ?? null,
      max_delay: t.status.delayMinutes,
      final_delay: t.status.delayMinutes,
      cancelled: false,
      corridor: t.corridor,
      samples: 1,
      last_seen: nowIso,
    });
  }

  for (const c of cancelled) {
    const serviceDate = serviceDateRome(c.departureDateMs);
    const key = `${serviceDate}|${c.trainNumber}`;
    if (!runUpserts.has(key)) {
      runUpserts.set(key, {
        service_date: serviceDate,
        train_number: c.trainNumber,
        category: c.category,
        origin: c.origin,
        destination: c.destination,
        sched_dep: c.scheduledTime || null,
        sched_arr: null,
        max_delay: 0,
        final_delay: 0,
        cancelled: true,
        // no stop list for cancelled trains — infer from endpoint names
        corridor: crossesCorridorByName(c.origin, c.destination),
        samples: 1,
        last_seen: nowIso,
      });
    }
  }

  if (runUpserts.size > 0) {
    const dates = [...new Set([...runUpserts.values()].map((r) => r.service_date))];
    const numbers = [...new Set([...runUpserts.values()].map((r) => r.train_number))];

    const { data: existing, error: selErr } = await supabase
      .from("train_runs")
      .select("service_date, train_number, max_delay, samples, cancelled, origin, destination, sched_dep, sched_arr")
      .in("service_date", dates)
      .in("train_number", numbers);

    if (selErr) {
      errors.push(`runs select: ${selErr.message}`);
    } else {
      const existingMap = new Map(
        ((existing ?? []) as Partial<TrainRunRow>[]).map((r) => [
          `${r.service_date}|${r.train_number}`,
          r,
        ])
      );

      const merged = [...runUpserts.entries()].map(([key, row]) => {
        const prev = existingMap.get(key);
        if (!prev) return row;
        return {
          ...row,
          max_delay: Math.max(prev.max_delay ?? 0, row.max_delay),
          samples: (prev.samples ?? 0) + 1,
          cancelled: (prev.cancelled ?? false) || row.cancelled,
          // keep first-seen route info if the new fetch came back empty
          origin: row.origin || prev.origin || "",
          destination: row.destination || prev.destination || "",
          sched_dep: row.sched_dep ?? prev.sched_dep ?? null,
          sched_arr: row.sched_arr ?? prev.sched_arr ?? null,
        };
      });

      const { error: upErr } = await supabase
        .from("train_runs")
        .upsert(merged, { onConflict: "service_date,train_number" });
      if (upErr) errors.push(`runs upsert: ${upErr.message}`);
    }
  }

  // --- Stop events: the full per-stop journey for every active run.
  // Persisted in full (network-wide) for future analysis; corridor path-delays
  // are derived from this. Cancelled trains have no stop list, so they're absent.
  const stopEvents: TrainStopEventInsert[] = [];
  for (const t of trains) {
    const serviceDate = serviceDateRome(t.departureDateMs);
    t.status.stops.forEach((s, seq) => {
      const arrDelay =
        s.actArrMs != null && s.schedArrMs != null
          ? Math.round((s.actArrMs - s.schedArrMs) / 60_000)
          : null;
      const depDelay =
        s.actDepMs != null && s.schedDepMs != null
          ? Math.round((s.actDepMs - s.schedDepMs) / 60_000)
          : null;
      stopEvents.push({
        service_date: serviceDate,
        train_number: t.trainNumber,
        seq,
        station_id: s.stationId || null,
        station_name: s.stationName,
        sched_arr: s.scheduledArrival,
        act_arr: s.actualArrival,
        arr_delay: arrDelay,
        sched_dep: s.scheduledDeparture,
        act_dep: s.actualDeparture,
        dep_delay: depDelay,
      });
    });
  }

  if (stopEvents.length > 0) {
    const { error } = await supabase
      .from("train_stop_events")
      .upsert(stopEvents, { onConflict: "service_date,train_number,seq" });
    if (error) errors.push(`stop_events: ${error.message}`);
  }

  return NextResponse.json({
    ok: errors.length === 0,
    errors,
    observations: observations.length,
    runs: runUpserts.size,
    stopEvents: stopEvents.length,
    recordedAt: nowIso,
  });
}
