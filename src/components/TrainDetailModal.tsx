"use client";

import { useEffect, useState } from "react";
import { TrainDeparture, TrainStatus } from "@/lib/trenitalia";
import { withDemo } from "@/lib/clientDemo";
import { DelayBadge } from "./DelayBadge";
import { X, MapPin, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  train: TrainDeparture;
  stationId: string;
  onClose: () => void;
}

function todayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function TrainDetailModal({ train, stationId, onClose }: Props) {
  const [status, setStatus] = useState<TrainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      number: train.trainNumber,
      origin: train.originId || stationId,
      date: String(todayMs()),
    });
    fetch(withDemo(`/api/train?${params}`))
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setStatus(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [train.trainNumber, train.originId, stationId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-lg bg-zinc-900 border border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs text-zinc-400 mb-1">
                {train.category} {train.trainNumber}
              </div>
              <h2 className="text-xl font-bold text-white">
                → {train.destination}
              </h2>
              <div className="text-zinc-400 text-sm mt-0.5">
                Dep. {train.scheduledTime}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
              <DelayBadge
                delayMinutes={train.delayMinutes}
                cancelled={train.cancelled}
              />
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-950/30 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="text-sm">Could not load real-time data</span>
            </div>
          )}

          {status && (
            <>
              {status.lastSeenAt && (
                <div className="flex items-center gap-2 text-zinc-400 text-sm mb-4 bg-white/5 rounded-xl p-3">
                  <MapPin className="w-4 h-4 text-zinc-500" />
                  Last tracked at: <span className="text-white">{status.lastSeenAt}</span>
                </div>
              )}

              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                Stops
              </h3>
              <div className="space-y-0">
                {status.stops.map((stop, i) => {
                  const isBZ = stop.stationName.toUpperCase().includes("BOLZANO") || stop.stationName.toUpperCase().includes("BOZEN");
                  const isBX = stop.stationName.toUpperCase().includes("BRESSANONE") || stop.stationName.toUpperCase().includes("BRIXEN");
                  const isHighlight = isBZ || isBX;

                  return (
                    <div
                      key={i}
                      className={`relative flex items-center gap-3 py-2.5 ${i < status.stops.length - 1 ? "border-b border-white/5" : ""}`}
                    >
                      {/* Timeline dot */}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isHighlight ? "bg-amber-400" : "bg-zinc-600"}`} />

                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${isHighlight ? "text-amber-400 font-semibold" : "text-zinc-300"}`}>
                          {stop.stationName}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-sm tabular-nums shrink-0">
                        <div className="text-right">
                          {stop.scheduledArrival && (
                            <div className="text-zinc-400">{stop.scheduledArrival}</div>
                          )}
                          {stop.actualArrival && stop.actualArrival !== stop.scheduledArrival && (
                            <div className="text-orange-400 font-semibold">{stop.actualArrival}</div>
                          )}
                        </div>
                        {stop.delayMinutes > 0 && (
                          <DelayBadge delayMinutes={stop.delayMinutes} cancelled={false} size="sm" />
                        )}
                        {stop.delayMinutes === 0 && stop.actualArrival && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
