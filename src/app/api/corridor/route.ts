import { NextRequest, NextResponse } from "next/server";
import { CorridorTrain, fetchCorridorTrains, fetchDepartures, STATIONS } from "@/lib/trenitalia";
import { fetchOebbCorridorTrains } from "@/lib/oebb";
import { crossesCorridorByName } from "@/lib/route";
import { demoCorridor } from "@/lib/demo";

const TWO_HOURS_MS = 2 * 60 * 60_000;

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const from = params.get("from") ?? "BOLZANO";
  const to = params.get("to") ?? "BRESSANONE";
  const timeParam = params.get("time");
  const whenMs = timeParam ? Number(timeParam) : Date.now();

  if (params.has("demo")) {
    return NextResponse.json(
      { trains: demoCorridor(from, to, whenMs) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const fromStation = STATIONS[from as keyof typeof STATIONS] ?? STATIONS.BOLZANO;
  const toStation = STATIONS[to as keyof typeof STATIONS] ?? STATIONS.BRESSANONE;
  const fromId = fromStation.id;
  const toId = toStation.id;

  try {
    // Viaggiatreno is the primary feed; ÖBB fills in the cross-border SAD/ÖBB
    // trains it omits (e.g. R 1826). Dedup by number, Viaggiatreno wins. ÖBB
    // failures must not break the board. The departures board is also fetched
    // directly (cached, so no extra upstream) to surface cancellations.
    const [primary, oebb, departures] = await Promise.all([
      fetchCorridorTrains(fromId, toId, whenMs),
      fetchOebbCorridorTrains(fromId, toId, whenMs).catch((err) => {
        console.error("ÖBB corridor fetch error:", err);
        return [];
      }),
      fetchDepartures(fromId, whenMs).catch(() => []),
    ]);

    const seen = new Set(primary.map((t) => t.trainNumber));

    // A fully cancelled train is dropped from the destination's arrivals board,
    // so the departures∩arrivals match above loses it. Add cancelled departures
    // heading toward `to` (by direction of travel) that aren't already shown.
    const windowEnd = whenMs + TWO_HOURS_MS;
    const cancelledExtra: CorridorTrain[] = departures
      .filter((d) => d.cancelled && !seen.has(d.trainNumber))
      .filter((d) => d.scheduledMs == null || (d.scheduledMs >= whenMs - 60_000 && d.scheduledMs <= windowEnd))
      .filter((d) => crossesCorridorByName(fromStation.name, d.destination))
      .map((d) => ({
        trainNumber: d.trainNumber,
        category: d.category,
        destination: d.destination,
        depScheduled: d.scheduledTime,
        depEstimated: null,
        depScheduledMs: d.scheduledMs,
        depDelay: 0,
        arrScheduled: "",
        arrPredicted: null,
        arrDelay: 0,
        cancelled: true,
        platform: d.platform,
        originId: d.originId,
        departureDateMs: d.departureDateMs,
      }));
    for (const c of cancelledExtra) seen.add(c.trainNumber);

    const trains = [
      ...primary,
      ...oebb.filter((t) => !seen.has(t.trainNumber)),
      ...cancelledExtra,
    ].sort((a, b) => (a.depScheduledMs ?? 0) - (b.depScheduledMs ?? 0));

    return NextResponse.json(
      { trains },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (err) {
    console.error("Corridor fetch error:", err);
    return NextResponse.json({ error: "Failed to fetch corridor trains" }, { status: 502 });
  }
}
