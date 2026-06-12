import type { Metadata } from "next";
import Link from "next/link";
import { BeaverLogo } from "@/components/BeaverLogo";
import { ProtectedEmail } from "@/components/ProtectedEmail";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Impressum — BOBR",
  robots: { index: false },
};

export default function Impressum() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-white/8">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Zurück"
          >
            <ArrowLeft className="w-5 h-5 text-zinc-400" />
          </Link>
          <BeaverLogo className="w-8 h-8" />
          <h1 className="text-lg font-black tracking-tight">Impressum</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-8 text-sm leading-relaxed text-zinc-300">
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            Angaben gemäß gesetzlicher Informationspflicht
          </h2>
          <p className="font-semibold text-white text-base">Moritz Meyer</p>
          <div className="mt-3">
            <ProtectedEmail />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            Über dieses Projekt
          </h2>
          <p>
            BOBR ist ein privates, nicht-kommerzielles Hobbyprojekt. Es zeigt
            Echtzeitdaten zum Zugverkehr in Südtirol und sammelt Statistiken
            zur Pünktlichkeit auf der Strecke Bozen–Brixen.
          </p>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            Haftungsausschluss
          </h2>
          <p>
            Alle angezeigten Fahrplan-, Verspätungs- und Positionsdaten stammen
            aus öffentlich zugänglichen Schnittstellen von Trenitalia
            (Viaggiatreno) und werden ohne Gewähr wiedergegeben. Für die
            Richtigkeit, Vollständigkeit und Aktualität der Daten wird keine
            Haftung übernommen. Diese Seite steht in keiner Verbindung zu
            Trenitalia, RFI, SAD, STA oder dem Land Südtirol. Maßgeblich sind
            stets die offiziellen Auskünfte der Bahnbetreiber.
          </p>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            Datenschutz
          </h2>
          <p>
            Diese Seite verwendet keine Cookies, kein Tracking und keine
            Analysedienste. Es werden keine personenbezogenen Daten erhoben
            oder gespeichert. Beim Aufruf der Seite fallen technisch bedingte
            Server-Logs beim Hosting-Anbieter Vercel Inc. an; die gesammelten
            Zugdaten enthalten keinerlei Personenbezug und werden bei Supabase
            (Region EU, Frankfurt) gespeichert.
          </p>
        </section>

        <p className="text-zinc-600 text-xs pt-4 border-t border-white/5">
          🦫 BOBR — Bozen·Brixen · Stand: Juni 2026
        </p>
      </main>
    </div>
  );
}
