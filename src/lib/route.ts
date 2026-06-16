import { TrainStatus, TrainStop } from "./trenitalia";

// ---------------------------------------------------------------------------
// South Tyrol rail network, metro-map style.
// Stations carry fixed map coordinates (viewBox 0 0 390 640); lines are
// ordered station-key lists. Train positions interpolate along the chords
// between stations, so server (position math) and client (rendering) agree
// exactly without any SVG path-length measuring.
// ---------------------------------------------------------------------------

export type LineId = "brenner" | "pustertal" | "meran";

export interface NetStation {
  key: string;
  name: string; // German display name
  x: number;
  y: number;
  major: boolean;
  match: string[]; // tokens matched against Viaggiatreno stop names
  id?: string; // Viaggiatreno station id (S0xxxx); enables departure/arrival lookups
  label?: [dx: number, dy: number, anchor: "start" | "middle" | "end"];
}

export const NET_STATIONS: Record<string, NetStation> = {
  // Brenner axis, south to north
  SAL: { key: "SAL", name: "Salurn", x: 132, y: 612, major: false, match: ["SALORNO"], id: "S02034", label: [-10, 4, "end"] },
  EGN: { key: "EGN", name: "Neumarkt", x: 140, y: 580, major: false, match: ["EGNA"], id: "S02032" },
  AUE: { key: "AUE", name: "Auer", x: 146, y: 552, major: false, match: ["ORA"], id: "S02031" },
  BRA: { key: "BRA", name: "Branzoll", x: 150, y: 524, major: false, match: ["BRONZOLO"], id: "S02030" },
  LEI: { key: "LEI", name: "Leifers", x: 153, y: 498, major: false, match: ["LAIVES"], id: "S02029" },
  BZ: { key: "BZ", name: "Bozen", x: 158, y: 462, major: true, match: ["BOLZANO", "BOZEN"], id: "S02026", label: [-14, 6, "end"] },
  BL: { key: "BL", name: "Blumau", x: 192, y: 420, major: false, match: ["PRATO ISARCO", "BLUMAU"] },
  AT: { key: "AT", name: "Atzwang", x: 204, y: 390, major: false, match: ["CAMPODAZZO", "ATZWANG"] },
  WB: { key: "WB", name: "Waidbruck", x: 212, y: 356, major: false, match: ["PONTE GARDENA", "WAIDBRUCK"], id: "S02020" },
  KL: { key: "KL", name: "Klausen", x: 220, y: 324, major: false, match: ["CHIUSA", "KLAUSEN"], id: "S02017", label: [-12, 4, "end"] },
  AB: { key: "AB", name: "Albeins", x: 228, y: 286, major: false, match: ["ALBES", "ALBEINS"] },
  BX: { key: "BX", name: "Brixen", x: 234, y: 258, major: true, match: ["BRESSANONE", "BRIXEN"], id: "S02014", label: [14, 4, "start"] },
  FF: { key: "FF", name: "Franzensfeste", x: 226, y: 210, major: true, match: ["FORTEZZA", "FRANZENSFESTE"], id: "S02011", label: [-14, 4, "end"] },
  FRE: { key: "FRE", name: "Freienfeld", x: 208, y: 162, major: false, match: ["CAMPO DI TRENS", "FREIENFELD"], id: "S02007" },
  ST: { key: "ST", name: "Sterzing", x: 198, y: 130, major: false, match: ["VIPITENO", "STERZING"], id: "S02006", label: [-12, 4, "end"] },
  GO: { key: "GO", name: "Gossensass", x: 196, y: 96, major: false, match: ["COLLE ISARCO", "GOSSENSASS"], id: "S02005" },
  BR: { key: "BR", name: "Brenner", x: 200, y: 56, major: true, match: ["BRENNERO", "BRENNER"], id: "S02001", label: [12, 4, "start"] },

  // Pustertal, west to east
  MUE: { key: "MUE", name: "Mühlbach", x: 258, y: 200, major: false, match: ["RIO DI PUSTERIA", "RIO PUSTERIA", "MUHLBACH"], id: "S02102" },
  VIN: { key: "VIN", name: "Vintl", x: 284, y: 192, major: false, match: ["VANDOIES", "VINTL"], id: "S02103" },
  BRU: { key: "BRU", name: "Bruneck", x: 312, y: 180, major: true, match: ["BRUNICO", "BRUNECK"], id: "S02107", label: [0, -12, "middle"] },
  OLA: { key: "OLA", name: "Olang", x: 336, y: 166, major: false, match: ["VALDAORA", "OLANG"], id: "S02110" },
  WEL: { key: "WEL", name: "Welsberg", x: 352, y: 150, major: false, match: ["MONGUELFO", "WELSBERG"], id: "S02111" },
  VLB: { key: "VLB", name: "Niederdorf", x: 362, y: 140, major: false, match: ["VILLABASSA", "NIEDERDORF"], id: "S02112" },
  TOB: { key: "TOB", name: "Toblach", x: 370, y: 130, major: false, match: ["DOBBIACO", "TOBLACH"], id: "S02113" },
  INN: { key: "INN", name: "Innichen", x: 380, y: 116, major: true, match: ["CANDIDO", "INNICHEN", "VERSCIACO"], id: "S02114", label: [-10, -8, "end"] },

  // Meran line, east to west
  TER: { key: "TER", name: "Terlan", x: 120, y: 440, major: false, match: ["TERLANO", "TERLAN"], id: "S02223" },
  VIL: { key: "VIL", name: "Vilpian", x: 98, y: 424, major: false, match: ["VILPIANO", "VILPIAN"], id: "S02222" },
  GAR: { key: "GAR", name: "Gargazon", x: 80, y: 406, major: false, match: ["GARGAZZONE", "GARGAZON"], id: "S02218" },
  LAN: { key: "LAN", name: "Lana", x: 64, y: 384, major: false, match: ["LANA", "POSTAL", "BURGSTALL"], id: "S02219" },
  MER: { key: "MER", name: "Meran", x: 54, y: 356, major: true, match: ["MERANO", "MERAN"], id: "S02216", label: [4, 22, "middle"] },
};

