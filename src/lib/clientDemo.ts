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
