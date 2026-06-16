import { CorridorTrain, TrainArrival, TrainDeparture, TrainStatus } from "./trenitalia";
import { demoExpectedDelay } from "./clientDemo";
import { getLine, LineId, LiveTrain, NET_STATIONS } from "./route";

// Deterministic dummy data for previewing the UI without live APIs.
// Trains "move" in real time: position derives from the wall clock.

const DELAYS = [0, 4, 13, 0, 28, 6, 2, 0, 9, 17];

const LINE_CONFIG: Record<
  LineId,
  { journeyMs: number; headwayMs: number; toEnd: string[]; toStart: string[] }
> = {
  brenner: {
    journeyMs: 80 * 60_000,
    headwayMs: 30 * 60_000,
    toEnd: ["BRENNERO", "INNSBRUCK HBF"],
    toStart: ["VERONA PORTA NUOVA", "BOLZANO", "TRENTO"],
  },
  pustertal: {
    journeyMs: 65 * 60_000,
    headwayMs: 60 * 60_000,
    toEnd: ["S.CANDIDO"],
    toStart: ["FORTEZZA", "BOLZANO"],
  },
  meran: {
    journeyMs: 38 * 60_000,
    headwayMs: 30 * 60_000,
    toEnd: ["MERANO"],
    toStart: ["BOLZANO"],
  },
};

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

function trainNumberFromSeed(seed: number, odd: boolean): string {
  const base = 20400 + (Math.abs(seed) % 40) * 2;
  return String(odd ? base + 1 : base);
}

export function demoLiveTrains(now: number = Date.now()): LiveTrain[] {
  const trains: LiveTrain[] = [];

  for (const [lineId, cfg] of Object.entries(LINE_CONFIG) as [LineId, typeof LINE_CONFIG.brenner][]) {
    const line = getLine(lineId);
    const endName = NET_STATIONS[line.stationKeys[line.stationKeys.length - 1]].name;
    const startName = NET_STATIONS[line.stationKeys[0]].name;

    for (const heading of [1, -1] as const) {
      const phase = heading === 1 ? 0 : 14 * 60_000;
      const count = lineId === "brenner" ? 3 : 2;
      for (let k = 0; k < count; k++) {
        const start =
          Math.floor((now - phase) / cfg.headwayMs) * cfg.headwayMs + phase - k * cfg.headwayMs;
        const t = (now - start) / cfg.journeyMs;
        if (t < 0 || t > 1) continue;

        const seed = Math.floor(start / cfg.headwayMs) + lineId.length * 7;
        const frac = heading === 1 ? t : 1 - t;
        const dests = heading === 1 ? cfg.toEnd : cfg.toStart;

        // Closest station marker when dwelling
        const atIdx = line.fracs.findIndex((f) => Math.abs(f - frac) < 0.012);
        const atStation = atIdx >= 0 ? NET_STATIONS[line.stationKeys[atIdx]].name : null;

        const nextIdx =
          heading === 1
            ? line.fracs.findIndex((f) => f > frac + 0.012)
            : line.fracs.length - 1 - [...line.fracs].reverse().findIndex((f) => f < frac - 0.012);
        const nextStation =
          nextIdx >= 0 && nextIdx < line.stationKeys.length
            ? NET_STATIONS[line.stationKeys[nextIdx]].name
            : null;

        trains.push({
          trainNumber: trainNumberFromSeed(seed, heading === 1),
          category:
            lineId === "brenner" && seed % 5 === 0 ? "EC" : seed % 4 === 0 ? "RV" : "REG",
          destination: dests[Math.abs(seed) % dests.length],
          delayMinutes: seededDelay(seed),
          lineId,
          frac,
          heading,
          atStation,
          nextStation,
          lastSeenAt: atStation ?? (heading === 1 ? startName : endName),
          originId: heading === 1 ? "S02026" : "S02014",
          departureDateMs: 0,
        });
      }
    }
  }

  return trains;
}

