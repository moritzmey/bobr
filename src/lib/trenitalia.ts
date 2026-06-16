const BASE = "https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno";

// Identify ourselves politely so RFI ops can distinguish this from abuse
const FETCH_OPTS = {
  headers: {
    "User-Agent": "BOBR/1.0 (private non-commercial train punctuality project; +https://bobr.meyermoritz.com/impressum)",
  },
};

export const STATIONS = {
  BOLZANO: { id: "S02026", name: "Bolzano/Bozen" },
  BRESSANONE: { id: "S02014", name: "Bressanone/Brixen" },
  FORTEZZA: { id: "S02011", name: "Fortezza/Franzensfeste" },
  MERANO: { id: "S02216", name: "Merano/Meran" },
  BRUNICO: { id: "S02107", name: "Brunico/Bruneck" },
} as const;

export type StationKey = keyof typeof STATIONS;

export interface TrainDeparture {
  trainNumber: string;
  category: string;
  destination: string;
  scheduledTime: string;
  estimatedTime: string | null;
  delayMinutes: number;
  cancelled: boolean;
  originId: string;
  platform: string | null;
  departureDateMs: number | null;
  scheduledMs: number | null; // epoch ms of the scheduled departure
}

export interface TrainArrival {
  trainNumber: string;
  category: string;
  origin: string;
  scheduledTime: string;
  delayMinutes: number;
  cancelled: boolean;
  originId: string;
  departureDateMs: number | null;
  scheduledMs: number | null; // epoch ms of the scheduled arrival
}

export interface TrainStatus {
  trainNumber: string;
  category: string;
  origin: string;
  destination: string;
  delayMinutes: number;
  cancelled: boolean;
  lastSeenAt: string | null;
  stops: TrainStop[];
}

export interface TrainStop {
  stationName: string;
  stationId: string; // Viaggiatreno station id (S0xxxx) from the run's stop list
  scheduledArrival: string | null;
  actualArrival: string | null;
  scheduledDeparture: string | null;
  actualDeparture: string | null;
  delayMinutes: number;
  // Raw epoch-ms values, used for live position interpolation
  schedArrMs: number | null;
  actArrMs: number | null;
  schedDepMs: number | null;
  actDepMs: number | null;
}

