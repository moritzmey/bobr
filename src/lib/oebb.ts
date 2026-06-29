// ---------------------------------------------------------------------------
// ÖBB HAFAS data source.
//
// Some trains on the South Tyrol network are *not* published by Viaggiatreno
// (RFI), most notably the SAD-operated cross-border runs that continue into
// Austria as ÖBB regional trains — e.g. R/REX 1826 Trento→Bozen→Brennero→
// Innsbruck, which RFI truncates and simply omits from its real-time feed.
//
// ÖBB's HAFAS backend ("Scotty"/mgate.exe) knows these trains, so we query it
// as a second upstream and merge the results into the boards and the live map.
// Everything here maps the HAFAS shapes onto the same interfaces the rest of
// the app already uses (TrainDeparture / CorridorTrain / TrainStatus), so the
// merge points stay tiny.
//
// Trains that Viaggiatreno already covers (every Italian regional, plus the
// EC/RJ/RJX/NJ which appear in both feeds) are de-duplicated by train number
// at the call sites, with Viaggiatreno winning. In practice the only trains we
// actually add are the cross-border ÖBB ones.
// ---------------------------------------------------------------------------

import { CorridorTrain, TrainStatus, TrainStop, TrainDeparture } from "./trenitalia";
import { computeNetworkPosition, matchNetStation } from "./route";
import type { CollectedTrain } from "./collect";

const ENDPOINT = "https://fahrplan.oebb.at/bin/mgate.exe";

// Public ÖBB webapp client identity. mgate.exe accepts this without a
// request-checksum, exactly as the official web journey planner sends it.
const HAFAS_AUTH = { type: "AID", aid: "OWDL4fE4ixNiPBBm" } as const;
const HAFAS_CLIENT = { id: "OEBB", type: "WEB", name: "webapp", l: "vs_webapp" } as const;

const FETCH_HEADERS = {
  "Content-Type": "application/json",
  // Identify ourselves, same courtesy as the Viaggiatreno client.
  "User-Agent":
    "BOBR/1.0 (private non-commercial train punctuality project; +https://bobr.meyermoritz.com/impressum)",
};

// Network stations, keyed by their Viaggiatreno id (S0xxxx), mapped to the
// matching ÖBB HAFAS station extId. These are the boards we may scan.
export const OEBB_EXT_ID: Record<string, string> = {
  S02026: "8300084", // Bolzano/Bozen
  S02014: "8300076", // Bressanone/Brixen
  S02011: "8300089", // Fortezza/Franzensfeste
  S02216: "8300097", // Merano/Meran
  S02107: "8300077", // Brunico/Bruneck
};

// ---------------------------------------------------------------------------
// HAFAS transport
// ---------------------------------------------------------------------------

interface HafasLoc {
  name: string;
  extId?: string;
}
interface HafasProdInfo {
  number?: string;
  nameS?: string;
  prodCtx?: { catOutS?: string; catOutL?: string; admin?: string; num?: string };
}
interface HafasStbStop {
  locX: number;
  dTimeS?: string;
  dTimeR?: string;
  aTimeS?: string;
  aTimeR?: string;
  dCncl?: boolean;
  aCncl?: boolean;
  // Platform shape varies across HAFAS deployments (string vs object); read defensively.
  dPlatfS?: unknown;
  dPlatfR?: unknown;
}
interface HafasJourneyStop extends HafasStbStop {
  locX: number;
}
interface HafasStbJny {
  jid: string;
  date: string;
  prodX: number;
  dirTxt?: string;
  isCncl?: boolean;
  stbStop: HafasStbStop;
}
interface HafasCommon {
  locL: HafasLoc[];
  prodL: HafasProdInfo[];
}
interface HafasRes {
  common?: HafasCommon;
  jnyL?: HafasStbJny[];
  journey?: { date: string; prodX: number; stopL: HafasJourneyStop[]; isCncl?: boolean };
}

interface MemoEntry {
  t: number;
  v: Promise<HafasRes>;
}
const memo = new Map<string, MemoEntry>();
const MEMO_TTL_MS = 30_000;

