export function formatQps(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} K`;
  return String(Math.round(value));
}

export function formatSeconds(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  if (value < 0.001) return `${(value * 1_000_000).toFixed(0)} us`;
  if (value < 1) return `${(value * 1_000).toFixed(1)} ms`;
  return `${value.toFixed(2)} s`;
}

export function formatCount(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString("en-US") : "n/a";
}

export function median(values: number[]): number {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
