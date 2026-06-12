// Long-distance categories get distinct styling (diamond markers, violet chips)
const LONG_DISTANCE = new Set(["EC", "FR", "FB", "IC", "FA", "EN", "RJ", "ES"]);

export function isLongDistance(category: string): boolean {
  const c = category.trim().toUpperCase();
  if (LONG_DISTANCE.has(c)) return true;
  return c.includes("FRECCIA") || c.includes("EUROCITY") || c.includes("INTERCITY");
}