export interface RailLine {
  id: LineId;
  stationKeys: string[];
  fracs: number[]; // cumulative chord-length fraction per station, 0..1
}

function buildLine(id: LineId, stationKeys: string[]): RailLine {
  const pts = stationKeys.map((k) => NET_STATIONS[k]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = cum[cum.length - 1];
  return { id, stationKeys, fracs: cum.map((c) => c / total) };
}

export const LINES: RailLine[] = [
  buildLine("brenner", ["SAL", "EGN", "AUE", "BRA", "LEI", "BZ", "BL", "AT", "WB", "KL", "AB", "BX", "FF", "FRE", "ST", "GO", "BR"]),
  buildLine("pustertal", ["FF", "MUE", "VIN", "BRU", "OLA", "WEL", "VLB", "TOB", "INN"]),
  buildLine("meran", ["BZ", "TER", "VIL", "GAR", "LAN", "MER"]),
];

export function getLine(id: LineId): RailLine {
  return LINES.find((l) => l.id === id)!;
}

// The Bozen–Brixen home corridor, highlighted on the map
export const CORRIDOR_KEYS = ["BZ", "BL", "AT", "WB", "KL", "AB", "BX"];

const brennerLine = () => LINES.find((l) => l.id === "brenner")!;

export function corridorFracRange(): [number, number] {
  const line = brennerLine();
  return [
    line.fracs[line.stationKeys.indexOf("BZ")],
    line.fracs[line.stationKeys.indexOf("BX")],
  ];
}

export function isOnCorridor(lineId: LineId, frac: number): boolean {
  if (lineId !== "brenner") return false;
  const [lo, hi] = corridorFracRange();
  return frac >= lo - 0.005 && frac <= hi + 0.005;
}

// Heuristic corridor check from run endpoint names, for trains where the
// stop list is unavailable (e.g. cancelled before departure)
const NORTH_ENDPOINTS = ["BRESSANONE", "BRIXEN", "FORTEZZA", "VIPITENO", "BRENNERO", "INNSBRUCK", "MONACO", "MUNCHEN", "MÜNCHEN", "LIENZ", "CANDIDO", "DOBBIACO", "BRUNICO"];
const SOUTH_ENDPOINTS = ["BOLZANO", "BOZEN", "MERANO", "TRENTO", "ROVERETO", "ALA", "VERONA", "BOLOGNA", "MILANO", "VENEZIA", "ROMA", "ANCONA", "NAPOLI", "SIBARI"];

export function crossesCorridorByName(origin: string, destination: string): boolean {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  const oNorth = NORTH_ENDPOINTS.some((k) => o.includes(k));
  const oSouth = SOUTH_ENDPOINTS.some((k) => o.includes(k));
  const dNorth = NORTH_ENDPOINTS.some((k) => d.includes(k));
  const dSouth = SOUTH_ENDPOINTS.some((k) => d.includes(k));
  return (oNorth && dSouth) || (oSouth && dNorth);
}

export function pointOnLine(lineId: LineId, frac: number): { x: number; y: number; angle: number } {
  const line = getLine(lineId);
  const f = Math.min(1, Math.max(0, frac));
  let i = line.fracs.findIndex((lf, idx) => idx < line.fracs.length - 1 && f >= lf && f <= line.fracs[idx + 1]);
  if (i === -1) i = f <= 0 ? 0 : line.fracs.length - 2;
  const a = NET_STATIONS[line.stationKeys[i]];
  const b = NET_STATIONS[line.stationKeys[i + 1]];
  const span = line.fracs[i + 1] - line.fracs[i];
  const t = span > 0 ? (f - line.fracs[i]) / span : 0;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
  };
}