export function demoDepartures(stationKey: string, now: number = Date.now()): TrainDeparture[] {
  const north = stationKey === "BOLZANO";
  const dests = north
    ? ["BRENNERO", "INNSBRUCK HBF", "BRESSANONE", "MERANO"]
    : ["BOLZANO", "VERONA PORTA NUOVA", "TRENTO", "BOLOGNA C.LE"];
  const departures: TrainDeparture[] = [];

  let t = now + 4 * 60_000;
  for (let i = 0; i < 8; i++) {
    const seed = Math.floor(t / (30 * 60_000)) + i;
    const delay = seededDelay(seed);
    const cancelled = i === 2; // one cancelled train for the preview
    departures.push({
      trainNumber: trainNumberFromSeed(seed, north),
      category: seed % 5 === 0 ? "EC" : seed % 4 === 0 ? "RV" : "REG",
      destination: dests[Math.abs(seed) % dests.length],
      scheduledTime: fmtTime(t),
      estimatedTime: delay > 0 && !cancelled ? fmtTime(t + delay * 60_000) : null,
      delayMinutes: cancelled ? 0 : delay,
      cancelled,
      originId: north ? "S02026" : "S02014",
      platform: String(1 + (Math.abs(seed) % 4)),
      departureDateMs: null,
      scheduledMs: t,
    });
    t += (12 + (Math.abs(seed) % 14)) * 60_000;
  }

  return departures;
}

export function demoArrivals(stationKey: string, now: number = Date.now()): TrainArrival[] {
  const origins = ["BRENNERO", "INNSBRUCK HBF", "BOLZANO", "MERANO", "VERONA PORTA NUOVA"];
  const arrivals: TrainArrival[] = [];
  let t = now + 6 * 60_000;
  for (let i = 0; i < 8; i++) {
    const seed = Math.floor(t / (30 * 60_000)) + i + 3;
    const delay = seededDelay(seed);
    arrivals.push({
      trainNumber: trainNumberFromSeed(seed, i % 2 === 0),
      category: seed % 5 === 0 ? "EC" : seed % 4 === 0 ? "RV" : "REG",
      origin: origins[Math.abs(seed) % origins.length],
      scheduledTime: fmtTime(t),
      delayMinutes: delay,
      cancelled: false,
      originId: "S02026",
      departureDateMs: null,
      scheduledMs: t,
    });
    t += (12 + (Math.abs(seed) % 14)) * 60_000;
  }
  return arrivals;
}

export function demoCorridor(
  from: string,
  to: string,
  now: number = Date.now()
): CorridorTrain[] {
  const north = from === "BOLZANO";
  const dests = north
    ? ["BRENNERO", "INNSBRUCK HBF", "BRESSANONE", "FORTEZZA"]
    : ["BOLZANO", "VERONA PORTA NUOVA", "TRENTO", "BOLOGNA C.LE"];
  const trains: CorridorTrain[] = [];
  let t = now + 5 * 60_000;
  for (let i = 0; i < 6; i++) {
    const seed = Math.floor(t / (30 * 60_000)) + i;
    const delay = seededDelay(seed);
    const cancelled = i === 3;
    const travelMs = (33 + (Math.abs(seed) % 6)) * 60_000;
    const arrMs = t + travelMs;
    trains.push({
      trainNumber: trainNumberFromSeed(seed, north),
      category: seed % 5 === 0 ? "EC" : seed % 4 === 0 ? "RV" : "REG",
      destination: dests[Math.abs(seed) % dests.length],
      depScheduled: fmtTime(t),
      depEstimated: delay > 0 && !cancelled ? fmtTime(t + delay * 60_000) : null,
      depScheduledMs: t,
      depDelay: cancelled ? 0 : delay,
      arrScheduled: fmtTime(arrMs),
      arrPredicted: cancelled ? null : fmtTime(arrMs + delay * 60_000),
      arrDelay: cancelled ? 0 : delay,
      cancelled,
      platform: String(1 + (Math.abs(seed) % 4)),
      originId: north ? "S02026" : "S02014",
      departureDateMs: null,
    });
    t += (16 + (Math.abs(seed) % 12)) * 60_000;
  }
  return trains;
}

