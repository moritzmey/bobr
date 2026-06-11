"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TrainDeparture } from "@/lib/trenitalia";
import { LiveTrain } from "@/lib/route";
import { withDemo } from "@/lib/clientDemo";
import { Loader2, Crown, Ghost } from "lucide-react";

const REFRESH_INTERVAL = 60_000;

interface Row {
  trainNumber: string;
  category: string;
  destination: string;
  delayMinutes: number;
  cancelled: boolean;
  enRoute: boolean;
}

const MEDALS = ["🥇", "🥈", "🥉"];

const QUIPS = [
  "Niemand sammelt Minuten wie sie.",
  "Die Konkurrenz schläft nie — die Züge schon.",
  "Wo Pünktlichkeit zur Legende wird.",
  "Heute wieder starke Leistungen auf der Strecke.",
];

function delayColorClass(d: number): string {
  if (d === 0) return "text-emerald-400";
  if (d <= 5) return "text-yellow-400";
  if (d <= 15) return "text-orange-400";
  return "text-red-400";
}

function delayBarClass(d: number): string {
  if (d <= 5) return "bg-yellow-500";
  if (d <= 15) return "bg-orange-500";
  return "bg-red-500";
}

export function Leaderboard() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [quip] = useState(() => QUIPS[Math.floor(Math.random() * QUIPS.length)]);

  const load = useCallback(async () => {
    try {
      const [bzRes, bxRes, posRes] = await Promise.allSettled([
        fetch(withDemo("/api/departures?station=BOLZANO")).then((r) => r.json()),
        fetch(withDemo("/api/departures?station=BRESSANONE")).then((r) => r.json()),
        fetch(withDemo("/api/positions")).then((r) => r.json()),
      ]);

      const map = new Map<string, Row>();

      const addBoard = (trains: TrainDeparture[]) => {
        for (const t of trains) {
          const existing = map.get(t.trainNumber);
          if (existing) {
            existing.delayMinutes = Math.max(existing.delayMinutes, t.delayMinutes);
            existing.cancelled = existing.cancelled || t.cancelled;
          } else {
            map.set(t.trainNumber, {
              trainNumber: t.trainNumber,
              category: t.category,
              destination: t.destination,
              delayMinutes: t.delayMinutes,
              cancelled: t.cancelled,
              enRoute: false,
            });
          }
        }
      };

      if (bzRes.status === "fulfilled" && Array.isArray(bzRes.value)) addBoard(bzRes.value);
      if (bxRes.status === "fulfilled" && Array.isArray(bxRes.value)) addBoard(bxRes.value);

      if (posRes.status === "fulfilled" && Array.isArray(posRes.value?.trains)) {
        for (const t of posRes.value.trains as LiveTrain[]) {
          const existing = map.get(t.trainNumber);
          if (existing) {
            existing.delayMinutes = Math.max(existing.delayMinutes, t.delayMinutes);
            existing.enRoute = true;
          } else {
            map.set(t.trainNumber, {
              trainNumber: t.trainNumber,
              category: t.category,
              destination: t.destination,
              delayMinutes: t.delayMinutes,
              cancelled: false,
              enRoute: true,
            });
          }
        }
      }

      const sorted = [...map.values()].sort((a, b) => {
        if (a.cancelled !== b.cancelled) return a.cancelled ? -1 : 1;
        return b.delayMinutes - a.delayMinutes;
      });

      setRows(sorted);
      setError(false);
    } catch {
      setError(true);
      setRows((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  if (rows === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  const shameful = rows.filter((r) => r.cancelled || r.delayMinutes > 0);
  const punctual = rows.filter((r) => !r.cancelled && r.delayMinutes === 0);
  const podium = shameful.slice(0, 3);
  const rest = shameful.slice(3);
  const maxDelay = Math.max(...shameful.map((r) => r.delayMinutes), 1);

  return (
    <div>
      <div className="mb-5">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-400" />
          Verspätungs-Leaderboard
        </h2>
        <p className="text-sm text-zinc-500 mt-0.5">{quip}</p>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-3">Verbindungsproblem — zeige letzte Daten.</p>
      )}

      {shameful.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🦫✨</div>
          <p className="font-semibold text-zinc-300">Alle Züge pünktlich.</p>
          <p className="text-sm text-zinc-500 mt-1">Der Biber ist sprachlos. Screenshot machen — das kommt nie wieder.</p>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="flex items-end gap-2 mb-6">
            {[1, 0, 2].map((podiumIdx) => {
              const row = podium[podiumIdx];
              if (!row) return <div key={podiumIdx} className="flex-1" />;
              const isFirst = podiumIdx === 0;
              return (
                <motion.div
                  key={row.trainNumber}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: isFirst ? 0.25 : podiumIdx === 1 ? 0.1 : 0.4, type: "spring", stiffness: 200, damping: 20 }}
                  className={`flex-1 rounded-2xl border text-center px-2 ${
                    isFirst
                      ? "bg-amber-500/10 border-amber-500/30 py-5"
                      : "bg-white/5 border-white/10 py-3.5"
                  }`}
                >
                  <div className={isFirst ? "text-3xl" : "text-2xl"}>{MEDALS[podiumIdx]}</div>
                  <div className="text-xs text-zinc-400 mt-1.5 font-medium">
                    {row.category} {row.trainNumber}
                  </div>
                  {row.cancelled ? (
                    <div className="text-red-400 font-black text-lg mt-0.5 flex items-center justify-center gap-1">
                      <Ghost className="w-4 h-4" /> DNF
                    </div>
                  ) : (
                    <div className={`font-black mt-0.5 tabular-nums ${isFirst ? "text-2xl" : "text-xl"} ${delayColorClass(row.delayMinutes)}`}>
                      +{row.delayMinutes}′
                    </div>
                  )}
                  {isFirst && (
                    <div className="text-[10px] text-amber-400/80 mt-1 uppercase tracking-widest font-semibold">
                      Champion
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Rest of the field */}
          {rest.length > 0 && (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {rest.map((row, i) => (
                  <motion.div
                    key={row.trainNumber}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.05 * i }}
                    className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3"
                  >
                    <span className="text-sm font-bold text-zinc-500 w-6 text-center tabular-nums">
                      {i + 4}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded-md shrink-0">
                          {row.category} {row.trainNumber}
                        </span>
                        {row.enRoute && (
                          <span className="text-[10px] text-sky-400 uppercase tracking-wide font-semibold shrink-0">
                            unterwegs
                          </span>
                        )}
                      </div>
                      {!row.cancelled && row.delayMinutes > 0 && (
                        <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${delayBarClass(row.delayMinutes)}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${(row.delayMinutes / maxDelay) * 100}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                      )}
                    </div>
                    {row.cancelled ? (
                      <span className="text-xs font-bold text-red-400 shrink-0">DNF</span>
                    ) : (
                      <span className={`font-bold tabular-nums shrink-0 ${delayColorClass(row.delayMinutes)}`}>
                        +{row.delayMinutes}′
                      </span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* The punctual ones */}
          {punctual.length > 0 && (
            <p className="text-xs text-zinc-600 text-center mt-5">
              {punctual.length === 1 ? "1 Zug" : `${punctual.length} Züge`} heute tatsächlich pünktlich.
              Ehrenrunde. 👏
            </p>
          )}
        </>
      )}

      <p className="text-[10px] text-zinc-700 text-center mt-6">
        Alle Angaben ohne Gewähr · Minuten sind Ehrensache · DNF = gar nicht erst angetreten
      </p>
    </div>
  );
}
