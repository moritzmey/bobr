import { NextRequest, NextResponse } from "next/server";
import {
  fetchArrivals,
  fetchDepartures,
  fetchTrainStatus,
  STATIONS,
} from "@/lib/trenitalia";
import { computeCorridorPosition, LiveTrain } from "@/lib/route";
import { demoLiveTrains } from "@/lib/demo";

export const runtime = "edge";

// Keywords identifying trains whose route crosses the BZ–BX corridor
const NORTH_OF_BZ = ["BRESSANONE", "BRIXEN", "FORTEZZA", "BRENNERO", "INNSBRUCK", "SAN CANDIDO", "INNICHEN", "LIENZ", "MONACO", "MUNCHEN", "MÜNCHEN"];
const SOUTH_OF_BX = ["BOLZANO", "BOZEN", "TRENTO", "VERONA", "ROVERETO", "ALA", "BOLOGNA", "MILANO", "ROMA"];

const MAX_CANDIDATES = 16;

function matchesAny(name: string, keywords: string[]): boolean {
  const upper = name.toUpperCase();
  return keywords.some((k) => upper.includes(k));
}

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

  const addCandidate = (trainNumber: string, originId: string, dateMs: number | null) => {
    if (!originId || candidates.has(trainNumber)) return;
    candidates.set(trainNumber, {
      trainNumber,
      originId,
      departureDateMs: dateMs ?? fallbackDate,
    });
  };

  const [bzDep, bxDep, bzArr, bxArr] = await Promise.allSettled([
    fetchDepartures(STATIONS.BOLZANO.id),
    fetchDepartures(STATIONS.BRESSANONE.id),
    fetchArrivals(STATIONS.BOLZANO.id),
    fetchArrivals(STATIONS.BRESSANONE.id),
  ]);

  // Departing trains crossing the corridor
  if (bzDep.status === "fulfilled") {
    for (const t of bzDep.value) {
      if (!t.cancelled && matchesAny(t.destination, NORTH_OF_BZ)) {
        addCandidate(t.trainNumber, t.originId, t.departureDateMs);
      }
    }
  }
  if (bxDep.status === "fulfilled") {
    for (const t of bxDep.value) {
      if (!t.cancelled && matchesAny(t.destination, SOUTH_OF_BX)) {
        addCandidate(t.trainNumber, t.originId, t.departureDateMs);
      }
    }
  }
  // Trains currently en route show up as upcoming arrivals at the far end
  if (bxArr.status === "fulfilled") {
    for (const t of bxArr.value) {
      if (!t.cancelled && matchesAny(t.origin, SOUTH_OF_BX)) {
        addCandidate(t.trainNumber, t.originId, t.departureDateMs);
      }
    }
  }
  if (bzArr.status === "fulfilled") {
    for (const t of bzArr.value) {
      if (!t.cancelled && matchesAny(t.origin, NORTH_OF_BZ)) {
        addCandidate(t.trainNumber, t.originId, t.departureDateMs);
      }
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

  for (const result of statuses) {
    if (result.status !== "fulfilled") continue;
    const status = result.value;
    if (status.cancelled) continue;

    const pos = computeCorridorPosition(status, now);
    if (!pos) continue;

    trains.push({
      trainNumber: status.trainNumber,
      category: status.category,
      destination: status.destination,
      delayMinutes: status.delayMinutes,
      direction: pos.direction,
      frac: pos.frac,
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
