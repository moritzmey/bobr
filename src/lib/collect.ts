import {
  fetchArrivals,
  fetchDepartures,
  fetchTrainStatus,
  STATIONS,
  TrainStatus,
} from "./trenitalia";
import { computeNetworkPosition, crossesCorridorByName, matchNetStation, NetPosition } from "./route";
import { collectOebbTrains } from "./oebb";

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
  corridor: boolean; // traverses Bozen ↔ Brixen (for the reliability stats)
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

  // A suppressed train is often listed on only some boards, and each board
  // reveals only one endpoint (departures → destination, arrivals → origin).
  // Accumulate across all boards so we can recover both endpoints and note
  // which corridor stations it touched, then infer corridor membership.
  const cancelledAcc = new Map<string, CancelledBoardTrain & { stations: Set<string> }>();

  const boardJobs = BOARD_STATIONS.flatMap((id) => [
    { id, run: fetchDepartures(id) },
    { id, run: fetchArrivals(id) },
  ]);
  const boards = await Promise.allSettled(boardJobs.map((j) => j.run));

  for (let i = 0; i < boards.length; i++) {
    const board = boards[i];
    if (board.status !== "fulfilled") continue;
    const stationId = boardJobs[i].id;
    for (const t of board.value) {
      if (t.cancelled) {
        let acc = cancelledAcc.get(t.trainNumber);
        if (!acc) {
          acc = {
            trainNumber: t.trainNumber,
            category: t.category,
            departureDateMs: t.departureDateMs ?? fallbackDate,
            origin: "",
            destination: "",
            scheduledTime: t.scheduledTime,
            corridor: false,
            stations: new Set<string>(),
          };
          cancelledAcc.set(t.trainNumber, acc);
        }
        acc.stations.add(stationId);
        if ("destination" in t && t.destination) acc.destination ||= t.destination;
        if ("origin" in t && t.origin) acc.origin ||= t.origin;
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

  // A cancelled train is on the corridor if it was suppressed at both endpoints
  // (Bozen and Brixen), or if its route endpoints cross the corridor by name.
  const cancelled: CancelledBoardTrain[] = [...cancelledAcc.values()].map(({ stations, ...c }) => ({
    ...c,
    corridor:
      (stations.has(STATIONS.BOLZANO.id) && stations.has(STATIONS.BRESSANONE.id)) ||
      crossesCorridorByName(c.origin, c.destination),
  }));

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

  // Add the cross-border ÖBB/SAD trains that Viaggiatreno doesn't publish
  // (e.g. R/REX 1826 to Innsbruck), skipping any number we already placed.
  // Failures here must not take down the Viaggiatreno-based map.
  try {
    const have = new Set(trains.map((t) => t.trainNumber));
    const oebb = await collectOebbTrains(BOARD_STATIONS, have, now);
    for (const t of oebb) {
      if (have.has(t.trainNumber)) continue;
      have.add(t.trainNumber);
      trains.push(t);
    }
  } catch (err) {
    console.error("ÖBB collection error:", err);
  }

  return { trains, cancelled };
}