// --- Station-name matching -------------------------------------------------

const ALL_STATIONS = Object.values(NET_STATIONS);

export function matchNetStation(stopName: string): NetStation | null {
  const upper = stopName.toUpperCase().trim();
  let best: NetStation | null = null;
  let bestScore = 0;
  for (const st of ALL_STATIONS) {
    for (const token of st.match) {
      let score = 0;
      if (upper === token) score = 1000 + token.length;
      else if (upper.startsWith(token)) score = 500 + token.length;
      else if (upper.includes(token)) score = token.length;
      if (score > bestScore) {
        bestScore = score;
        best = st;
      }
    }
  }
  return best;
}

// --- Live position ---------------------------------------------------------

export interface LiveTrain {
  trainNumber: string;
  category: string;
  destination: string;
  delayMinutes: number;
  lineId: LineId;
  frac: number;
  heading: 1 | -1; // 1 = toward the last station of the line array
  atStation: string | null;
  nextStation: string | null;
  lastSeenAt: string | null;
  // Identifiers needed to fetch the full run (andamentoTreno) on demand
  originId: string;
  departureDateMs: number;
}

type PosState = "moving" | "dwell" | "waiting" | "linger";
const STATE_PRIORITY: Record<PosState, number> = { moving: 4, dwell: 3, waiting: 2, linger: 1 };

export interface NetPosition {
  lineId: LineId;
  frac: number;
  heading: 1 | -1;
  atStation: string | null;
  nextStation: string | null;
}

const WAIT_BEFORE_MS = 8 * 60_000;
const LINGER_AFTER_MS = 4 * 60_000;

interface MatchedStop {
  station: NetStation;
  lineIdx: number;
  stop: TrainStop;
}

