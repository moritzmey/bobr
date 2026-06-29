// ---------------------------------------------------------------------------
// Service disruptions (Mitteilungen) from STA / südtirolmobil.
//
// südtirolmobil runs on a Mentz EFA backend whose addinfo endpoint publishes
// the live service-message feed (closures, replacement buses, schedule changes
// and — when they happen — strikes). It's South-Tyrol-local and tagged with the
// affected lines, so it's a far better fit than the national Viaggiatreno ticker
// or the ÖBB HIM feed for our rail network.
//
// We keep only rail-relevant messages, drop perpetual standing notices (season
// passes, tariffs), flag strikes, and normalise into a compact shape for the
// banner. Undocumented endpoint → treat as best-effort.
// ---------------------------------------------------------------------------

const ENDPOINT = "https://efa.sta.bz.it/apb/XML_ADDINFO_REQUEST?outputFormat=rapidJSON&language=de";

export type Severity = "strike" | "severe" | "high" | "info";

export interface Disruption {
  id: string;
  version: number;
  severity: Severity;
  isStrike: boolean;
  title: string;
  subtitle: string | null; // line/route context, e.g. "Linie REG …"
  text: string; // plain text (tags stripped, entities decoded)
  lines: string[]; // affected rail line/category codes (REG, EC, REX…)
  from: string | null; // ISO start of the relevant validity window
  to: string | null; // ISO end
  active: boolean; // now is within a validity window
}

// Rail line/category codes as the feed labels them; everything else (numeric or
// "B…" line numbers) is bus and gets filtered out.
const RAIL = new Set([
  "REG", "RV", "RE", "R", "RB", "EC", "EN", "NJ", "IC", "ICN", "REX", "RJ", "RJX", "AV", "EXP", "D",
]);

const PRIORITY_RANK: Record<string, number> = { veryLow: 0, low: 1, normal: 2, high: 3, veryHigh: 4 };
const STANDING_NOTICE_DAYS = 120; // longer-running + low urgency ⇒ standing info, not a disruption

interface RawLine {
  number?: string;
  name?: string;
}
interface RawInfoLink {
  language?: string;
  title?: string;
  subtitle?: string;
  content?: string;
}
interface RawWindow {
  from?: string;
  to?: string;
}
interface RawInfo {
  id?: string;
  version?: number;
  priority?: string;
  timestamps?: { validity?: RawWindow[] };
  infoLinks?: RawInfoLink[];
  affected?: { lines?: RawLine[] };
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", shy: "",
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
  agrave: "à", egrave: "è", igrave: "ì", ograve: "ò", ugrave: "ù",
  eacute: "é", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  hellip: "…", deg: "°", euro: "€", sect: "§", middot: "·", bull: "•",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name) => (name in ENTITIES ? ENTITIES[name] : m));
}

function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const STRIKE_RE = /\b(streik|sciopero|strike|arbeitsnieder)/i;

function railTags(lines: RawLine[]): string[] {
  const out = new Set<string>();
  for (const l of lines) {
    const code = String(l.number ?? l.name ?? "").trim().toUpperCase();
    if (RAIL.has(code)) out.add(code);
  }
  return [...out];
}

// Pick the validity window most relevant to "now": the one currently in effect,
// else the next upcoming one, else the most recent past one.
function pickWindow(windows: RawWindow[], now: number): { from: string | null; to: string | null; active: boolean } {
  const parsed = windows
    .map((w) => ({ from: w.from ?? null, to: w.to ?? null, f: w.from ? Date.parse(w.from) : NaN, t: w.to ? Date.parse(w.to) : NaN }))
    .filter((w) => !Number.isNaN(w.f) || !Number.isNaN(w.t));
  if (parsed.length === 0) return { from: null, to: null, active: false };

  const current = parsed.find((w) => (Number.isNaN(w.f) || w.f <= now) && (Number.isNaN(w.t) || w.t >= now));
  if (current) return { from: current.from, to: current.to, active: true };

  const upcoming = parsed.filter((w) => w.f > now).sort((a, b) => a.f - b.f)[0];
  if (upcoming) return { from: upcoming.from, to: upcoming.to, active: false };

  const last = parsed.sort((a, b) => (b.t || b.f) - (a.t || a.f))[0];
  return { from: last.from, to: last.to, active: false };
}

function windowSpanDays(windows: RawWindow[]): number {
  let max = 0;
  for (const w of windows) {
    if (w.from && w.to) max = Math.max(max, (Date.parse(w.to) - Date.parse(w.from)) / 86_400_000);
  }
  return max;
}

interface RawResponse {
  infos?: { current?: RawInfo[] };
}

export async function fetchDisruptions(now: number = Date.now()): Promise<Disruption[]> {
  const res = await fetch(ENDPOINT, {
    headers: {
      "User-Agent":
        "BOBR/1.0 (private non-commercial train punctuality project; +https://bobr.meyermoritz.com/impressum)",
    },
    // Disruptions change on the order of minutes; cache to spare the STA backend.
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`STA addinfo error: ${res.status}`);
  const data: RawResponse = await res.json();
  const current = data.infos?.current ?? [];

  const out: Disruption[] = [];
  const seen = new Set<string>();

  for (const info of current) {
    const lines = railTags(info.affected?.lines ?? []);
    if (lines.length === 0) continue; // not a rail message

    const links = info.infoLinks ?? [];
    const de = links.find((l) => l.language === "de") ?? links[0];
    if (!de) continue;
    const title = (de.title || de.subtitle || "").trim();
    if (!title) continue;

    const text = htmlToText(de.content || "");
    const isStrike = STRIKE_RE.test(`${title} ${text}`);
    const rank = PRIORITY_RANK[info.priority ?? "normal"] ?? 2;

    // Keep urgent/strike messages; drop low-priority chatter and long-running
    // standing notices (season passes, tariff info) that aren't real disruptions.
    const standing = windowSpanDays(info.timestamps?.validity ?? []) > STANDING_NOTICE_DAYS;
    if (!isStrike && (rank < 2 || (rank < 3 && standing))) continue;

    const id = info.id ?? title;
    if (seen.has(id)) continue;
    seen.add(id);

    const win = pickWindow(info.timestamps?.validity ?? [], now);
    const severity: Severity = isStrike ? "strike" : rank >= 4 ? "severe" : rank >= 3 ? "high" : "info";

    out.push({
      id,
      version: info.version ?? 0,
      severity,
      isStrike,
      title,
      subtitle: de.subtitle?.trim() || null,
      text,
      lines,
      from: win.from,
      to: win.to,
      active: win.active,
    });
  }

  const sevWeight: Record<Severity, number> = { strike: 3, severe: 2, high: 1, info: 0 };
  out.sort(
    (a, b) =>
      sevWeight[b.severity] - sevWeight[a.severity] ||
      Number(b.active) - Number(a.active) ||
      (Date.parse(a.from ?? "") || 0) - (Date.parse(b.from ?? "") || 0)
  );
  return out;
}
