// Appends ?demo=1 to API calls when the page itself was opened with ?demo
export function withDemo(url: string): string {
  if (typeof window === "undefined") return url;
  if (!new URLSearchParams(window.location.search).has("demo")) return url;
  return url + (url.includes("?") ? "&" : "?") + "demo=1";
}

export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("demo");
}

// Deterministic "typical delay" for a train number, so demo previews of the
// reliability badge/line are populated for any train (real data comes from
// /api/reliability). Pure — safe on both client and server.
export function demoExpectedDelay(trainNumber: string): number {
  const n = Math.abs(Number(trainNumber) || trainNumber.length);
  const pattern = [0, 2, 5, 1, 8, 3, 12, 0, 4, 6, 2, 1, 9, 3];
  return pattern[n % pattern.length];
}