export function demoTrainStatus(trainNumber: string, now: number = Date.now()): TrainStatus {
  const line = getLine("brenner");
  const corridorKeys = line.stationKeys.slice(
    line.stationKeys.indexOf("BZ"),
    line.stationKeys.indexOf("BX") + 1
  );
  const north = Number(trainNumber) % 2 === 1;
  const keys = north ? corridorKeys : [...corridorKeys].reverse();
  const delay = seededDelay(Number(trainNumber));
  const start = now - 18 * 60_000;

  return {
    trainNumber,
    category: "REG",
    origin: north ? "Bolzano/Bozen" : "Bressanone/Brixen",
    destination: north ? "BRENNERO" : "BOLZANO",
    delayMinutes: delay,
    cancelled: false,
    lastSeenAt: NET_STATIONS[keys[3]].name,
    stops: keys.map((key, i) => {
      const sched = start + i * 5.5 * 60_000;
      const passed = sched + delay * 60_000 < now;
      return {
        stationName: NET_STATIONS[key].name.toUpperCase(),
        stationId: NET_STATIONS[key].id ?? key,
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

export function demoReliability(
  days: number = 30,
  train?: string | null,
  now: number = Date.now()
) {
  // Daily avg corridor arrival delay for the chosen window
  const daily = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000);
    const weekday = d.getDay();
    const base = weekday === 1 ? 9 : weekday === 0 || weekday === 6 ? 2 : 5;
    const wobble = Math.abs(Math.sin(i * 2.7)) * 6;
    daily.push({
      date: d.toISOString().slice(0, 10),
      avgDelay: Math.round(base + wobble),
      runs: 14 + (i % 4),
    });
  }

  // Deterministic corridor trains, both directions
  const SCHED: [string, string][] = [
    ["06:31", "07:09"],
    ["07:02", "07:38"],
    ["07:51", "08:24"],
    ["08:33", "09:11"],
    ["12:08", "12:46"],
    ["16:39", "17:18"],
    ["17:32", "18:09"],
    ["18:41", "19:19"],
  ];
  const AVG = [22, 14, 9, 7, 6, 4, 3, 1, 12, 5, 2, 0];
  const entries = Array.from({ length: 12 }, (_, i) => {
    const nb = i % 2 === 0;
    const avg = AVG[i];
    const runs = 18 + (i % 6) * 3;
    const [dep, arr] = SCHED[i % SCHED.length];
    const cancelledCount = i === 1 ? 3 : i === 5 ? 1 : 0;
    return {
      trainNumber: trainNumberFromSeed(i * 11 + 5, nb),
      category: i % 6 === 0 ? "EC" : i % 4 === 0 ? "RV" : "REG",
      direction: nb ? "NB" : "SB",
      origin: nb ? "Bozen" : "Brixen",
      destination: nb ? "Brixen" : "Bozen",
      schedDep: dep,
      schedArr: arr,
      runs,
      avgArrDelay: avg,
      maxArrDelay: avg * 3 + 4,
      avgDepDelay: Math.max(0, avg - 2),
      onTimePct: Math.max(15, 100 - avg * 4),
      cancelledCount,
    };
  }).sort(
    (a, b) => b.avgArrDelay + b.cancelledCount * 5 - (a.avgArrDelay + a.cancelledCount * 5)
  );

  // Single-train lookup (map detail / inline badge): synthesize a deterministic
  // entry for ANY train number so the demo always shows something.
  if (train) {
    const found = entries.find((e) => e.trainNumber === train);
    if (found) return { entries: [found], daily, days };
    const avg = demoExpectedDelay(train);
    const nb = Number(train) % 2 === 1;
    return {
      entries: [
        {
          trainNumber: train,
          category: "",
          direction: nb ? "NB" : "SB",
          origin: nb ? "Bozen" : "Brixen",
          destination: nb ? "Brixen" : "Bozen",
          schedDep: null,
          schedArr: null,
          runs: 24,
          avgArrDelay: avg,
          maxArrDelay: avg * 3 + 4,
          avgDepDelay: Math.max(0, avg - 1),
          onTimePct: Math.max(15, 100 - avg * 4),
          cancelledCount: 0,
        },
      ],
      daily,
      days,
    };
  }

  return { entries, daily, days };
}
