"use client";

import { TrainDeparture } from "@/lib/trenitalia";
import { DelayBadge } from "./DelayBadge";
import { Train, MapPin, Clock } from "lucide-react";
import { useState } from "react";
import { TrainDetailModal } from "./TrainDetailModal";

interface Props {
  train: TrainDeparture;
  stationId: string;
}

export function TrainCard({ train, stationId }: Props) {
  const [open, setOpen] = useState(false);

  const isCancelled = train.cancelled;
  const hasDelay = train.delayMinutes > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 active:scale-[0.98] hover:border-white/20
          ${isCancelled
            ? "bg-red-950/30 border-red-800/40"
            : hasDelay
            ? "bg-orange-950/20 border-orange-800/30 hover:bg-orange-950/30"
            : "bg-white/5 border-white/10 hover:bg-white/8"
          }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-md">
                {train.category} {train.trainNumber}
              </span>
              {train.platform && (
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Bin. {train.platform}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Train className="w-4 h-4 text-zinc-400 shrink-0" />
              <span className={`font-semibold truncate ${isCancelled ? "line-through text-zinc-500" : "text-white"}`}>
                {train.destination}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span className={`text-lg font-bold tabular-nums ${isCancelled ? "text-zinc-500 line-through" : "text-white"}`}>
                {train.scheduledTime}
              </span>
            </div>
            <DelayBadge delayMinutes={train.delayMinutes} cancelled={train.cancelled} size="sm" />
          </div>
        </div>
        {hasDelay && !isCancelled && train.estimatedTime && (
          <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1">
            <span>Est. departure:</span>
            <span className="text-orange-400 font-semibold">{train.estimatedTime}</span>
          </div>
        )}
      </button>

      {open && (
        <TrainDetailModal
          train={train}
          stationId={stationId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