function effTimes(m: MatchedStop, delayMs: number, isFirst: boolean) {
  const dep = m.stop.actDepMs ?? (m.stop.schedDepMs != null ? m.stop.schedDepMs + delayMs : null);
  let arr = m.stop.actArrMs ?? (m.stop.schedArrMs != null ? m.stop.schedArrMs + delayMs : null);
  if (arr == null && isFirst && dep != null) arr = dep - 30_000;
  return { arr, dep: dep ?? arr };
}

function positionOnLine(
  line: RailLine,
  stops: { station: NetStation; stop: TrainStop }[],
  delayMs: number,
  now: number
): { pos: NetPosition; state: PosState } | null {
  const matched: MatchedStop[] = [];
  for (const s of stops) {
    const lineIdx = line.stationKeys.indexOf(s.station.key);
    if (lineIdx !== -1) matched.push({ station: s.station, lineIdx, stop: s.stop });
  }
  if (matched.length < 2) return null;

  // Require strictly monotonic travel along this line
  const increasing = matched[1].lineIdx > matched[0].lineIdx;
  for (let i = 1; i < matched.length; i++) {
    if (increasing !== matched[i].lineIdx > matched[i - 1].lineIdx) return null;
  }
  const heading: 1 | -1 = increasing ? 1 : -1;
  const fracOf = (m: MatchedStop) => line.fracs[m.lineIdx];

  const make = (frac: number, atStation: string | null, state: PosState) => ({
    pos: { lineId: line.id, frac, heading, atStation, nextStation: null },
    state,
  });

  const first = effTimes(matched[0], delayMs, true);
  const last = effTimes(matched[matched.length - 1], delayMs, false);

  if (first.dep != null && now < first.dep) {
    if ((first.arr == null || now < first.arr) && first.dep - now <= WAIT_BEFORE_MS) {
      return make(fracOf(matched[0]), matched[0].station.name, "waiting");
    }
    if (first.arr != null && now >= first.arr) {
      return make(fracOf(matched[0]), matched[0].station.name, "dwell");
    }
    return null;
  }

  if (last.arr != null && now > last.arr) {
    if (now - last.arr <= LINGER_AFTER_MS) {
      return make(fracOf(matched[matched.length - 1]), matched[matched.length - 1].station.name, "linger");
    }
    return null;
  }

  for (let i = 0; i < matched.length; i++) {
    const t = effTimes(matched[i], delayMs, i === 0);
    if (t.arr != null && t.dep != null && now >= t.arr && now <= t.dep) {
      return make(fracOf(matched[i]), matched[i].station.name, "dwell");
    }
    if (i < matched.length - 1 && t.dep != null) {
      const next = effTimes(matched[i + 1], delayMs, false);
      if (next.arr != null && now > t.dep && now < next.arr && next.arr > t.dep) {
        const p = (now - t.dep) / (next.arr - t.dep);
        const frac = fracOf(matched[i]) + (fracOf(matched[i + 1]) - fracOf(matched[i])) * p;
        return make(frac, null, "moving");
      }
    }
  }

  return null;
}

export function computeNetworkPosition(status: TrainStatus, now: number = Date.now()): NetPosition | null {
  const delayMs = status.delayMinutes * 60_000;

  const stops = status.stops
    .map((stop) => ({ station: matchNetStation(stop.stationName), stop }))
    .filter((s): s is { station: NetStation; stop: TrainStop } => s.station !== null);

  if (stops.length < 2) return null;

  let best: { pos: NetPosition; state: PosState } | null = null;
  for (const line of LINES) {
    const candidate = positionOnLine(line, stops, delayMs, now);
    if (candidate && (!best || STATE_PRIORITY[candidate.state] > STATE_PRIORITY[best.state])) {
      best = candidate;
    }
  }
  if (!best) return null;

  // Next stop from the train's own stop list (more accurate than line geometry)
  const upcoming = stops.find(({ stop }) => {
    const arr = stop.actArrMs ?? (stop.schedArrMs != null ? stop.schedArrMs + delayMs : null);
    return arr != null && arr > now;
  });
  best.pos.nextStation = upcoming?.station.name ?? null;

  return best.pos;
}
