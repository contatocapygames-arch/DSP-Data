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

/** Valor monetário sem símbolo (a moeda depende da conta do AMC). Compacta acima de 100 mil. */
export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "-";
  if (Math.abs(n) >= 100000) return compactFmt.format(n);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Multiplicador (ROAS, lift): "3,61" ou "2,3x". */
export function formatMultiple(n: number, suffix = ""): string {
  if (!Number.isFinite(n)) return "-";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: n < 10 ? 2 : 1, maximumFractionDigits: n < 10 ? 2 : 1 })}${suffix}`;
}

/** Participação com precisão que não esconde valores pequenos: 0,04% em vez de 0,0%. */
export function formatShare(ratio: number): string {
  return formatPct(ratio, Number.isFinite(ratio) && ratio !== 0 && Math.abs(ratio) < 0.01 ? 2 : 1);
}

/** Valor monetário completo com 2 casas (para tabelas, onde a coluna precisa ser comparável). */
export function formatMoneyFull(n: number): string {
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Reais: compacto ("R$ 1,2 mi") por padrão, completo ("R$ 12.345,67") para tabelas. */
export function formatBRL(n: number, compact = true): string {
  if (!Number.isFinite(n)) return "-";
  if (compact && Math.abs(n) >= 10000) return `R$ ${compactFmt.format(n)}`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