// Mirror Viaggiatreno's minute-pinned, ~30s caching so visitor count doesn't
// translate into ÖBB upstream load. Identical requests within the TTL share a
// single in-flight/recent promise; a rejected call is evicted so it can retry.
async function hafas(meth: string, req: Record<string, unknown>, cacheKey: string): Promise<HafasRes> {
  const now = Date.now();
  const hit = memo.get(cacheKey);
  if (hit && now - hit.t < MEMO_TTL_MS) return hit.v;

  const body = {
    ver: "1.34",
    lang: "deu",
    auth: HAFAS_AUTH,
    client: HAFAS_CLIENT,
    svcReqL: [{ req, meth, id: "1|1|" }],
  };

  const promise = (async () => {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: FETCH_HEADERS,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`ÖBB HAFAS error: ${res.status}`);
    const json = (await res.json()) as { svcResL?: { err?: string; res?: HafasRes }[] };
    const svc = json.svcResL?.[0];
    if (!svc || (svc.err && svc.err !== "OK")) throw new Error(`ÖBB HAFAS ${meth}: ${svc?.err ?? "no result"}`);
    return svc.res ?? {};
  })();

  memo.set(cacheKey, { t: now, v: promise });
  promise.catch(() => memo.delete(cacheKey));
  if (memo.size > 64) for (const [k, e] of memo) if (now - e.t > MEMO_TTL_MS) memo.delete(k);
  return promise;
}

// ---------------------------------------------------------------------------
// Time helpers — HAFAS reports wall-clock times in the station's local zone
// (Europe/Rome for our network), optionally prefixed with a day offset, e.g.
// "073200" or "01073200" (= +1 day). We resolve them to epoch ms.
// ---------------------------------------------------------------------------

function tzOffsetMs(utcMs: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Rome",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value])
  );
  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUTC - utcMs;
}

// Interpret a Rome wall-clock time as an epoch-ms instant.
function romeWallClockToMs(y: number, mo: number, d: number, hh: number, mm: number): number {
  let ms = Date.UTC(y, mo - 1, d, hh, mm, 0);
  ms -= tzOffsetMs(ms);
  return ms;
}

function parseHafasTime(baseDate: string | undefined, time: string | undefined): number | null {
  if (!baseDate || !time) return null;
  const digits = time.length > 6 ? time : `00${time}`;
  const dayOffset = Number(digits.slice(0, digits.length - 6));
  const hhmmss = digits.slice(-6);
  const hh = Number(hhmmss.slice(0, 2));
  const mm = Number(hhmmss.slice(2, 4));
  const y = Number(baseDate.slice(0, 4));
  const mo = Number(baseDate.slice(4, 6));
  const d = Number(baseDate.slice(6, 8)) + (Number.isFinite(dayOffset) ? dayOffset : 0);
  return romeWallClockToMs(y, mo, d, hh, mm);
}

function fmtRome(ms: number | null): string | null {
  if (ms == null) return null;
  return new Date(ms).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

function yyyymmddRome(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(ms))
    .replace(/-/g, "");
}

function hhmmssRome(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(new Date(ms))
    .replace(/:/g, "");
}

function category(p: HafasProdInfo | undefined): string {
  return (p?.prodCtx?.catOutS || p?.nameS?.split(" ")[0] || "R").trim();
}

// ---------------------------------------------------------------------------
// Station boards
// ---------------------------------------------------------------------------

interface OebbBoardTrain {
  trainNumber: string;
  category: string;
  dirName: string; // destination (DEP) or origin (ARR)
  schedMs: number | null;
  realMs: number | null;
  delayMinutes: number;
  cancelled: boolean;
  platform: string | null;
  jid: string;
}

async function fetchBoard(
  extId: string,
  type: "DEP" | "ARR",
  whenMs: number,
  maxJny: number
): Promise<OebbBoardTrain[]> {
  const date = yyyymmddRome(whenMs);
  const time = hhmmssRome(whenMs);
  const cacheKey = `board|${type}|${extId}|${date}|${time.slice(0, 4)}`;
  const res = await hafas(
    "StationBoard",
    { type, stbLoc: { type: "S", extId }, maxJny, date, time },
    cacheKey
  );
  const prodL = res.common?.prodL ?? [];
  const locL = res.common?.locL ?? [];

  return (res.jnyL ?? []).map((jny) => {
    const st = jny.stbStop;
    const isDep = type === "DEP";
    const schedMs = parseHafasTime(jny.date, isDep ? st.dTimeS : st.aTimeS);
    const realMs = parseHafasTime(jny.date, isDep ? st.dTimeR : st.aTimeR);
    const prod = prodL[jny.prodX] as HafasProdInfo | undefined;
    const platform =
      typeof st.dPlatfR === "string" ? st.dPlatfR : typeof st.dPlatfS === "string" ? st.dPlatfS : null;
    return {
      trainNumber: String(prod?.prodCtx?.num ?? prod?.number ?? "").trim(),
      category: category(prod),
      dirName: jny.dirTxt || locL[st.locX]?.name || "",
      schedMs,
      realMs,
      delayMinutes:
        schedMs != null && realMs != null ? Math.max(0, Math.round((realMs - schedMs) / 60_000)) : 0,
      cancelled: Boolean(jny.isCncl || st.dCncl || st.aCncl),
      platform,
      jid: jny.jid,
    };
  });
}

