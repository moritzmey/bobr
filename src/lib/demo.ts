import { TrainDeparture, TrainStatus } from "./trenitalia";
import { CORRIDOR, Direction, LiveTrain, nextStationFromFrac } from "./route";

// Deterministic dummy data for previewing the UI without live APIs.
// Trains "move" in real time: position derives from the wall clock.

const JOURNEY_MS = 34 * 60_000;
const HEADWAY_MS = 30 * 60_000;
const DELAYS = [0, 4, 13, 0, 28, 6, 2, 0, 9, 17];

const NORTH_DESTS = ["BRENNERO", "INNSBRUCK HBF", "BRESSANONE", "FORTEZZA"];
const SOUTH_DESTS = ["BOLZANO", "VERONA PORTA NUOVA", "TRENTO", "BOLOGNA C.LE"];

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

function seededDelay(seed: number): number {
  return DELAYS[Math.abs(seed) % DELAYS.length];
}

function trainNumberFromSeed(seed: number, direction: Direction): string {
  const base = 20400 + (Math.abs(seed) % 40) * 2;
  return String(direction === "north" ? base + 1 : base);
}

export function demoLiveTrains(now: number = Date.now()): LiveTrain[] {
  const trains: LiveTrain[] = [];

  for (const direction of ["north", "south"] as const) {
    const phase = direction === "north" ? 0 : 14 * 60_000;
    for (let k = 0; k < 3; k++) {
      const start =
        Math.floor((now - phase) / HEADWAY_MS) * HEADWAY_MS + phase - k * HEADWAY_MS;
      const t = (now - start) / JOURNEY_MS;
      if (t < 0 || t > 1) continue;

      const seed = Math.floor(start / HEADWAY_MS);
      const frac = direction === "north" ? t : 1 - t;
      const dests = direction === "north" ? NORTH_DESTS : SOUTH_DESTS;

      const atStation =
        CORRIDOR.find((cs) => Math.abs(cs.frac - frac) < 0.015)?.name ?? null;

      trains.push({
        trainNumber: trainNumberFromSeed(seed, direction),
        category: seed % 4 === 0 ? "RV" : "R",
        destination: dests[Math.abs(seed) % dests.length],
        delayMinutes: seededDelay(seed),
        direction,
        frac,
        atStation,
        nextStation: nextStationFromFrac(frac, direction),
        lastSeenAt: atStation ?? (direction === "north" ? "Bozen" : "Brixen"),
      });
    }
  }

  return trains;
}

export function demoDepartures(stationKey: string, now: number = Date.now()): TrainDeparture[] {
  const north = stationKey === "BOLZANO";
  const dests = north ? NORTH_DESTS : SOUTH_DESTS;
  const departures: TrainDeparture[] = [];

  let t = now + 4 * 60_000;
  for (let i = 0; i < 8; i++) {
    const seed = Math.floor(t / HEADWAY_MS) + i;
    const delay = seededDelay(seed);
    const cancelled = i === 2; // one cancelled train for the preview
    departures.push({
      trainNumber: trainNumberFromSeed(seed, north ? "north" : "south"),
      category: seed % 4 === 0 ? "RV" : "R",
      destination: dests[Math.abs(seed) % dests.length],
      scheduledTime: fmtTime(t),
      estimatedTime: delay > 0 && !cancelled ? fmtTime(t + delay * 60_000) : null,
      delayMinutes: cancelled ? 0 : delay,
      cancelled,
      originId: north ? "S00219" : "S00269",
      platform: String(1 + (Math.abs(seed) % 4)),
      departureDateMs: null,
    });
    t += (12 + (Math.abs(seed) % 14)) * 60_000;
  }

  return departures;
}

export function demoTrainStatus(trainNumber: string, now: number = Date.now()): TrainStatus {
  const north = Number(trainNumber) % 2 === 1;
  const stations = north ? CORRIDOR : [...CORRIDOR].reverse();
  const delay = seededDelay(Number(trainNumber));
  const start = now - 18 * 60_000;

  return {
    trainNumber,
    category: "R",
    origin: north ? "Bolzano/Bozen" : "Bressanone/Brixen",
    destination: north ? "BRENNERO" : "BOLZANO",
    delayMinutes: delay,
    cancelled: false,
    lastSeenAt: stations[3].name,
    stops: stations.map((cs, i) => {
      const sched = start + i * 5.5 * 60_000;
      const passed = sched + delay * 60_000 < now;
      return {
        stationName: `${cs.nameIt}/${cs.name}`,
        scheduledArrival: fmtTime(sched),
        actualArrival: passed ? fmtTime(sched + delay * 60_000) : null,
        scheduledDeparture: fmtTime(sched + 60_000),
        actualDeparture: passed ? fmtTime(sched + 60_000 + delay * 60_000) : null,
        delayMinutes: passed ? delay : 0,
        schedArrMs: sched,
        actArrMs: passed ? sched + delay * 60_000 : null,
        schedDepMs: sched + 60_000,
        actDepMs: passed ? sched + 60_000 + delay * 60_000 : null,
      };
    }),
  };
}

export function demoStats(now: number = Date.now()) {
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    const weekday = d.getDay();
    // Mondays are rough, weekends are calm
    const base = weekday === 1 ? 11 : weekday === 0 || weekday === 6 ? 2 : 5;
    const wobble = Math.abs(Math.sin(i * 2.7)) * 6;
    daily.push({
      date: d.toISOString().slice(0, 10),
      avgDelay: Math.round(base + wobble),
      cancelled: i % 9 === 0 ? 1 : 0,
    });
  }

  const trains = Array.from({ length: 10 }, (_, i) => {
    const seed = i * 7 + 3;
    const avgDelay = [1, 17, 3, 8, 2, 12, 5, 0, 22, 6][i];
    return {
      trainNumber: trainNumberFromSeed(seed, i % 2 === 0 ? "north" : "south"),
      category: i % 4 === 0 ? "RV" : "R",
      direction: i % 2 === 0 ? "BZ_BX" : "BX_BZ",
      totalRecorded: 140 + i * 11,
      onTimePercent: Math.max(20, 96 - avgDelay * 3 - (i % 3) * 4),
      avgDelay,
      cancelledCount: avgDelay > 15 ? 4 : avgDelay > 8 ? 1 : 0,
    };
  });

  return { trains, daily };
}
