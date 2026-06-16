"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CORRIDOR_KEYS,
  LINES,
  LiveTrain,
  NET_STATIONS,
  NetStation,
  pointOnLine,
} from "@/lib/route";
import { TrainStatus, TrainArrival, TrainDeparture } from "@/lib/trenitalia";
import { withDemo } from "@/lib/clientDemo";
import { isLongDistance } from "@/lib/categories";
import { DelayBadge } from "./DelayBadge";
import { RefreshCw, X, Navigation, Loader2, ArrowRight, MapPin } from "lucide-react";

const REFRESH_INTERVAL = 30_000;

function delayHex(delay: number): string {
  if (delay === 0) return "#34d399";
  if (delay <= 5) return "#facc15";
  if (delay <= 15) return "#fb923c";
  return "#f87171";
}

function polyline(keys: string[]): string {
  return keys
    .map((k, i) => `${i === 0 ? "M" : "L"} ${NET_STATIONS[k].x} ${NET_STATIONS[k].y}`)
    .join(" ");
}

function fmtRome(ms: number): string {
  return new Date(ms).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

function lineName(lineId: LiveTrain["lineId"]): string {
  return lineId === "brenner" ? "Brennerlinie" : lineId === "pustertal" ? "Pustertal" : "Meraner Linie";
}

export function LiveMap() {
  const [trains, setTrains] = useState<LiveTrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [selected, setSelected] = useState<LiveTrain | null>(null);
  const [status, setStatus] = useState<TrainStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [reliability, setReliability] = useState<{ avgArrDelay: number; runs: number; destination: string } | null>(null);

  const [station, setStation] = useState<NetStation | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch(withDemo("/api/positions"));
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setTrains(data.trains ?? []);
      setLastUpdated(new Date());
      setSelected((prev) =>
        prev
          ? (data.trains as LiveTrain[]).find((t) => t.trainNumber === prev.trainNumber) ?? null
          : null
      );
    } catch {
      // keep last known positions on transient errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(), REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  // Fetch the full run for the selected train (its upcoming stops)
  useEffect(() => {
    if (!selected) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    setStatus(null);
    setStatusLoading(true);
    const params = new URLSearchParams({
      number: selected.trainNumber,
      origin: selected.originId,
      date: String(selected.departureDateMs || 0),
    });
    fetch(withDemo(`/api/train?${params}`))
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setStatus(d.error ? null : d);
      })
      .catch(() => !cancelled && setStatus(null))
      .finally(() => !cancelled && setStatusLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected?.trainNumber, selected?.originId, selected?.departureDateMs]);

  // Historical corridor reliability for the selected train (if it runs the corridor)
  useEffect(() => {
    if (!selected) {
      setReliability(null);
      return;
    }
    let cancelled = false;
    setReliability(null);
    fetch(withDemo(`/api/reliability?days=30&train=${selected.trainNumber}`))
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const e = d.entries?.[0];
        setReliability(e ? { avgArrDelay: e.avgArrDelay, runs: e.runs, destination: e.destination } : null);
      })
      .catch(() => !cancelled && setReliability(null));
    return () => {
      cancelled = true;
    };
  }, [selected?.trainNumber]);

  const selectTrain = (t: LiveTrain) => {
    setStation(null);
    setSelected((prev) => (prev?.trainNumber === t.trainNumber ? null : t));
  };

  const selectStation = (st: NetStation) => {
    if (!st.id) return;
    setSelected(null);
    setStation((prev) => (prev?.key === st.key ? null : st));
  };

  return (
    <div className="relative">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-400 font-medium">
          {trains.length > 0
            ? `${trains.length === 1 ? "1 Zug" : `${trains.length} Züge`} in Südtirol unterwegs`
            : ""}
        </span>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {lastUpdated && (
            <span>
              {lastUpdated.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-1 hover:text-zinc-300 transition-colors disabled:opacity-50"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="relative rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-900 to-zinc-950 overflow-hidden">
        <svg viewBox="0 0 390 640" className="w-full" role="img" aria-label="Live-Karte Südtirol">
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Mountain ridges (decoration) */}
          <g stroke="white" strokeWidth="1.2" fill="none" opacity="0.05">
            <path d="M 20 200 L 70 140 L 110 185 L 160 115" />
            <path d="M 250 280 L 300 230 L 340 270 L 380 225" />
            <path d="M 30 530 L 70 480 L 105 520" />
            <path d="M 280 60 L 320 25 L 355 60 L 385 35" />
            <path d="M 240 480 L 290 420 L 330 465 L 370 420" />
          </g>

          {/* Vinschgau stub (no live data) */}
          <path
            d="M 54 356 L 24 342"
            stroke="#3f3f46"
            strokeWidth="2"
            strokeDasharray="3 4"
            fill="none"
          />
          <text x="16" y="326" fontSize="8" className="fill-zinc-600">
            Vinschgau · keine Live-Daten
          </text>

          {/* Rail lines */}
          {LINES.map((line) => (
            <g key={line.id}>
              <path
                d={polyline(line.stationKeys)}
                stroke="black"
                strokeWidth="6"
                fill="none"
                opacity="0.35"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <motion.path
                d={polyline(line.stationKeys)}
                stroke="#52525b"
                strokeWidth="2"
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.2, ease: "easeInOut" }}
              />
            </g>
          ))}

          {/* Home corridor highlight: Bozen–Brixen */}
          <path
            d={polyline(CORRIDOR_KEYS)}
            stroke="white"
            strokeWidth="3"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d={polyline(CORRIDOR_KEYS)}
            stroke="white"
            strokeWidth="3"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="3 60"
            opacity="0.5"
            className="animate-[dash_4s_linear_infinite]"
          />

          {/* Stations */}
          {Object.values(NET_STATIONS).map((st, i) => {
            const clickable = !!st.id;
            const isActive = station?.key === st.key;
            return (
              <motion.g
                key={st.key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.03 }}
                style={{ cursor: clickable ? "pointer" : "default" }}
                onClick={clickable ? () => selectStation(st) : undefined}
              >
                {/* Larger transparent hit target for touch */}
                {clickable && <circle cx={st.x} cy={st.y} r="12" fill="transparent" />}
                {isActive && (
                  <circle cx={st.x} cy={st.y} r="10" fill="none" stroke="#34d399" strokeWidth="2" opacity="0.9" />
                )}
                {st.major ? (
                  <>
                    <circle cx={st.x} cy={st.y} r="6.5" fill="#09090b" stroke="white" strokeWidth="2" />
                    <circle cx={st.x} cy={st.y} r="2.2" fill="white" />
                  </>
                ) : (
                  <circle cx={st.x} cy={st.y} r="2.5" fill="#27272a" stroke="#71717a" strokeWidth="1" />
                )}
                {st.label && (
                  <text
                    x={st.x + st.label[0]}
                    y={st.y + st.label[1]}
                    textAnchor={st.label[2]}
                    className={st.major ? "fill-white font-semibold" : "fill-zinc-400"}
                    fontSize={st.major ? 13 : 10}
                  >
                    {st.name}
                  </text>
                )}
              </motion.g>
            );
          })}

          {/* Trains */}
          {trains.map((train) => {
            const p = pointOnLine(train.lineId, train.frac);
            const color = delayHex(train.delayMinutes);
            const isSelected = selected?.trainNumber === train.trainNumber;
            const angle = train.heading === 1 ? p.angle : p.angle + 180;
            return (
              <motion.g
                key={train.trainNumber}
                initial={false}
                animate={{ x: p.x, y: p.y }}
                transition={{ type: "spring", stiffness: 40, damping: 18 }}
                style={{ cursor: "pointer" }}
                onClick={() => selectTrain(train)}
              >
                <motion.circle
                  r="7"
                  fill={color}
                  initial={{ opacity: 0.45, scale: 1 }}
                  animate={{ opacity: 0, scale: 2.4 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                />
                {isLongDistance(train.category) ? (
                  // Long-distance trains (EC/FR/IC) are diamonds
                  <rect
                    x={isSelected ? -6.5 : -5.5}
                    y={isSelected ? -6.5 : -5.5}
                    width={isSelected ? 13 : 11}
                    height={isSelected ? 13 : 11}
                    transform="rotate(45)"
                    fill={color}
                    stroke="#09090b"
                    strokeWidth="2"
                    filter="url(#glow)"
                  />
                ) : (
                  <circle
                    r={isSelected ? 8 : 6.5}
                    fill={color}
                    stroke="#09090b"
                    strokeWidth="2"
                    filter="url(#glow)"
                  />
                )}
                {/* Direction arrow */}
                <g transform={`rotate(${angle})`}>
                  <path d="M -2.5 -3 L 3.5 0 L -2.5 3 Z" fill="#09090b" />
                </g>
                {/* Number tag */}
                <text
                  y={-12}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="600"
                  fill={color}
                >
                  {isLongDistance(train.category) ? `${train.category} ${train.trainNumber}` : train.trainNumber}
                </text>
              </motion.g>
            );
          })}
        </svg>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/40 backdrop-blur-[2px]">
            <RefreshCw className="w-6 h-6 text-zinc-400 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && trains.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <div className="text-4xl mb-2">🦫</div>
            <p className="text-sm text-zinc-400 font-medium">Gerade keine Züge unterwegs</p>
            <p className="text-xs text-zinc-600 mt-1">Der Biber hält trotzdem Wache</p>
          </div>
        )}

        {/* Selected train detail */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute bottom-3 left-3 right-3 rounded-2xl bg-zinc-900/95 backdrop-blur-md border border-white/10 p-4 shadow-2xl max-h-[80%] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md">
                      {selected.category} {selected.trainNumber}
                    </span>
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Navigation className="w-3 h-3" />
                      {lineName(selected.lineId)}
                    </span>
                  </div>
                  <div className="text-white font-semibold truncate">→ {selected.destination}</div>
                  <div className="text-xs text-zinc-400 mt-1">
                    {selected.atStation ? (
                      <>Hält in <span className="text-white">{selected.atStation}</span></>
                    ) : selected.nextStation ? (
                      <>Nächster Halt: <span className="text-white">{selected.nextStation}</span></>
                    ) : (
                      "Auf der Strecke"
                    )}
                  </div>
                  {reliability && reliability.runs > 0 && (
                    <div className="text-xs text-zinc-500 mt-1">
                      Auf dieser Strecke:{" "}
                      <span className={reliability.avgArrDelay <= 2 ? "text-emerald-400" : reliability.avgArrDelay <= 5 ? "text-yellow-400" : reliability.avgArrDelay <= 15 ? "text-orange-400" : "text-red-400"}>
                        Ø +{reliability.avgArrDelay}′ an {reliability.destination}
                      </span>{" "}
                      <span className="text-zinc-600">(30 T · {reliability.runs} Fahrten)</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Schließen"
                  >
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                  <DelayBadge delayMinutes={selected.delayMinutes} cancelled={false} size="sm" />
                </div>
              </div>

              {/* Upcoming stops */}
              <UpcomingStops status={status} loading={statusLoading} delay={selected.delayMinutes} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected station board */}
        <AnimatePresence>
          {station && <StationPanel station={station} onClose={() => setStation(null)} />}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "#34d399" }} /> pünktlich
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "#facc15" }} /> bis 5′
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "#fb923c" }} /> bis 15′
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "#f87171" }} /> mehr
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rotate-45 bg-zinc-400" /> EC/FR
        </span>
      </div>
      <p className="text-center text-[11px] text-zinc-600 mt-1.5">
        Tipp: Zug oder Station antippen für Details
      </p>
    </div>
  );
}

