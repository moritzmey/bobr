"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CORRIDOR_KEYS,
  LINES,
  LiveTrain,
  NET_STATIONS,
  pointOnLine,
} from "@/lib/route";
import { withDemo } from "@/lib/clientDemo";
import { isLongDistance } from "@/lib/categories";
import { DelayBadge } from "./DelayBadge";
import { RefreshCw, X, Navigation } from "lucide-react";

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

export function LiveMap() {
  const [trains, setTrains] = useState<LiveTrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selected, setSelected] = useState<LiveTrain | null>(null);

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
          {Object.values(NET_STATIONS).map((st, i) => (
            <motion.g
              key={st.key}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 + i * 0.03 }}
            >
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
          ))}

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
                onClick={() => setSelected(isSelected ? null : train)}
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

        {/* Selected train card */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute bottom-3 left-3 right-3 rounded-2xl bg-zinc-900/95 backdrop-blur-md border border-white/10 p-4 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md">
                      {selected.category} {selected.trainNumber}
                    </span>
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Navigation className="w-3 h-3" />
                      {selected.lineId === "brenner"
                        ? "Brennerlinie"
                        : selected.lineId === "pustertal"
                        ? "Pustertal"
                        : "Meraner Linie"}
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
            </motion.div>
          )}
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
    </div>
  );
}
