"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TrainDeparture } from "@/lib/trenitalia";
import { withDemo } from "@/lib/clientDemo";
import { TrainCard } from "./TrainCard";
import { RefreshCw, WifiOff } from "lucide-react";

interface Props {
  stationKey: "BOLZANO" | "BRESSANONE";
  stationId: string;
}

const REFRESH_INTERVAL = 60_000;

export function DepartureBoard({ stationKey, stationId }: Props) {
  const [trains, setTrains] = useState<TrainDeparture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) setRefreshing(true);
      try {
        const res = await fetch(withDemo(`/api/departures?station=${stationKey}`));
        if (!res.ok) throw new Error("API error");
        const data: TrainDeparture[] = await res.json();
        setTrains(data);
        setLastUpdated(new Date());
        setError(null);
      } catch {
        setError("Could not load train data. Check your connection.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [stationKey]
  );

  useEffect(() => {
    load();
    timerRef.current = setInterval(() => load(), REFRESH_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  const disrupted = trains.filter((t) => t.cancelled || t.delayMinutes > 10);

  return (
    <div>
      {/* Status bar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {disrupted.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-400 bg-orange-900/30 px-2.5 py-1 rounded-full border border-orange-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              {disrupted.length} disruption{disrupted.length > 1 ? "s" : ""}
            </span>
          ) : trains.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-900/30 px-2.5 py-1 rounded-full border border-emerald-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              All on time
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {lastUpdated && (
            <span>
              {lastUpdated.toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-1 hover:text-zinc-300 transition-colors disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
          <WifiOff className="w-8 h-8" />
          <p className="text-sm">{error}</p>
          <button
            onClick={() => load()}
            className="text-xs text-zinc-400 underline hover:text-white"
          >
            Try again
          </button>
        </div>
      )}

      {!loading && !error && trains.length === 0 && (
        <p className="text-center py-10 text-zinc-500 text-sm">
          No departures found in the next few hours.
        </p>
      )}

      {!loading && !error && trains.length > 0 && (
        <div className="space-y-2.5">
          {trains.map((train) => (
            <TrainCard key={`${train.trainNumber}-${train.scheduledTime}`} train={train} stationId={stationId} />
          ))}
        </div>
      )}
    </div>
  );
}
