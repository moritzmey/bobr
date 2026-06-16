"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CorridorTrain } from "@/lib/trenitalia";
import { demoExpectedDelay, isDemo, withDemo } from "@/lib/clientDemo";
import { isLongDistance } from "@/lib/categories";
import { DelayBadge } from "./DelayBadge";
import { ArrowRight, Clock, MapPin, RefreshCw, TrendingUp, WifiOff } from "lucide-react";

interface Props {
  fromKey: "BOLZANO" | "BRESSANONE";
  toKey: "BOLZANO" | "BRESSANONE";
  fromLabel: string;
  toLabel: string;
}

interface Reliability {
  avgArrDelay: number;
  runs: number;
}

const REFRESH_INTERVAL = 60_000;
const RELIABILITY_DAYS = 30;

// "HH:MM" in browser-local time (≙ Europe/Rome for users in South Tyrol) → epoch ms today
function hhmmToMs(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function nowHHMM(): string {
  return new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function plusHours(hhmm: string, hours: number): string {
  const d = new Date(hhmmToMs(hhmm) + hours * 60 * 60_000);
  return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export function CorridorBoard({ fromKey, toKey, fromLabel, toLabel }: Props) {
  const [time, setTime] = useState<string>(nowHHMM);
  const [isNow, setIsNow] = useState(true);
  const [trains, setTrains] = useState<CorridorTrain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reliability, setReliability] = useState<Map<string, Reliability>>(new Map());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setRefreshing(true);
      // When pinned to "now", always use the live clock so the window keeps moving.
      const whenMs = isNow ? Date.now() : hhmmToMs(time);
      try {
        const res = await fetch(
          withDemo(`/api/corridor?from=${fromKey}&to=${toKey}&time=${whenMs}`)
        );
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        setTrains(data.trains ?? []);
        setError(null);
      } catch {
        setError("Zugdaten konnten nicht geladen werden.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fromKey, toKey, time, isNow]
  );

  useEffect(() => {
    setLoading(true);
    load();
    timerRef.current = setInterval(() => load(), REFRESH_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  // Historical reliability per train (last 30 days), fetched once
  useEffect(() => {
    let cancelled = false;
    fetch(withDemo(`/api/reliability?days=${RELIABILITY_DAYS}`))
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.entries) return;
        const m = new Map<string, Reliability>();
        for (const e of d.entries) m.set(e.trainNumber, { avgArrDelay: e.avgArrDelay, runs: e.runs });
        setReliability(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const windowStart = isNow ? nowHHMM() : time;
  const windowEnd = plusHours(windowStart, 2);

  return (
    <div>
      {/* Time selector */}
      <div className="flex items-center gap-2 mb-3 bg-white/5 rounded-xl p-2">
        <Clock className="w-4 h-4 text-zinc-400 shrink-0 ml-1" />
        <input
          type="time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setIsNow(false);
          }}
          className="bg-white/5 text-white text-sm font-semibold rounded-lg px-2.5 py-1.5 tabular-nums focus:outline-none focus:ring-1 focus:ring-white/30 [color-scheme:dark]"
          aria-label="Abfahrtszeit wählen"
        />
        <span className="text-xs text-zinc-500">– {windowEnd}</span>
        <button
          onClick={() => {
            setTime(nowHHMM());
            setIsNow(true);
          }}
          className={`ml-auto text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
            isNow
              ? "bg-white/15 text-white"
              : "text-zinc-400 hover:text-white hover:bg-white/10"
          }`}
        >
          Jetzt
        </button>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
          <WifiOff className="w-8 h-8" />
          <p className="text-sm">{error}</p>
          <button onClick={() => load()} className="text-xs text-zinc-400 underline hover:text-white">
            Erneut versuchen
          </button>
        </div>
      )}

      {!loading && !error && trains.length === 0 && (
        <p className="text-center py-10 text-zinc-500 text-sm">
          Keine Züge {fromLabel} → {toLabel} zwischen {windowStart} und {windowEnd}.
        </p>
      )}

      {!loading && !error && trains.length > 0 && (
        <div className="space-y-2.5">
          {trains.map((t) => (
            <CorridorRow
              key={`${t.trainNumber}-${t.depScheduled}`}
              train={t}
              fromLabel={fromLabel}
              toLabel={toLabel}
              reliability={reliability.get(t.trainNumber)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function reliabilityColor(d: number): string {
  if (d <= 2) return "text-emerald-400";
  if (d <= 5) return "text-yellow-400";
  if (d <= 15) return "text-orange-400";
  return "text-red-400";
}

function CorridorRow({
  train,
  fromLabel,
  toLabel,
  reliability,
}: {
  train: CorridorTrain;
  fromLabel: string;
  toLabel: string;
  reliability?: Reliability;
}) {
  const cancelled = train.cancelled;
  const hasDelay = !cancelled && (train.depDelay > 0 || train.arrDelay > 0);
  // Real reliability from the lookup; in demo, fall back to a deterministic value
  const rel =
    reliability ?? (isDemo() ? { avgArrDelay: demoExpectedDelay(train.trainNumber), runs: 28 } : undefined);

  return (
    <div
      className={`rounded-2xl border p-4 ${
        cancelled
          ? "bg-red-950/30 border-red-800/40"
          : hasDelay
          ? "bg-orange-950/20 border-orange-800/30"
          : "bg-white/5 border-white/10"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-md shrink-0 ${
              isLongDistance(train.category)
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {train.category} {train.trainNumber}
          </span>
          <span className="text-xs text-zinc-500 truncate">→ {train.destination}</span>
          {train.platform && (
            <span className="text-xs text-zinc-500 flex items-center gap-1 shrink-0">
              <MapPin className="w-3 h-3" />
              Bin. {train.platform}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rel && rel.runs > 0 && (
            <span
              className={`text-[11px] font-semibold flex items-center gap-0.5 ${reliabilityColor(rel.avgArrDelay)}`}
              title={`Schnitt der letzten ${RELIABILITY_DAYS} Tage · ${rel.runs} Fahrten`}
            >
              <TrendingUp className="w-3 h-3" />
              Ø +{rel.avgArrDelay}′
            </span>
          )}
          <DelayBadge delayMinutes={train.depDelay} cancelled={cancelled} size="sm" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <TimeCell
          label={fromLabel}
          scheduled={train.depScheduled}
          predicted={train.depEstimated}
          cancelled={cancelled}
        />
        <ArrowRight className="w-4 h-4 text-zinc-600 shrink-0" />
        <TimeCell
          label={toLabel}
          scheduled={train.arrScheduled}
          predicted={train.arrPredicted}
          cancelled={cancelled}
          alignRight
        />
      </div>
    </div>
  );
}

function TimeCell({
  label,
  scheduled,
  predicted,
  cancelled,
  alignRight,
}: {
  label: string;
  scheduled: string;
  predicted: string | null;
  cancelled: boolean;
  alignRight?: boolean;
}) {
  const changed = predicted && predicted !== scheduled;
  return (
    <div className={`flex-1 min-w-0 ${alignRight ? "text-right" : ""}`}>
      <div className="text-xs text-zinc-500 truncate">{label}</div>
      <div className={`flex items-baseline gap-2 ${alignRight ? "justify-end" : ""}`}>
        <span
          className={`text-lg font-bold tabular-nums ${
            cancelled
              ? "text-zinc-500 line-through"
              : changed
              ? "text-zinc-500 line-through"
              : "text-white"
          }`}
        >
          {scheduled || "–"}
        </span>
        {changed && !cancelled && (
          <span className="text-lg font-bold tabular-nums text-orange-400">{predicted}</span>
        )}
      </div>
    </div>
  );
}
