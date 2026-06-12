import { TrainDeparture, TrainStatus } from "./trenitalia";
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
    });
    t += (12 + (Math.abs(seed) % 14)) * 60_000;
  }

  return departures;
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

  // Corridor-crossing routes only (display scope is Bozen–Brixen)
  const routes = [
    ["Bolzano", "Brennero"],
    ["Merano", "Brennero"],
    ["Brennero", "Merano"],
    ["Bolzano", "Bressanone"],
    ["Bressanone", "Verona Porta Nuova"],
  ];

  const trains = Array.from({ length: 10 }, (_, i) => {
    const seed = i * 7 + 3;
    const avgDelay = [1, 17, 3, 8, 2, 12, 5, 0, 22, 6][i];
    const [o, d] = routes[i % routes.length];
    return {
      trainNumber: trainNumberFromSeed(seed, i % 2 === 0),
      category: i % 5 === 0 ? "EC" : i % 4 === 0 ? "RV" : "REG",
      route: `${o} → ${d}`,
      totalRecorded: 140 + i * 11,
      onTimePercent: Math.max(20, 96 - avgDelay * 3 - (i % 3) * 4),
      avgDelay,
      cancelledCount: avgDelay > 15 ? 4 : avgDelay > 8 ? 1 : 0,
    };
  });

  return { trains, daily };
}

export function demoLeaderboard() {
  // Corridor-crossing routes only (display scope is Bozen–Brixen)
  const routes: [string, string, string, string][] = [
    ["Brennero", "Merano", "06:37", "08:23"],
    ["Bolzano", "Brennero", "07:02", "08:19"],
    ["Bressanone", "Bolzano", "06:31", "07:09"],
    ["Bressanone", "Verona Porta Nuova", "17:32", "19:05"],
    ["Bolzano", "S.Candido", "12:08", "14:21"],
    ["S.Candido", "Bolzano", "16:39", "18:54"],
    ["Brennero", "Bolzano", "18:41", "19:58"],
    ["Bolzano", "Bressanone", "07:51", "08:24"],
  ];

  return Array.from({ length: 14 }, (_, i) => {
    const [origin, destination, dep, arr] = routes[i % routes.length];
    const avgDelay = [22, 17, 13, 11, 9, 8, 6, 5, 4, 3, 2, 1, 1, 0][i];
    const runs = 24 + (i % 5) * 2;
    const cancelledCount = i === 1 ? 4 : i === 4 ? 1 : 0;
    return {
      trainNumber: trainNumberFromSeed(i * 11 + 5, i % 2 === 0),
      category: i % 6 === 0 ? "EC" : i % 4 === 0 ? "RV" : "REG",
      origin,
      destination,
      schedDep: dep,
      schedArr: arr,
      runs,
      totalDelay: avgDelay * (runs - cancelledCount),
      avgDelay,
      maxDelay: avgDelay * 3 + 5,
      cancelledCount,
    };
  });
}
