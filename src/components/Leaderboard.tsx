"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TrainDeparture } from "@/lib/trenitalia";
import { crossesCorridorByName, isOnCorridor, LiveTrain } from "@/lib/route";
import { isLongDistance } from "@/lib/categories";
import { withDemo } from "@/lib/clientDemo";
import { Loader2, Crown, Ghost, Search } from "lucide-react";

const REFRESH_INTERVAL = 60_000;

type View = "today" | "month";

interface LiveRow {
  trainNumber: string;
  category: string;
  destination: string;
  delayMinutes: number;
  cancelled: boolean;
  enRoute: boolean;
}

interface MonthRow {
  trainNumber: string;
  category: string;
  origin: string;
  destination: string;
  schedDep: string | null;
  schedArr: string | null;
  runs: number;
  totalDelay: number;
  avgDelay: number;
  maxDelay: number;
  cancelledCount: number;
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

function CategoryChip({ category, trainNumber }: { category: string; trainNumber: string }) {
  const long = isLongDistance(category);
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-md shrink-0 ${
        long ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" : "bg-zinc-800 text-zinc-300"
      }`}
    >
      {category} {trainNumber}
    </span>
  );
}

export function Leaderboard() {
  const [view, setView] = useState<View>("today");
  const [query, setQuery] = useState("");
  const [liveRows, setLiveRows] = useState<LiveRow[] | null>(null);
  const [monthRows, setMonthRows] = useState<MonthRow[] | null>(null);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [quip] = useState(() => QUIPS[Math.floor(Math.random() * QUIPS.length)]);

  const loadLive = useCallback(async () => {
    try {
      const [bzRes, bxRes, posRes] = await Promise.allSettled([
        fetch(withDemo("/api/departures?station=BOLZANO")).then((r) => r.json()),
        fetch(withDemo("/api/departures?station=BRESSANONE")).then((r) => r.json()),
        fetch(withDemo("/api/positions")).then((r) => r.json()),
      ]);

      const map = new Map<string, LiveRow>();

      // Only corridor trains: from each board, keep trains heading across
      // the Bozen–Brixen stretch
      const addBoard = (trains: TrainDeparture[], boardStation: string) => {
        for (const t of trains) {
          if (!crossesCorridorByName(boardStation, t.destination)) continue;
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

      if (bzRes.status === "fulfilled" && Array.isArray(bzRes.value)) addBoard(bzRes.value, "BOLZANO");
      if (bxRes.status === "fulfilled" && Array.isArray(bxRes.value)) addBoard(bxRes.value, "BRESSANONE");

      if (posRes.status === "fulfilled" && Array.isArray(posRes.value?.trains)) {
        for (const t of posRes.value.trains as LiveTrain[]) {
          if (!isOnCorridor(t.lineId, t.frac)) continue;
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

      setLiveRows(
        [...map.values()].sort((a, b) => {
          if (a.cancelled !== b.cancelled) return a.cancelled ? -1 : 1;
          return b.delayMinutes - a.delayMinutes;
        })
      );
    } catch {
      setLiveRows((prev) => prev ?? []);
    }
  }, []);

  const loadMonth = useCallback(async () => {
    try {
      const res = await fetch(withDemo("/api/leaderboard"));
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMonthRows(data.entries ?? []);
      setMonthError(null);
    } catch (e) {
      setMonthError(e instanceof Error ? e.message : "Fehler");
      setMonthRows((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("lb") === "month") {
      setView("month");
    }
    loadLive();
    loadMonth();
    const id = setInterval(loadLive, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [loadLive, loadMonth]);

  const q = query.trim().toLowerCase();

  const filteredLive = useMemo(
    () =>
      (liveRows ?? []).filter(
        (r) =>
          !q ||
          r.trainNumber.includes(q) ||
          r.destination.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      ),
    [liveRows, q]
  );

  const filteredMonth = useMemo(
    () =>
      (monthRows ?? []).filter(
        (r) =>
          !q ||
          r.trainNumber.includes(q) ||
          r.origin.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q) ||
          (r.schedDep ?? "").includes(q) ||
          r.category.toLowerCase().includes(q)
      ),
    [monthRows, q]
  );

  const loading = view === "today" ? liveRows === null : monthRows === null;

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-400" />
          Verspätungs-Leaderboard
        </h2>
        <p className="text-sm text-zinc-500 mt-0.5">{quip}</p>
      </div>

      {/* View toggle + search */}
      <div className="flex gap-2 mb-4">
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setView("today")}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              view === "today" ? "bg-white/15 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Heute
          </button>
          <button
            onClick={() => setView("month")}
            className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              view === "month" ? "bg-white/15 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            30 Tage
          </button>
        </div>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zugnummer, Ziel, Abfahrt…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
        </div>
      ) : view === "today" ? (
        <TodayView rows={filteredLive} hasQuery={!!q} />
      ) : (
        <MonthView rows={filteredMonth} hasQuery={!!q} error={monthError} />
      )}

      <p className="text-[10px] text-zinc-700 text-center mt-6">
        Alle Angaben ohne Gewähr · Minuten sind Ehrensache · DNF = gar nicht erst angetreten
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TodayView({ rows, hasQuery }: { rows: LiveRow[]; hasQuery: boolean }) {
  const shameful = rows.filter((r) => r.cancelled || r.delayMinutes > 0);
  const punctual = rows.filter((r) => !r.cancelled && r.delayMinutes === 0);
  const podium = hasQuery ? [] : shameful.slice(0, 3);
  const rest = hasQuery ? shameful : shameful.slice(3);
  const maxDelay = Math.max(...shameful.map((r) => r.delayMinutes), 1);

  if (rows.length === 0) {
    return <EmptyNote text={hasQuery ? "Nichts gefunden." : "Keine Züge im Blick."} />;
  }

  if (shameful.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-3">🦫✨</div>
        <p className="font-semibold text-zinc-300">Alle Züge pünktlich.</p>
        <p className="text-sm text-zinc-500 mt-1">
          Der Biber ist sprachlos. Screenshot machen — das kommt nie wieder.
        </p>
      </div>
    );
  }

  return (
    <>
      {podium.length > 0 && (
        <div className="flex items-end gap-2 mb-6">
          {[1, 0, 2].map((idx) => {
            const row = podium[idx];
            if (!row) return <div key={idx} className="flex-1" />;
            const isFirst = idx === 0;
            return (
              <motion.div
                key={row.trainNumber}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: isFirst ? 0.25 : idx === 1 ? 0.1 : 0.4, type: "spring", stiffness: 200, damping: 20 }}
                className={`flex-1 rounded-2xl border text-center px-2 ${
                  isFirst ? "bg-amber-500/10 border-amber-500/30 py-5" : "bg-white/5 border-white/10 py-3.5"
                }`}
              >
                <div className={isFirst ? "text-3xl" : "text-2xl"}>{MEDALS[idx]}</div>
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
      )}

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
                transition={{ delay: 0.04 * i }}
                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3"
              >
                <span className="text-sm font-bold text-zinc-500 w-6 text-center tabular-nums">
                  {(hasQuery ? 1 : 4) + i}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <CategoryChip category={row.category} trainNumber={row.trainNumber} />
                    {row.enRoute && (
                      <span className="text-[10px] text-sky-400 uppercase tracking-wide font-semibold shrink-0">
                        unterwegs
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 truncate mt-1">→ {row.destination}</div>
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

      {punctual.length > 0 && !hasQuery && (
        <p className="text-xs text-zinc-600 text-center mt-5">
          {punctual.length === 1 ? "1 Zug" : `${punctual.length} Züge`} heute tatsächlich pünktlich. Ehrenrunde. 👏
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function MonthView({ rows, hasQuery, error }: { rows: MonthRow[]; hasQuery: boolean; error: string | null }) {
  if (error && rows.length === 0) {
    return <EmptyNote text="Langzeit-Daten noch nicht verfügbar — die Datensammlung muss erst laufen." />;
  }
  if (rows.length === 0) {
    return (
      <EmptyNote
        text={
          hasQuery
            ? "Nichts gefunden."
            : "Noch keine Daten gesammelt. Das Ranking entsteht, sobald BOBR ein paar Tage Züge beobachtet hat. 🦫"
        }
      />
    );
  }

  const maxTotal = Math.max(...rows.map((r) => r.totalDelay), 1);

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {rows.map((row, i) => (
          <motion.div
            key={row.trainNumber}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: Math.min(0.04 * i, 0.5) }}
            className={`rounded-xl border px-4 py-3 ${
              i === 0 && !hasQuery
                ? "bg-amber-500/10 border-amber-500/30"
                : "bg-white/5 border-white/10"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-zinc-500 w-6 text-center shrink-0">
                {!hasQuery && i < 3 ? MEDALS[i] : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CategoryChip category={row.category} trainNumber={row.trainNumber} />
                </div>
                <div className="text-xs text-zinc-400 mt-1.5 truncate">
                  <span className="text-zinc-300">{row.schedDep ?? "–"}</span> {row.origin || "?"}
                  <span className="text-zinc-600"> → </span>
                  <span className="text-zinc-300">{row.schedArr ?? "–"}</span> {row.destination || "?"}
                </div>
                <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${delayBarClass(row.avgDelay)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(row.totalDelay / maxTotal) * 100}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                  <span>
                    Ø +{row.avgDelay}′ · max +{row.maxDelay}′ · {row.runs} Fahrten
                  </span>
                  {row.cancelledCount > 0 && (
                    <span className="text-red-500">{row.cancelledCount}× ausgefallen</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className={`font-black tabular-nums text-lg ${delayColorClass(row.avgDelay)}`}>
                  Σ {row.totalDelay}′
                </div>
                <div className="text-[10px] text-zinc-600">gesammelt</div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3">🦫</div>
      <p className="text-sm text-zinc-500 max-w-xs mx-auto">{text}</p>
    </div>
  );
}
