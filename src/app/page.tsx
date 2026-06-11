"use client";

import { useState } from "react";
import { BeaverLogo } from "@/components/BeaverLogo";
import { DepartureBoard } from "@/components/DepartureBoard";
import { StatsView } from "@/components/StatsView";
import { STATIONS } from "@/lib/trenitalia";
import { BarChart3, Train, ArrowLeftRight } from "lucide-react";

type Tab = "bz_bx" | "bx_bz" | "stats";

export default function Home() {
  const [tab, setTab] = useState<Tab>("bz_bx");

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
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-white/5 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            Live
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
          <TabButton
            active={tab === "bz_bx"}
            onClick={() => setTab("bz_bx")}
            icon={<Train className="w-3.5 h-3.5" />}
            label="BZ → BX"
          />
          <TabButton
            active={tab === "bx_bz"}
            onClick={() => setTab("bx_bz")}
            icon={<ArrowLeftRight className="w-3.5 h-3.5" />}
            label="BX → BZ"
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
        {tab === "bz_bx" && (
          <>
            <SectionHeader
              from={STATIONS.BOLZANO.name}
              to={STATIONS.BRESSANONE.name}
            />
            <DepartureBoard
              stationKey="BOLZANO"
              stationId={STATIONS.BOLZANO.id}
            />
          </>
        )}
        {tab === "bx_bz" && (
          <>
            <SectionHeader
              from={STATIONS.BRESSANONE.name}
              to={STATIONS.BOLZANO.name}
            />
            <DepartureBoard
              stationKey="BRESSANONE"
              stationId={STATIONS.BRESSANONE.id}
            />
          </>
        )}
        {tab === "stats" && (
          <>
            <div className="mb-4">
              <h2 className="font-bold text-lg">Punctuality statistics</h2>
              <p className="text-sm text-zinc-500 mt-0.5">Last 30 days · BZ ↔ BX corridor</p>
            </div>
            <StatsView />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-lg mx-auto px-4 pb-6 text-center text-xs text-zinc-700">
        Data from Trenitalia · Refreshes every 60s · 🦫 BOBR watches the trains so you don&apos;t have to
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
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
        active
          ? "bg-white text-zinc-900 shadow-sm"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SectionHeader({ from, to }: { from: string; to: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-bold text-lg">
        {from} <span className="text-zinc-500">→</span> {to}
      </h2>
      <p className="text-sm text-zinc-500 mt-0.5">Upcoming departures</p>
    </div>
  );
}
