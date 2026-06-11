"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CORRIDOR, LiveTrain } from "@/lib/route";
import { withDemo } from "@/lib/clientDemo";
import { DelayBadge } from "./DelayBadge";
import { RefreshCw, X, ArrowUp, ArrowDown } from "lucide-react";

const REFRESH_INTERVAL = 30_000;

// Stylized Eisack valley route, Bozen bottom-left → Brixen top-right
const RAIL_PATH =
  "M 70 510 C 130 500, 158 478, 172 440 C 186 402, 180 372, 194 338 C 208 304, 232 286, 246 254 C 258 228, 261 206, 273 178 C 287 144, 301 116, 326 76";

function delayHex(delay: number): string {
  if (delay === 0) return "#34d399";
  if (delay <= 5) return "#facc15";
  if (delay <= 15) return "#fb923c";
  return "#f87171";
}

// Label placement per station key: [dx, dy, anchor]
const LABEL_POS: Record<string, [number, number, "start" | "end"]> = {
  BZ: [16, 5, "start"],
  BL: [14, 4, "start"],
  AT: [-14, 4, "end"],
  WB: [16, 4, "start"],
  KL: [-16, 4, "end"],
  AB: [14, 4, "start"],
  BX: [16, 4, "start"],
};

interface Point {
  x: number;
  y: number;
}

export function LiveMap() {
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState<number | null>(null);
  const [trains, setTrains] = useState<LiveTrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selected, setSelected] = useState<LiveTrain | null>(null);

  useEffect(() => {
    if (pathRef.current) setPathLength(pathRef.current.getTotalLength());
  }, []);

  const pointAt = useCallback(
    (frac: number): Point => {
      if (!pathRef.current || pathLength === null) return { x: 0, y: 0 };
      const p = pathRef.current.getPointAtLength(
        Math.min(1, Math.max(0, frac)) * pathLength
      );
      return { x: p.x, y: p.y };
    },
    [pathLength]
  );

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch(withDemo("/api/positions"));
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setTrains(data.trains ?? []);
      setLastUpdated(new Date());
      // Keep the selected train's data fresh
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

  const ready = pathLength !== null;

  return (
    <div className="relative">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {trains.length > 0 && (
            <span className="text-zinc-400 font-medium">
              {trains.length === 1 ? "1 Zug" : `${trains.length} Züge`} unterwegs
            </span>
          )}
        </div>
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
        <svg viewBox="0 0 390 560" className="w-full" role="img" aria-label="Live-Karte Bozen–Brixen">
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="rail" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#52525b" />
              <stop offset="100%" stopColor="#a1a1aa" />
            </linearGradient>
          </defs>

          {/* Mountain ridges (decoration) */}
          <g stroke="white" strokeWidth="1.2" fill="none" opacity="0.05">
            <path d="M 0 180 L 55 120 L 95 165 L 150 95 L 200 150" />
            <path d="M 200 120 L 255 60 L 300 110 L 355 45 L 390 85" />
            <path d="M 0 360 L 40 300 L 90 350 L 130 310" />
            <path d="M 280 330 L 330 270 L 370 320 L 390 300" />
          </g>
          {/* Eisack river hint */}
          <path
            d="M 86 526 C 142 514, 172 488, 186 446 C 200 408, 192 376, 208 340 C 222 306, 246 290, 258 260 C 270 232, 272 208, 286 182 C 300 150, 314 124, 338 88"
            stroke="#38bdf8"
            strokeWidth="5"
            fill="none"
            opacity="0.06"
          />

          {/* Rail line */}
          <path d={RAIL_PATH} stroke="black" strokeWidth="7" fill="none" opacity="0.4" />
          <motion.path
            ref={pathRef}
            d={RAIL_PATH}
            stroke="url(#rail)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
          />
          {/* Moving shimmer along the line */}
          <path
            d={RAIL_PATH}
            stroke="white"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="3 60"
            opacity="0.35"
            className="animate-[dash_4s_linear_infinite]"
          />

          {/* Stations */}
          {ready &&
            CORRIDOR.map((cs, i) => {
              const p = pointAt(cs.frac);
              const [dx, dy, anchor] = LABEL_POS[cs.key] ?? [14, 4, "start"];
              return (
                <motion.g
                  key={cs.key}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.12 }}
                >
                  {cs.major ? (
                    <>
                      <circle cx={p.x} cy={p.y} r="7" fill="#09090b" stroke="white" strokeWidth="2" />
                      <circle cx={p.x} cy={p.y} r="2.5" fill="white" />
                    </>
                  ) : (
                    <circle cx={p.x} cy={p.y} r="3" fill="#3f3f46" stroke="#71717a" strokeWidth="1" />
                  )}
                  <text
                    x={p.x + dx}
                    y={p.y + dy}
                    textAnchor={anchor}
                    className={cs.major ? "fill-white font-semibold" : "fill-zinc-500"}
                    fontSize={cs.major ? 14 : 10}
                  >
                    {cs.name}
                  </text>
                </motion.g>
              );
            })}

          {/* Trains */}
          {ready &&
            trains.map((train) => {
              const p = pointAt(train.frac);
              const color = delayHex(train.delayMinutes);
              const isSelected = selected?.trainNumber === train.trainNumber;
              return (
                <motion.g
                  key={train.trainNumber}
                  initial={false}
                  animate={{ x: p.x, y: p.y }}
                  transition={{ type: "spring", stiffness: 40, damping: 18 }}
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelected(isSelected ? null : train)}
                >
                  {/* Pulse */}
                  <motion.circle
                    r="8"
                    fill={color}
                    initial={{ opacity: 0.45, scale: 1 }}
                    animate={{ opacity: 0, scale: 2.4 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  />
                  <circle
                    r={isSelected ? 9 : 7}
                    fill={color}
                    stroke="#09090b"
                    strokeWidth="2"
                    filter="url(#glow)"
                  />
                  {/* Direction tick */}
                  <text
                    y={1.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="8"
                    fontWeight="bold"
                    fill="#09090b"
                  >
                    {train.direction === "north" ? "▲" : "▼"}
                  </text>
                  {/* Number tag */}
                  <g transform={`translate(${train.direction === "north" ? -12 : 12}, 0)`}>
                    <text
                      textAnchor={train.direction === "north" ? "end" : "start"}
                      dominantBaseline="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill={color}
                    >
                      {train.category} {train.trainNumber}
                    </text>
                  </g>
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
            <p className="text-sm text-zinc-400 font-medium">Gerade keine Züge im Tal</p>
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
                    <span className="text-xs text-zinc-500 flex items-center gap-0.5">
                      {selected.direction === "north" ? (
                        <><ArrowUp className="w-3 h-3" /> Richtung Brixen</>
                      ) : (
                        <><ArrowDown className="w-3 h-3" /> Richtung Bozen</>
                      )}
                    </span>
                  </div>
                  <div className="text-white font-semibold truncate">→ {selected.destination}</div>
                  <div className="text-xs text-zinc-400 mt-1">
                    {selected.atStation
                      ? <>Hält in <span className="text-white">{selected.atStation}</span></>
                      : selected.nextStation
                      ? <>Nächster Halt: <span className="text-white">{selected.nextStation}</span></>
                      : "Auf der Strecke"}
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
      </div>
    </div>
  );
}
