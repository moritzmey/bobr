"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import type { Disruption, Severity } from "@/lib/disruptions";
import { AlertTriangle, Megaphone, Info, ChevronDown, X } from "lucide-react";

const REFRESH_INTERVAL = 5 * 60_000;
const DISMISS_KEY = "bobr-disruptions-dismissed";

const STYLES: Record<Severity, { wrap: string; chip: string; icon: typeof AlertTriangle; label: string }> = {
  strike: {
    wrap: "bg-red-600/15 border-red-500/40",
    chip: "bg-red-500/25 text-red-200 border-red-400/40",
    icon: Megaphone,
    label: "Streik",
  },
  severe: {
    wrap: "bg-red-950/40 border-red-800/50",
    chip: "bg-red-500/20 text-red-300 border-red-500/30",
    icon: AlertTriangle,
    label: "Störung",
  },
  high: {
    wrap: "bg-amber-950/30 border-amber-700/40",
    chip: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    icon: AlertTriangle,
    label: "Hinweis",
  },
  info: {
    wrap: "bg-sky-950/30 border-sky-800/40",
    chip: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    icon: Info,
    label: "Info",
  },
};

function fmtDate(iso: string): string {
  return format(new Date(iso), "d. MMM", { locale: de });
}

function whenLabel(d: Disruption): string | null {
  if (!d.active && d.from && Date.parse(d.from) > Date.now()) return `ab ${fmtDate(d.from)}`;
  if (d.active && d.to) return `bis ${fmtDate(d.to)}`;
  if (d.active) return "aktiv";
  return null;
}

export function DisruptionBanner() {
  const [items, setItems] = useState<Disruption[]>([]);
  const [open, setOpen] = useState(false);
  // Read the dismissed signature lazily; SSR-safe because the banner renders
  // nothing until `items` arrive (client-only), so there's no hydration gap.
  const [dismissed, setDismissed] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(DISMISS_KEY)
  );

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/disruptions")
        .then((r) => r.json())
        .then((d) => !cancelled && setItems(d.disruptions ?? []))
        .catch(() => {});
    load();
    const id = setInterval(load, REFRESH_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Signature changes whenever the message set changes, so dismissing hides the
  // banner only until something new or updated arrives.
  const signature = useMemo(() => items.map((d) => `${d.id}:${d.version}`).join("|"), [items]);

  if (items.length === 0 || signature === dismissed) return null;

  const top = items[0];
  const style = STYLES[top.severity];
  const Icon = style.icon;
  const rest = items.length - 1;

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(DISMISS_KEY, signature);
    setDismissed(signature);
    setOpen(false);
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-3">
      <div className={`rounded-2xl border ${style.wrap} overflow-hidden`}>
        {/* Collapsed header — always the most severe message */}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 text-left flex-1 min-w-0"
            aria-expanded={open}
          >
            <Icon className="w-4 h-4 shrink-0 text-white/90" />
            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${style.chip}`}>
              {style.label}
            </span>
            <span className="text-sm text-white font-medium truncate flex-1 min-w-0">{top.title}</span>
            {rest > 0 && !open && <span className="text-xs text-zinc-400 shrink-0">+{rest}</span>}
            <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <button onClick={dismiss} className="p-0.5 text-zinc-500 hover:text-zinc-200 shrink-0" aria-label="Ausblenden">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Expanded list */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-3.5 pb-3 pt-0.5 space-y-3 border-t border-white/10 max-h-[55vh] overflow-y-auto">
                {items.map((d) => (
                  <DisruptionItem key={`${d.id}:${d.version}`} d={d} />
                ))}
                <p className="text-[10px] text-zinc-600 pt-1">Quelle: STA · südtirolmobil</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DisruptionItem({ d }: { d: Disruption }) {
  const style = STYLES[d.severity];
  const when = whenLabel(d);
  return (
    <div className="pt-3 first:pt-2">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${style.chip}`}>
          {style.label}
        </span>
        {d.lines.slice(0, 5).map((l) => (
          <span key={l} className="text-[10px] font-medium text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded">
            {l}
          </span>
        ))}
        {when && <span className="text-[10px] text-zinc-400 ml-auto shrink-0">{when}</span>}
      </div>
      <p className="text-sm text-white font-medium leading-snug">{d.title}</p>
      {d.text && (
        <p className="text-xs text-zinc-400 leading-relaxed mt-1 whitespace-pre-line line-clamp-6">{d.text}</p>
      )}
    </div>
  );
}
