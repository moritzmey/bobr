"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

// Email is assembled from char codes only after user interaction,
// so it never appears as plain text in the served HTML or DOM.
const CODES = [77, 46, 77, 101, 121, 101, 114, 49, 57, 57, 53, 64, 103, 109, 97, 105, 108, 46, 99, 111, 109];

export function ProtectedEmail() {
  const [email, setEmail] = useState<string | null>(null);

  if (email) {
    return (
      <a
        href={`mailto:${email}`}
        className="inline-flex items-center gap-2 text-white underline underline-offset-4 decoration-zinc-600 hover:decoration-white transition-colors"
      >
        <Mail className="w-4 h-4 text-zinc-400" />
        {email}
      </a>
    );
  }

  return (
    <button
      onClick={() => setEmail(String.fromCharCode(...CODES))}
      className="inline-flex items-center gap-2 text-sm bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
    >
      <Mail className="w-4 h-4" />
      E-Mail-Adresse anzeigen
    </button>
  );
}
