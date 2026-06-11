"use client";

import { useEffect, useState } from "react";
import { withDemo } from "@/lib/clientDemo";
import { TrendingUp, TrendingDown, Minus, AlertOctagon, Loader2 } from "lucide-react";

interface TrainStat {
  trainNumber: string;
  category: string;
  direction: string;
  totalRecorded: number;
  onTimePercent: number | null;
  avgDelay: number;
  cancelledCount: number;
}

interface DailyStat {
  date: string;
  avgDelay: number;
  cancelled: number;
}

interface StatsData {
  trains: TrainStat[];
  daily: DailyStat[];
}

function OnTimeBar({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-zinc-500 text-sm">No data</span>;
  const color =
    percent >= 80 ? "bg-emerald-500" : percent >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-sm font-semibold tabular-nums text-zinc-300 w-10 text-right">
        {percent}%
      </span>
    </div>
  );
}

export function StatsView() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(withDemo("/api/stats"))
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-2">
        <AlertOctagon className="w-7 h-7" />
        <p className="text-sm">Could not load statistics</p>
      </div>
    );
  }

  if (data.trains.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-500">
        <div className="text-5xl mb-4">🦫</div>
        <p className="font-medium text-zinc-400">No data collected yet</p>
        <p className="text-sm mt-2">
          BOBR will start collecting punctuality data as soon as the cron job runs.
        </p>
      </div>
    );
  }

  const sorted = [...data.trains].sort((a, b) => (a.onTimePercent ?? 0) - (b.onTimePercent ?? 0));

  // Mini sparkline for daily delays
  const maxDelay = Math.max(...data.daily.map((d) => d.avgDelay), 1);

  return (
    <div className="space-y-6">
      {/* Daily chart */}
      {data.daily.length > 1 && (
        <section>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            Avg. delay — last 30 days
          </h3>
          <div className="flex items-end gap-1 h-16 bg-white/5 rounded-xl px-3 py-2">
            {data.daily.slice(-30).map((d) => (
              <div key={d.date} className="flex-1 flex flex-col justify-end" title={`${d.date}: +${d.avgDelay}min`}>
                <div
                  className={`rounded-sm w-full ${d.avgDelay === 0 ? "bg-emerald-600" : d.avgDelay <= 5 ? "bg-yellow-500" : "bg-orange-500"}`}
                  style={{ height: `${Math.max(4, (d.avgDelay / maxDelay) * 48)}px` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-zinc-600 mt-1 px-1">
            <span>{data.daily[0]?.date}</span>
            <span>{data.daily[data.daily.length - 1]?.date}</span>
          </div>
        </section>
      )}

      {/* Per-train table */}
      <section>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
          Punctuality by train
        </h3>
        <div className="space-y-3">
          {sorted.map((t) => (
            <div key={t.trainNumber} className="bg-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md mr-2">
                    {t.category} {t.trainNumber}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {t.direction === "BZ_BX" ? "BZ → BX" : "BX → BZ"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  {(t.onTimePercent ?? 0) >= 80 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (t.onTimePercent ?? 0) >= 60 ? (
                    <Minus className="w-3.5 h-3.5 text-yellow-400" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span>avg +{t.avgDelay}min</span>
                </div>
              </div>
              <OnTimeBar percent={t.onTimePercent} />
              <div className="flex justify-between text-xs text-zinc-600 mt-1.5">
                <span>{t.totalRecorded} records</span>
                {t.cancelledCount > 0 && (
                  <span className="text-red-500">{t.cancelledCount}× cancelled</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
