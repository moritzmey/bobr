const BASE = "https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno";

export const STATIONS = {
  BOLZANO: { id: "S00219", name: "Bolzano/Bozen" },
  BRESSANONE: { id: "S00269", name: "Bressanone/Brixen" },
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
  scheduledArrival: string | null;
  actualArrival: string | null;
  scheduledDeparture: string | null;
  actualDeparture: string | null;
  delayMinutes: number;
}

function parseTime(ts: number | null): string | null {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
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
}

export async function fetchDepartures(stationId: string): Promise<TrainDeparture[]> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:00`;

  const url = `${BASE}/partenze/${stationId}/${encodeURIComponent(dateStr)}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Trenitalia API error: ${res.status}`);

  const data: RawDeparture[] = await res.json();

  return data
    .filter((t) => {
      // Only include trains that stop at both Bolzano and Bressanone
      // We filter by destination or rely on the direction filter in the UI
      return true;
    })
    .map((t) => ({
      trainNumber: String(t.numeroTreno),
      category: (t.categoriaDescrizione || "R").trim(),
      destination: t.destinazione || "",
      scheduledTime: parseTime(t.orarioPartenza) ?? "",
      estimatedTime: t.compOrarioPartenzaZeroEffettivo || null,
      delayMinutes: Math.max(0, t.ritardo || 0),
      cancelled: t.provvedimento === 1,
      originId: t.codOrigine || stationId,
      platform: t.binarioProgrammatoPartenzaDescrizione || null,
    }));
}

interface RawStop {
  stazione: string;
  id: string;
  programmata: number | null;
  effettiva: number | null;
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
  const res = await fetch(url, { next: { revalidate: 30 } });
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
      scheduledArrival: parseTime(s.programmata),
      actualArrival: parseTime(s.effettiva),
      scheduledDeparture: parseTime(s.partenza_teorica),
      actualDeparture: parseTime(s.partenzaReale),
      delayMinutes: Math.max(0, s.ritardoPartenza ?? s.ritardo ?? 0),
    })),
  };
}

export async function resolveTrainOrigin(trainNumber: string): Promise<string | null> {
  const url = `${BASE}/cercaNumeroTrenoTrenoAutocomplete/${trainNumber}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const text = await res.text();
  // Response format: "R 12345 - ORIGIN|ORIGIN_ID-12345\n"
  const match = text.match(/\|([^-\n]+)-\d+/);
  return match ? match[1] : null;
}
