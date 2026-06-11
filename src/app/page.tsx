"use client";

import { useEffect, useState } from "react";
import { BeaverLogo } from "@/components/BeaverLogo";
import { DepartureBoard } from "@/components/DepartureBoard";
import { StatsView } from "@/components/StatsView";
import { LiveMap } from "@/components/LiveMap";
import { Leaderboard } from "@/components/Leaderboard";
import { STATIONS } from "@/lib/trenitalia";
import { isDemo } from "@/lib/clientDemo";
import { BarChart3, Train, Map, Trophy } from "lucide-react";

type Tab = "map" | "departures" | "ranking" | "stats";
type DirectionKey = "BOLZANO" | "BRESSANONE";

export default function Home() {
  const [tab, setTab] = useState<Tab>("map");
  const [direction, setDirection] = useState<DirectionKey>("BOLZANO");
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    setDemo(isDemo());
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (wanted && ["map", "departures", "ranking", "stats"].includes(wanted)) {
      setTab(wanted as Tab);
    }
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-white/8">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BeaverLogo className="w-9 h-9" />
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none">BOBR</h1>
              <p className="text-xs text-zinc-500 leading-none mt-0.5">Bozen · Brixen</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {demo && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded-full">
                Demo
              </span>
            )}
            <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-white/5 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
          <TabButton
            active={tab === "map"}
            onClick={() => setTab("map")}
            icon={<Map className="w-3.5 h-3.5" />}
            label="Karte"
          />
          <TabButton
            active={tab === "departures"}
            onClick={() => setTab("departures")}
            icon={<Train className="w-3.5 h-3.5" />}
            label="Abfahrten"
          />
          <TabButton
            active={tab === "ranking"}
            onClick={() => setTab("ranking")}
            icon={<Trophy className="w-3.5 h-3.5" />}
            label="Ranking"
          />
          <TabButton
            active={tab === "stats"}
            onClick={() => setTab("stats")}
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            label="Stats"
          />
        </div>
      </div>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 pt-4 pb-8">
        {tab === "map" && <LiveMap />}

        {tab === "departures" && (
          <>
            {/* Direction toggle */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-xl mb-4">
              <button
                onClick={() => setDirection("BOLZANO")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                  direction === "BOLZANO"
                    ? "bg-white/15 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Bozen → Brixen
              </button>
              <button
                onClick={() => setDirection("BRESSANONE")}
                className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                  direction === "BRESSANONE"
                    ? "bg-white/15 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Brixen → Bozen
              </button>
            </div>
            <DepartureBoard
              key={direction}
              stationKey={direction}
              stationId={STATIONS[direction].id}
            />
          </>
        )}

        {tab === "ranking" && <Leaderboard />}

        {tab === "stats" && (
          <>
            <div className="mb-4">
              <h2 className="font-bold text-lg">Pünktlichkeits-Statistik</h2>
              <p className="text-sm text-zinc-500 mt-0.5">Letzte 30 Tage · Strecke BZ ↔ BX</p>
            </div>
            <StatsView />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-lg mx-auto px-4 pb-6 text-center text-xs text-zinc-700">
        Daten: Trenitalia · 🦫 BOBR schaut auf die Züge, damit du es nicht musst
      </footer>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
        active
          ? "bg-white text-zinc-900 shadow-sm"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      <span className="hidden sm:inline">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
