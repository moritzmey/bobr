"use client";

interface Props {
  delayMinutes: number;
  cancelled: boolean;
  size?: "sm" | "md";
}

export function DelayBadge({ delayMinutes, cancelled, size = "md" }: Props) {
  const base = size === "sm" ? "text-xs px-2 py-0.5 rounded-full font-semibold" : "text-sm px-3 py-1 rounded-full font-bold";

  if (cancelled) {
    return (
      <span className={`${base} bg-red-600 text-white tracking-wide`}>
        CANCELLED
      </span>
    );
  }

  if (delayMinutes === 0) {
    return (
      <span className={`${base} bg-emerald-500/20 text-emerald-400 border border-emerald-500/30`}>
        On time
      </span>
    );
  }

  if (delayMinutes <= 5) {
    return (
      <span className={`${base} bg-yellow-500/20 text-yellow-400 border border-yellow-500/30`}>
        +{delayMinutes} min
      </span>
    );
  }

  if (delayMinutes <= 15) {
    return (
      <span className={`${base} bg-orange-500/20 text-orange-400 border border-orange-500/30`}>
        +{delayMinutes} min
      </span>
    );
  }

  return (
    <span className={`${base} bg-red-500/20 text-red-400 border border-red-500/30`}>
      +{delayMinutes} min
    </span>
  );
}

export function delayColor(delayMinutes: number, cancelled: boolean): string {
  if (cancelled) return "text-red-400";
  if (delayMinutes === 0) return "text-emerald-400";
  if (delayMinutes <= 5) return "text-yellow-400";
  if (delayMinutes <= 15) return "text-orange-400";
  return "text-red-400";
}
