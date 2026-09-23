const intFmt = new Intl.NumberFormat("pt-BR");
const compactFmt = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export const formatInt = (n: number) => intFmt.format(Math.round(n));
export const formatCompact = (n: number) => (Math.abs(n) < 10000 ? formatInt(n) : compactFmt.format(n));

export function formatPct(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return "-";
  return `${(ratio * 100).toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