// ---------------------------------------------------------------------------
// Corridor board (Bozen ↔ Brixen) — same matching contract as
// trenitalia.fetchCorridorTrains, so results merge cleanly.
// ---------------------------------------------------------------------------

const TWO_HOURS_MS = 2 * 60 * 60_000;

export async function fetchOebbCorridorTrains(
  fromStationId: string,
  toStationId: string,
  whenMs: number = Date.now()
): Promise<CorridorTrain[]> {
  const fromExt = OEBB_EXT_ID[fromStationId];
  const toExt = OEBB_EXT_ID[toStationId];
  if (!fromExt || !toExt) return [];

  const [departures, arrivals] = await Promise.all([
    fetchBoard(fromExt, "DEP", whenMs - 60_000, 40),
    fetchBoard(toExt, "ARR", whenMs - 60_000, 40),
  ]);

  const arrByNumber = new Map(arrivals.map((a) => [a.trainNumber, a]));
  const windowEnd = whenMs + TWO_HOURS_MS;

  return departures
    .filter((d) => d.trainNumber && arrByNumber.has(d.trainNumber))
    .filter((d) => d.schedMs == null || (d.schedMs >= whenMs - 60_000 && d.schedMs <= windowEnd))
    .filter((d) => {
      // Drop runs that call at both stations heading the *other* way.
      const a = arrByNumber.get(d.trainNumber)!;
      return d.schedMs == null || a.schedMs == null || a.schedMs > d.schedMs;
    })
    .map((d) => {
      const a = arrByNumber.get(d.trainNumber)!;
      return {
        trainNumber: d.trainNumber,
        category: d.category,
        destination: d.dirName,
        depScheduled: fmtRome(d.schedMs) ?? "",
        depEstimated: d.realMs != null ? fmtRome(d.realMs) : null,
        depScheduledMs: d.schedMs,
        depDelay: d.delayMinutes,
        arrScheduled: fmtRome(a.schedMs) ?? "",
        arrPredicted: a.realMs != null ? fmtRome(a.realMs) : null,
        arrDelay: a.delayMinutes,
        cancelled: d.cancelled || a.cancelled,
        platform: d.platform,
        originId: "OEBB",
        departureDateMs: d.schedMs,
      } satisfies CorridorTrain;
    })
    .sort((x, y) => (x.depScheduledMs ?? 0) - (y.depScheduledMs ?? 0));
}

// ---------------------------------------------------------------------------
// Journey details → TrainStatus (used for the live map and the click panel)
// ---------------------------------------------------------------------------

function journeyToStatus(res: HafasRes): TrainStatus | null {
  const journey = res.journey;
  if (!journey) return null;
  const locL = res.common?.locL ?? [];
  const prodL = res.common?.prodL ?? [];
  const prod = prodL[journey.prodX] as HafasProdInfo | undefined;

  const stops: TrainStop[] = journey.stopL.map((s) => {
    const schedArr = parseHafasTime(journey.date, s.aTimeS);
    const actArr = parseHafasTime(journey.date, s.aTimeR);
    const schedDep = parseHafasTime(journey.date, s.dTimeS);
    const actDep = parseHafasTime(journey.date, s.dTimeR);
    const delay =
      actDep != null && schedDep != null
        ? Math.round((actDep - schedDep) / 60_000)
        : actArr != null && schedArr != null
        ? Math.round((actArr - schedArr) / 60_000)
        : 0;
    return {
      stationName: locL[s.locX]?.name ?? "",
      stationId: locL[s.locX]?.extId ?? "",
      scheduledArrival: fmtRome(schedArr),
      actualArrival: fmtRome(actArr),
      scheduledDeparture: fmtRome(schedDep),
      actualDeparture: fmtRome(actDep),
      delayMinutes: Math.max(0, delay),
      schedArrMs: schedArr,
      actArrMs: actArr,
      schedDepMs: schedDep,
      actDepMs: actDep,
    };
  });

  // Current running delay: the most recent stop that has a real-time report.
  let runningDelay = 0;
  let lastSeenAt: string | null = null;
  for (const s of stops) {
    if (s.actDepMs != null || s.actArrMs != null) {
      runningDelay = s.delayMinutes;
      lastSeenAt = s.stationName;
    }
  }

  return {
    trainNumber: String(prod?.prodCtx?.num ?? prod?.number ?? "").trim(),
    category: category(prod),
    origin: stops[0]?.stationName ?? "",
    destination: stops[stops.length - 1]?.stationName ?? "",
    delayMinutes: Math.max(0, runningDelay),
    cancelled: Boolean(journey.isCncl),
    lastSeenAt,
    stops,
  };
}

