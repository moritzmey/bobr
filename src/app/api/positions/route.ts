import { NextRequest, NextResponse } from "next/server";
import {
  fetchArrivals,
  fetchDepartures,
  fetchTrainStatus,
  STATIONS,
} from "@/lib/trenitalia";
import { computeNetworkPosition, LiveTrain } from "@/lib/route";
import { demoLiveTrains } from "@/lib/demo";

export const runtime = "edge";

// Stations whose departure/arrival boards we scan for candidate trains.
// Together they cover the Brenner axis, Pustertal, and the Meran line.
const BOARD_STATIONS = [
  STATIONS.BOLZANO.id,
  STATIONS.BRESSANONE.id,
  STATIONS.FORTEZZA.id,
  STATIONS.MERANO.id,
  STATIONS.BRUNICO.id,
];

const MAX_CANDIDATES = 28;

function todayMidnightRomeMs(): number {
  const romeNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" })
  );
  romeNow.setHours(0, 0, 0, 0);
  return romeNow.getTime();
}

interface Candidate {
  trainNumber: string;
  originId: string;
  departureDateMs: number;
  category: string;
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.has("demo")) {
    return NextResponse.json(
      { trains: demoLiveTrains(), updatedAt: new Date().toISOString(), demo: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const fallbackDate = todayMidnightRomeMs();
  const candidates = new Map<string, Candidate>();

  const addCandidate = (
    trainNumber: string,
    originId: string,
    dateMs: number | null,
    category: string
  ) => {
    if (!originId || candidates.has(trainNumber)) return;
    candidates.set(trainNumber, {
      trainNumber,
      originId,
      departureDateMs: dateMs ?? fallbackDate,
      category,
    });
  };

  const boards = await Promise.allSettled(
    BOARD_STATIONS.flatMap((id) => [fetchDepartures(id), fetchArrivals(id)])
  );

  for (const board of boards) {
    if (board.status !== "fulfilled") continue;
    for (const t of board.value) {
      if (!t.cancelled) addCandidate(t.trainNumber, t.originId, t.departureDateMs, t.category);
    }
  }

  const limited = [...candidates.values()].slice(0, MAX_CANDIDATES);

  const statuses = await Promise.allSettled(
    limited.map((c) =>
      fetchTrainStatus(c.originId, c.trainNumber, String(c.departureDateMs))
    )
  );

  const now = Date.now();
  const trains: LiveTrain[] = [];

  for (let i = 0; i < statuses.length; i++) {
    const result = statuses[i];
    if (result.status !== "fulfilled") continue;
    const status = result.value;
    if (status.cancelled) continue;

    const pos = computeNetworkPosition(status, now);
    if (!pos) continue;

    // andamentoTreno often omits the category — the board knows it
    trains.push({
      trainNumber: status.trainNumber,
      category: limited[i].category || status.category,
      destination: status.destination,
      delayMinutes: status.delayMinutes,
      lineId: pos.lineId,
      frac: pos.frac,
      heading: pos.heading,
      atStation: pos.atStation,
      nextStation: pos.nextStation,
      lastSeenAt: status.lastSeenAt,
    });
  }

  return NextResponse.json(
    { trains, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
