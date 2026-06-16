"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { withDemo } from "@/lib/clientDemo";
import { isLongDistance } from "@/lib/categories";
import { Loader2, Crown, Search, ArrowRight } from "lucide-react";

type Dir = "NB" | "SB";

interface Entry {
  trainNumber: string;
  category: string;
  direction: Dir;
  origin: string;
  destination: string;
  schedDep: string | null;
  schedArr: string | null;
  runs: number;
  avgArrDelay: number;
  maxArrDelay: number;
  avgDepDelay: number;
  onTimePct: number;
  cancelledCount: number;
}

interface DailyPoint {
  date: string;
  avgDelay: number;
  runs: number;
}

interface Data {
  entries: Entry[];
  daily: DailyPoint[];
  days: number;
}

const DAY_OPTIONS = [7, 30, 90] as const;
const MEDALS = ["🥇", "🥈", "🥉"];

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
      {category ? `${category} ` : ""}
      {trainNumber}
    </span>
  );
}

export function ReliabilityView() {
  const [days, setDays] = useState<number>(30);
  const [query, setQuery] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await fetch(withDemo(`/api/reliability?days=${d}`));
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [load, days]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      (data?.entries ?? []).filter(
        (e) =>
          !q ||
          e.trainNumber.includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.origin.toLowerCase().includes(q) ||
          e.destination.toLowerCase().includes(q) ||
          (e.schedDep ?? "").includes(q)
      ),
    [data, q]
  );

  // Overview KPIs (run-weighted across all corridor trains)
  const overview = useMemo(() => {
    const entries = data?.entries ?? [];
    let runs = 0;
    let delaySum = 0;
    let onTimeSum = 0;
    let cancelled = 0;
    for (const e of entries) {
      runs += e.runs;
      delaySum += e.avgArrDelay * e.runs;
      onTimeSum += e.onTimePct * e.runs;
      cancelled += e.cancelledCount;
    }
    return {
      avgDelay: runs > 0 ? Math.round(delaySum / runs) : 0,
      onTimePct: runs > 0 ? Math.round(onTimeSum / runs) : null,
      cancelled,
      worst: entries[0] ?? null,
    };
  }, [data]);

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Crown className="w-5 h-5 text-amber-400" />
          Zuverlässigkeit · Bozen ↔ Brixen
        </h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Verspätung am Ziel auf der Strecke — wer am unzuverlässigsten ist, steht oben.
        </p>
      </div>

      {/* Day filter + search */}
      <div className="flex gap-2 mb-4">
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl shrink-0">
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                days === d ? "bg-white/15 text-white" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {d}T
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Zugnummer, Richtung, Abfahrt…"
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/25"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
        </div>
      ) : error || !data || data.entries.length === 0 ? (
        <EmptyNote
          text={
            error
              ? "Langzeit-Daten noch nicht verfügbar — die Datensammlung muss erst laufen."
              : "Noch keine Streckendaten gesammelt. Das Ranking entsteht, sobald BOBR ein paar Tage Züge auf der Strecke beobachtet hat. 🦫"
          }
        />
      ) : (
        <>
          {/* Overview */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            <KpiCard label="Ø Verspätung" value={`+${overview.avgDelay}′`} accent={delayColorClass(overview.avgDelay)} />
            <KpiCard
              label="pünktlich"
              value={overview.onTimePct != null ? `${overview.onTimePct}%` : "–"}
              accent={(overview.onTimePct ?? 0) >= 80 ? "text-emerald-400" : (overview.onTimePct ?? 0) >= 60 ? "text-yellow-400" : "text-red-400"}
            />
            <KpiCard label="Ausfälle" value={String(overview.cancelled)} accent={overview.cancelled > 0 ? "text-red-400" : "text-zinc-300"} />
          </div>

          {data.daily.length > 1 && <DailyChart daily={data.daily} />}

          {/* Ranking */}
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 mt-6">
            Unzuverlässigste Züge
          </h3>
          {filtered.length === 0 ? (
            <EmptyNote text="Nichts gefunden." />
          ) : (
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {filtered.map((e, i) => (
                  <RankRow key={`${e.trainNumber}-${e.direction}`} entry={e} rank={i} hasQuery={!!q} maxAvg={Math.max(...filtered.map((x) => x.avgArrDelay), 1)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      <p className="text-[10px] text-zinc-700 text-center mt-6">
        Verspätung gemessen bei Ankunft am Ziel · Ausfälle separat gezählt · ohne Gewähr
      </p>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-center">
      <div className={`text-xl font-black tabular-nums ${accent}`}>{value}</div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide mt-0.5">{label}</div>
    </div>
  );
}

function DailyChart({ daily }: { daily: DailyPoint[] }) {
  const max = Math.max(...daily.map((d) => d.avgDelay), 1);
  return (
    <section>
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
        Ø Verspätung pro Tag
      </h3>
      <div className="flex items-end gap-0.5 h-16 bg-white/5 rounded-xl px-3 py-2">
        {daily.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col justify-end" title={`${d.date}: +${d.avgDelay}′ (${d.runs} Fahrten)`}>
            <div
              className={`rounded-sm w-full ${d.avgDelay === 0 ? "bg-emerald-600" : d.avgDelay <= 5 ? "bg-yellow-500" : d.avgDelay <= 15 ? "bg-orange-500" : "bg-red-500"}`}
              style={{ height: `${Math.max(3, (d.avgDelay / max) * 48)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-zinc-600 mt-1 px-1">
        <span>{daily[0]?.date}</span>
        <span>{daily[daily.length - 1]?.date}</span>
      </div>
    </section>
  );
}

function RankRow({ entry, rank, hasQuery, maxAvg }: { entry: Entry; rank: number; hasQuery: boolean; maxAvg: number }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ delay: Math.min(0.04 * rank, 0.5) }}
      className={`rounded-xl border px-4 py-3 ${
        rank === 0 && !hasQuery ? "bg-amber-500/10 border-amber-500/30" : "bg-white/5 border-white/10"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-zinc-500 w-6 text-center shrink-0">
          {!hasQuery && rank < 3 ? MEDALS[rank] : rank + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <CategoryChip category={entry.category} trainNumber={entry.trainNumber} />
            <span className="text-[10px] text-sky-400/90 font-semibold uppercase tracking-wide shrink-0 flex items-center gap-1">
              {entry.origin} <ArrowRight className="w-2.5 h-2.5" /> {entry.destination}
            </span>
          </div>
          <div className="text-xs text-zinc-400 mt-1.5 truncate">
            <span className="text-zinc-300">{entry.schedDep ?? "–"}</span> {entry.origin}
            <span className="text-zinc-600"> → </span>
            <span className="text-zinc-300">{entry.schedArr ?? "–"}</span> {entry.destination}
          </div>
          <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${delayBarClass(entry.avgArrDelay)}`}
              initial={{ width: 0 }}
              animate={{ width: `${(entry.avgArrDelay / maxAvg) * 100}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
            <span>
              Ø +{entry.avgArrDelay}′ · max +{entry.maxArrDelay}′ · {entry.onTimePct}% pünktl. · {entry.runs} Fahrten
            </span>
            {entry.cancelledCount > 0 && <span className="text-red-500">{entry.cancelledCount}× ausgefallen</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`font-black tabular-nums text-lg ${delayColorClass(entry.avgArrDelay)}`}>
            +{entry.avgArrDelay}′
          </div>
          <div className="text-[10px] text-zinc-600">an {entry.destination}</div>
        </div>
      </div>
    </motion.div>
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