function parseTime(ts: number | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

// Viaggiatreno expects a JS Date.toString()-style timestamp in Italian local time,
// e.g. "Fri Jun 12 2026 13:05:00 GMT+0200"
function romeDateString(now: Date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const offset =
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", timeZoneName: "longOffset" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT+02:00";
  return `${parts.weekday} ${parts.month} ${parts.day} ${parts.year} ${parts.hour}:${parts.minute}:${parts.second} ${offset.replace(":", "")}`;
}

// Raw Viaggiatreno departure shape (partial)
interface RawDeparture {
  numeroTreno: number;
  categoriaDescrizione: string;
  destinazione: string;
  orarioPartenza: number;
  compOrarioPartenzaZeroEffettivo: string;
  ritardo: number;
  provvedimento: number;
  codOrigine: string;
  binarioProgrammatoPartenzaDescrizione: string | null;
  dataPartenzaTreno: number | null;
}

interface RawArrival {
  numeroTreno: number;
  categoriaDescrizione: string;
  origine: string;
  orarioArrivo: number;
  ritardo: number;
  provvedimento: number;
  codOrigine: string;
  dataPartenzaTreno: number | null;
}

export async function fetchDepartures(
  stationId: string,
  whenMs?: number
): Promise<TrainDeparture[]> {
  const when = whenMs != null ? new Date(whenMs) : new Date();
  const url = `${BASE}/partenze/${stationId}/${encodeURIComponent(romeDateString(when))}`;
  const res = await fetch(url, { ...FETCH_OPTS, next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Trenitalia API error: ${res.status}`);

  const data: RawDeparture[] = await res.json();

  return data.map((t) => ({
    trainNumber: String(t.numeroTreno),
    category: (t.categoriaDescrizione || "R").trim(),
    destination: t.destinazione || "",
    scheduledTime: parseTime(t.orarioPartenza) ?? "",
    estimatedTime: t.compOrarioPartenzaZeroEffettivo || null,
    delayMinutes: Math.max(0, t.ritardo || 0),
    cancelled: t.provvedimento === 1,
    originId: t.codOrigine || stationId,
    platform: t.binarioProgrammatoPartenzaDescrizione || null,
    departureDateMs: t.dataPartenzaTreno ?? null,
    scheduledMs: t.orarioPartenza ?? null,
  }));
}

export async function fetchArrivals(
  stationId: string,
  whenMs?: number
): Promise<TrainArrival[]> {
  const when = whenMs != null ? new Date(whenMs) : new Date();
  const url = `${BASE}/arrivi/${stationId}/${encodeURIComponent(romeDateString(when))}`;
  const res = await fetch(url, { ...FETCH_OPTS, next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Trenitalia API error: ${res.status}`);

  const data: RawArrival[] = await res.json();

  return data.map((t) => ({
    trainNumber: String(t.numeroTreno),
    category: (t.categoriaDescrizione || "R").trim(),
    origin: t.origine || "",
    scheduledTime: parseTime(t.orarioArrivo) ?? "",
    delayMinutes: Math.max(0, t.ritardo || 0),
    cancelled: t.provvedimento === 1,
    originId: t.codOrigine || "",
    departureDateMs: t.dataPartenzaTreno ?? null,
    scheduledMs: t.orarioArrivo ?? null,
  }));
}

interface RawStop {
  stazione: string;
  id: string;
  programmata: number | null;
  effettiva: number | null;
  arrivo_teorico: number | null;
  arrivoReale: number | null;
  partenza_teorica: number | null;
  partenzaReale: number | null;
  ritardo: number;
  ritardoPartenza: number;
}

interface RawTrainStatus {
  numeroTreno: number;
  categoriaDescrizione: string;
  origine: string;
  destinazione: string;
  ritardo: number;
  provvedimento: number;
  stazioneUltimoRilevamento: string | null;
  fermate: RawStop[];
}

export async function fetchTrainStatus(
  originId: string,
  trainNumber: string,
  departureDate: string
): Promise<TrainStatus> {
  const url = `${BASE}/andamentoTreno/${originId}/${trainNumber}/${departureDate}`;
  const res = await fetch(url, { ...FETCH_OPTS, next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Trenitalia API error: ${res.status}`);

  const d: RawTrainStatus = await res.json();

  return {
    trainNumber: String(d.numeroTreno),
    category: (d.categoriaDescrizione || "R").trim(),
    origin: d.origine || "",
    destination: d.destinazione || "",
    delayMinutes: Math.max(0, d.ritardo || 0),
    cancelled: d.provvedimento === 1,
    lastSeenAt: d.stazioneUltimoRilevamento || null,
    stops: (d.fermate || []).map((s) => ({
      stationName: s.stazione,
      stationId: s.id,
      scheduledArrival: parseTime(s.programmata),
      actualArrival: parseTime(s.effettiva),
      scheduledDeparture: parseTime(s.partenza_teorica),
      actualDeparture: parseTime(s.partenzaReale),
      delayMinutes: Math.max(0, s.ritardoPartenza ?? s.ritardo ?? 0),
      schedArrMs: s.arrivo_teorico ?? s.programmata ?? null,
      actArrMs: s.arrivoReale ?? s.effettiva ?? null,
      schedDepMs: s.partenza_teorica ?? null,
      actDepMs: s.partenzaReale ?? null,
    })),
  };
}

export interface CorridorTrain {
  trainNumber: string;
  category: string;
  destination: string; // final run destination
  depScheduled: string;
  depEstimated: string | null;
  depScheduledMs: number | null;
  depDelay: number;
  arrScheduled: string;
  arrPredicted: string | null;
  arrDelay: number;
  cancelled: boolean;
  platform: string | null;
  originId: string;
  departureDateMs: number | null;
}

const TWO_HOURS_MS = 2 * 60 * 60_000;

// Trains that genuinely travel `fromId` → `toId`: a run departing the origin and
// arriving at the destination shares its train number across both boards. Two
// board calls (instead of N andamentoTreno lookups) keep upstream load low.
export async function fetchCorridorTrains(
  fromId: string,
  toId: string,
  whenMs: number = Date.now()
): Promise<CorridorTrain[]> {
  const [departures, arrivals] = await Promise.all([
    fetchDepartures(fromId, whenMs),
    fetchArrivals(toId, whenMs),
  ]);

  const arrivalByNumber = new Map(arrivals.map((a) => [a.trainNumber, a]));
  const windowEnd = whenMs + TWO_HOURS_MS;

  return departures
    .filter((d) => arrivalByNumber.has(d.trainNumber))
    .filter((d) => d.scheduledMs == null || (d.scheduledMs >= whenMs - 60_000 && d.scheduledMs <= windowEnd))
    .filter((d) => {
      // The same train number can call at both stations while heading the other
      // way (e.g. a northbound run stops at the origin *after* the destination).
      // Keep only runs whose destination arrival is after the origin departure.
      const a = arrivalByNumber.get(d.trainNumber)!;
      return d.scheduledMs == null || a.scheduledMs == null || a.scheduledMs > d.scheduledMs;
    })
    .map((d) => {
      const a = arrivalByNumber.get(d.trainNumber)!;
      const arrPredicted =
        a.scheduledMs != null ? parseTime(a.scheduledMs + a.delayMinutes * 60_000) : null;
      return {
        trainNumber: d.trainNumber,
        category: d.category,
        destination: d.destination,
        depScheduled: d.scheduledTime,
        depEstimated: d.estimatedTime,
        depScheduledMs: d.scheduledMs,
        depDelay: d.delayMinutes,
        arrScheduled: a.scheduledTime,
        arrPredicted,
        arrDelay: a.delayMinutes,
        cancelled: d.cancelled || a.cancelled,
        platform: d.platform,
        originId: d.originId,
        departureDateMs: d.departureDateMs,
      };
    })
    .sort((x, y) => (x.depScheduledMs ?? 0) - (y.depScheduledMs ?? 0));
}

export async function resolveTrainOrigin(trainNumber: string): Promise<string | null> {
  const url = `${BASE}/cercaNumeroTrenoTrenoAutocomplete/${trainNumber}`;
  const res = await fetch(url, { ...FETCH_OPTS, next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const text = await res.text();
  // Response format: "R 12345 - ORIGIN|ORIGIN_ID-12345\n"
  const match = text.match(/\|([^-\n]+)-\d+/);
  return match ? match[1] : null;
}