// --- Upcoming stops for the selected train --------------------------------

function UpcomingStops({
  status,
  loading,
  delay,
}: {
  status: TrainStatus | null;
  loading: boolean;
  delay: number;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 mt-3 border-t border-white/10">
        <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
      </div>
    );
  }
  if (!status) return null;

  const now = Date.now();
  const delayMs = delay * 60_000;
  // Predicted arrival per stop: actual if known, else scheduled + current delay
  const withPred = status.stops.map((s) => {
    const predMs = s.actArrMs ?? (s.schedArrMs != null ? s.schedArrMs + delayMs : null);
    const depPredMs = s.actDepMs ?? (s.schedDepMs != null ? s.schedDepMs + delayMs : null);
    return { stop: s, predMs, refMs: predMs ?? depPredMs };
  });
  const upcoming = withPred.filter((s) => s.refMs == null || s.refMs >= now - 60_000).slice(0, 6);
  const list = upcoming.length > 0 ? upcoming : withPred.slice(-4);

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
        Nächste Halte
      </h3>
      <div className="space-y-1.5">
        {list.map(({ stop, predMs }, i) => {
          const planned = stop.scheduledArrival ?? stop.scheduledDeparture;
          const predicted = predMs != null ? fmtRome(predMs) : stop.actualArrival;
          const changed = predicted && planned && predicted !== planned;
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
              <span className="flex-1 min-w-0 truncate text-zinc-300">{stop.stationName}</span>
              <div className="flex items-baseline gap-2 tabular-nums shrink-0">
                {planned && (
                  <span className={changed ? "text-zinc-500 line-through text-xs" : "text-white"}>
                    {planned}
                  </span>
                )}
                {changed && <span className="text-orange-400 font-semibold">{predicted}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Station departures / arrivals panel ----------------------------------

interface StationBoard {
  departures: TrainDeparture[];
  arrivals: TrainArrival[];
}

function StationPanel({ station, onClose }: { station: NetStation; onClose: () => void }) {
  const [board, setBoard] = useState<StationBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<"dep" | "arr">("dep");

  useEffect(() => {
    let cancelled = false;
    setBoard(null);
    setError(false);
    setLoading(true);
    fetch(withDemo(`/api/station?id=${station.id}`))
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) setError(true);
        else setBoard(d);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [station.id]);

  const rows =
    tab === "dep"
      ? (board?.departures ?? []).slice(0, 12).map((d) => ({
          key: `${d.trainNumber}-${d.scheduledTime}`,
          trainNumber: d.trainNumber,
          category: d.category,
          place: d.destination,
          scheduled: d.scheduledTime,
          predicted:
            d.estimatedTime ??
            (d.delayMinutes > 0 && d.scheduledMs != null ? fmtRome(d.scheduledMs + d.delayMinutes * 60_000) : null),
          delayMinutes: d.delayMinutes,
          cancelled: d.cancelled,
        }))
      : (board?.arrivals ?? []).slice(0, 12).map((a) => ({
          key: `${a.trainNumber}-${a.scheduledTime}`,
          trainNumber: a.trainNumber,
          category: a.category,
          place: a.origin,
          scheduled: a.scheduledTime,
          predicted:
            a.delayMinutes > 0 && a.scheduledMs != null
              ? fmtRome(a.scheduledMs + a.delayMinutes * 60_000)
              : null,
          delayMinutes: a.delayMinutes,
          cancelled: a.cancelled,
        }));

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="absolute bottom-3 left-3 right-3 rounded-2xl bg-zinc-900/95 backdrop-blur-md border border-white/10 p-4 shadow-2xl max-h-[80%] flex flex-col"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-0.5">
            <MapPin className="w-3 h-3" />
            Station
          </div>
          <h2 className="text-lg font-bold text-white truncate">{station.name}</h2>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-white/10 transition-colors shrink-0"
          aria-label="Schließen"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl mb-3">
        <button
          onClick={() => setTab("dep")}
          className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            tab === "dep" ? "bg-white/15 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Abfahrten
        </button>
        <button
          onClick={() => setTab("arr")}
          className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
            tab === "arr" ? "bg-white/15 text-white" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Ankünfte
        </button>
      </div>

      <div className="overflow-y-auto -mx-1 px-1">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
          </div>
        )}
        {error && !loading && (
          <p className="text-center py-8 text-sm text-zinc-500">Keine Daten verfügbar.</p>
        )}
        {!loading && !error && rows.length === 0 && (
          <p className="text-center py-8 text-sm text-zinc-500">
            Keine {tab === "dep" ? "Abfahrten" : "Ankünfte"} in nächster Zeit.
          </p>
        )}
        {!loading && !error && rows.length > 0 && (
          <div className="space-y-1">
            {rows.map((r) => {
              const changed = r.predicted && r.predicted !== r.scheduled && !r.cancelled;
              return (
                <div key={r.key} className="flex items-center gap-2.5 py-1.5">
                  <span className="text-[11px] font-medium text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0 w-14 text-center truncate">
                    {r.category} {r.trainNumber}
                  </span>
                  <div className="flex items-center gap-1 min-w-0 flex-1 text-sm text-zinc-300">
                    {tab === "arr" && <ArrowRight className="w-3 h-3 text-zinc-600 shrink-0 rotate-180" />}
                    <span className={`truncate ${r.cancelled ? "line-through text-zinc-500" : ""}`}>
                      {r.place}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5 tabular-nums shrink-0">
                    <span
                      className={`text-sm font-semibold ${
                        r.cancelled || changed ? "text-zinc-500 line-through" : "text-white"
                      }`}
                    >
                      {r.scheduled}
                    </span>
                    {changed && <span className="text-sm font-semibold text-orange-400">{r.predicted}</span>}
                  </div>
                  {r.cancelled ? (
                    <DelayBadge delayMinutes={0} cancelled size="sm" />
                  ) : r.delayMinutes > 0 ? (
                    <span className="text-xs font-semibold text-orange-400 shrink-0 w-9 text-right">
                      +{r.delayMinutes}′
                    </span>
                  ) : (
                    <span className="w-9 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
