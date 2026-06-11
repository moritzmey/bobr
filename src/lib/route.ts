import { TrainStatus } from "./trenitalia";

export interface CorridorStation {
  key: string;
  name: string; // German
  nameIt: string; // Italian
  frac: number; // position along the rail line, 0 = Bozen, 1 = Brixen
  major: boolean;
  match: string[]; // uppercase tokens matched against Viaggiatreno station names
}

// Stations of the Brenner line through the Eisack valley, fractions
// roughly proportional to real rail distance (~40 km total)
export const CORRIDOR: CorridorStation[] = [
  { key: "BZ", name: "Bozen", nameIt: "Bolzano", frac: 0, major: true, match: ["BOLZANO", "BOZEN"] },
  { key: "BL", name: "Blumau", nameIt: "Prato Isarco", frac: 0.22, major: false, match: ["PRATO ISARCO", "BLUMAU"] },
  { key: "AT", name: "Atzwang", nameIt: "Campodazzo", frac: 0.38, major: false, match: ["CAMPODAZZO", "ATZWANG"] },
  { key: "WB", name: "Waidbruck", nameIt: "Ponte Gardena", frac: 0.58, major: false, match: ["PONTE GARDENA", "WAIDBRUCK"] },
  { key: "KL", name: "Klausen", nameIt: "Chiusa", frac: 0.72, major: true, match: ["CHIUSA", "KLAUSEN"] },
  { key: "AB", name: "Albeins", nameIt: "Albes", frac: 0.88, major: false, match: ["ALBES", "ALBEINS"] },
  { key: "BX", name: "Brixen", nameIt: "Bressanone", frac: 1, major: true, match: ["BRESSANONE", "BRIXEN"] },
];

export type Direction = "north" | "south";

export interface LiveTrain {
  trainNumber: string;
  category: string;
  destination: string;
  delayMinutes: number;
  direction: Direction;
  frac: number;
  atStation: string | null;
  nextStation: string | null;
  lastSeenAt: string | null;
}

export interface CorridorPosition {
  frac: number;
  direction: Direction;
  atStation: string | null;
  nextStation: string | null;
}

export function matchCorridorStation(stationName: string): CorridorStation | null {
  const upper = stationName.toUpperCase();
  return CORRIDOR.find((cs) => cs.match.some((m) => upper.includes(m))) ?? null;
}

export function nextStationFromFrac(frac: number, direction: Direction): string | null {
  if (direction === "north") {
    const next = CORRIDOR.find((cs) => cs.major && cs.frac > frac + 0.01);
    return next?.name ?? null;
  }
  const next = [...CORRIDOR].reverse().find((cs) => cs.major && cs.frac < frac - 0.01);
  return next?.name ?? null;
}

// Margins for showing trains waiting at / just arrived at corridor endpoints
const WAIT_BEFORE_MS = 8 * 60_000;
const LINGER_AFTER_MS = 4 * 60_000;

/**
 * Estimates where a train currently is on the Bozen–Brixen corridor by
 * interpolating between effective (actual or delay-adjusted scheduled)
 * stop times. Returns null when the train is not currently on the corridor.
 */
export function computeCorridorPosition(
  status: TrainStatus,
  now: number = Date.now()
): CorridorPosition | null {
  const delayMs = status.delayMinutes * 60_000;

  // Corridor stops in travel order
  const matched = status.stops
    .map((stop) => ({ cs: matchCorridorStation(stop.stationName), stop }))
    .filter((m): m is { cs: CorridorStation; stop: (typeof status.stops)[number] } => m.cs !== null);

  if (matched.length < 2) return null;

  const direction: Direction = matched[0].cs.frac < matched[matched.length - 1].cs.frac ? "north" : "south";

  const effDep = (i: number): number | null => {
    const s = matched[i].stop;
    if (s.actDepMs != null) return s.actDepMs;
    if (s.schedDepMs != null) return s.schedDepMs + delayMs;
    return null;
  };
  const effArr = (i: number): number | null => {
    const s = matched[i].stop;
    if (s.actArrMs != null) return s.actArrMs;
    if (s.schedArrMs != null) return s.schedArrMs + delayMs;
    // Origin station has no arrival; treat as just before departure
    const dep = effDep(i);
    return dep != null ? dep - 30_000 : null;
  };

  const position = (frac: number, atStation: string | null): CorridorPosition => ({
    frac,
    direction,
    atStation,
    nextStation: nextStationFromFrac(frac, direction),
  });

  const firstDep = effDep(0) ?? effArr(0);
  const lastArr = effArr(matched.length - 1);

  // Not yet entered the corridor
  if (firstDep != null && now < firstDep) {
    if (firstDep - now <= WAIT_BEFORE_MS) {
      return position(matched[0].cs.frac, matched[0].cs.name);
    }
    return null;
  }

  // Already left the corridor
  if (lastArr != null && now > lastArr) {
    if (now - lastArr <= LINGER_AFTER_MS) {
      return position(matched[matched.length - 1].cs.frac, matched[matched.length - 1].cs.name);
    }
    return null;
  }

  for (let i = 0; i < matched.length; i++) {
    const arr = effArr(i);
    const dep = effDep(i) ?? arr;

    // Dwelling at a station
    if (arr != null && dep != null && now >= arr && now <= dep) {
      return position(matched[i].cs.frac, matched[i].cs.name);
    }

    // Between this stop and the next
    if (i < matched.length - 1 && dep != null) {
      const nextArr = effArr(i + 1);
      if (nextArr != null && now > dep && now < nextArr && nextArr > dep) {
        const t = (now - dep) / (nextArr - dep);
        const frac = matched[i].cs.frac + (matched[i + 1].cs.frac - matched[i].cs.frac) * t;
        return position(frac, null);
      }
    }
  }

  return null;
}