export async function fetchOebbTrainStatus(jid: string): Promise<TrainStatus> {
  const res = await hafas("JourneyDetails", { jid, getPolyline: false }, `jd|${jid}`);
  const status = journeyToStatus(res);
  if (!status) throw new Error("ÖBB JourneyDetails: empty journey");
  return status;
}

// ---------------------------------------------------------------------------
// Live map collection — find ÖBB-only running trains and position them.
// ---------------------------------------------------------------------------

const OEBB_MAX_CANDIDATES = 12;

// Scan the same boards as the Viaggiatreno collector; a train still en route
// surfaces on the *next* station's departure board ahead of it. `exclude` holds
// the train numbers Viaggiatreno already placed, so we only add genuine gaps.
export async function collectOebbTrains(
  boardStationIds: string[],
  exclude: Set<string>,
  now: number = Date.now()
): Promise<CollectedTrain[]> {
  const extIds = boardStationIds.map((id) => OEBB_EXT_ID[id]).filter(Boolean);

  const boards = await Promise.allSettled(
    extIds.map((ext) => fetchBoard(ext, "DEP", now - 5 * 60_000, 20))
  );

  const candidates = new Map<string, { jid: string; category: string }>();
  for (const b of boards) {
    if (b.status !== "fulfilled") continue;
    for (const t of b.value) {
      if (t.cancelled || !t.trainNumber || !t.jid) continue;
      if (exclude.has(t.trainNumber) || candidates.has(t.trainNumber)) continue;
      candidates.set(t.trainNumber, { jid: t.jid, category: t.category });
    }
  }

  const limited = [...candidates.entries()].slice(0, OEBB_MAX_CANDIDATES);
  const details = await Promise.allSettled(limited.map(([, c]) => fetchOebbTrainStatus(c.jid)));

  const trains: CollectedTrain[] = [];
  for (let i = 0; i < details.length; i++) {
    const r = details[i];
    if (r.status !== "fulfilled") continue;
    const status = r.value;
    if (status.cancelled) continue;
    const pos = computeNetworkPosition(status, now);
    if (!pos) continue; // only keep trains actually on our mapped network right now

    const [trainNumber, c] = limited[i];
    const stopKeys = new Set(
      status.stops.map((s) => matchNetStation(s.stationName)?.key).filter(Boolean)
    );
    trains.push({
      trainNumber,
      category: c.category || status.category,
      originId: c.jid, // carries the HAFAS journey-id for the click-detail lookup
      departureDateMs: status.stops[0]?.schedDepMs ?? now,
      status,
      pos,
      corridor: stopKeys.has("BZ") && stopKeys.has("BX"),
    });
  }
  return trains;
}

// An ÖBB journey-id (used in place of a Viaggiatreno originId) is recognisable
// by its HAFAS delimiters; lets api/train route to the right upstream.
export function isOebbJourneyId(originId: string | null | undefined): boolean {
  return !!originId && originId.includes("#") && originId.includes("|");
}

// Build the TrainDeparture rows for a station's ÖBB-only departures, for the
// map's station panel. Kept here for symmetry though currently board-driven.
export async function fetchOebbDepartures(stationId: string, whenMs?: number): Promise<TrainDeparture[]> {
  const ext = OEBB_EXT_ID[stationId];
  if (!ext) return [];
  const when = whenMs ?? Date.now();
  const board = await fetchBoard(ext, "DEP", when - 60_000, 25);
  return board.map((t) => ({
    trainNumber: t.trainNumber,
    category: t.category,
    destination: t.dirName,
    scheduledTime: fmtRome(t.schedMs) ?? "",
    estimatedTime: t.realMs != null ? fmtRome(t.realMs) : null,
    delayMinutes: t.delayMinutes,
    cancelled: t.cancelled,
    originId: "OEBB",
    platform: t.platform,
    departureDateMs: t.schedMs,
    scheduledMs: t.schedMs,
  }));
}
