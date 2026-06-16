import {
  fetchArrivals,
  fetchDepartures,
  fetchTrainStatus,
  STATIONS,
  TrainStatus,
} from "./trenitalia";
import { computeNetworkPosition, matchNetStation, NetPosition } from "./route";

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

export function todayMidnightRomeMs(): number {
  const romeNow = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Rome" })
  );
  romeNow.setHours(0, 0, 0, 0);
  return romeNow.getTime();
}

export function serviceDateRome(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export interface CollectedTrain {
  trainNumber: string;
  category: string; // from the boards; andamentoTreno often omits it
  originId: string; // run origin id, needed to re-fetch andamentoTreno
  departureDateMs: number;
  status: TrainStatus;
  pos: NetPosition | null;
  corridor: boolean; // stops at both Bolzano and Bressanone
}

export interface CancelledBoardTrain {
  trainNumber: string;
  category: string;
  departureDateMs: number;
  origin: string;
  destination: string;
  scheduledTime: string;
}

export interface CollectionResult {
  trains: CollectedTrain[];
  cancelled: CancelledBoardTrain[];
}

interface Candidate {
  trainNumber: string;
  originId: string;
  departureDateMs: number;
  category: string;
}

export async function collectLiveTrains(now: number = Date.now()): Promise<CollectionResult> {
  const fallbackDate = todayMidnightRomeMs();
  const candidates = new Map<string, Candidate>();
  const cancelled = new Map<string, CancelledBoardTrain>();

  const boards = await Promise.allSettled(
    BOARD_STATIONS.flatMap((id) => [fetchDepartures(id), fetchArrivals(id)])
  );

  for (const board of boards) {
    if (board.status !== "fulfilled") continue;
    for (const t of board.value) {
      if (t.cancelled) {
        if (!cancelled.has(t.trainNumber)) {
          cancelled.set(t.trainNumber, {
            trainNumber: t.trainNumber,
            category: t.category,
            departureDateMs: t.departureDateMs ?? fallbackDate,
            origin: "origin" in t ? (t as { origin: string }).origin : "",
            destination: "destination" in t ? (t as { destination: string }).destination : "",
            scheduledTime: t.scheduledTime,
          });
        }
        continue;
      }
      if (!t.originId || candidates.has(t.trainNumber)) continue;
      candidates.set(t.trainNumber, {
        trainNumber: t.trainNumber,
        originId: t.originId,
        departureDateMs: t.departureDateMs ?? fallbackDate,
        category: t.category,
      });
    }
  }

  const limited = [...candidates.values()].slice(0, MAX_CANDIDATES);

  const statuses = await Promise.allSettled(
    limited.map((c) =>
      fetchTrainStatus(c.originId, c.trainNumber, String(c.departureDateMs))
    )
  );

  const trains: CollectedTrain[] = [];
  for (let i = 0; i < statuses.length; i++) {
    const result = statuses[i];
    if (result.status !== "fulfilled") continue;
    const status = result.value;
    if (status.cancelled) continue;

    const stopKeys = new Set(
      status.stops.map((s) => matchNetStation(s.stationName)?.key).filter(Boolean)
    );

    trains.push({
      trainNumber: status.trainNumber,
      category: limited[i].category || status.category,
      originId: limited[i].originId,
      departureDateMs: limited[i].departureDateMs,
      status,
      pos: computeNetworkPosition(status, now),
      corridor: stopKeys.has("BZ") && stopKeys.has("BX"),
    });
  }

  return { trains, cancelled: [...cancelled.values()] };
}
