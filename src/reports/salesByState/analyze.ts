import { BRAZIL_POPULATION, REGIONS, toUf, UFS, type RegionId } from "../../lib/brazil";
import { columnIndex, parseNumber, type CsvTable } from "../../lib/csv";
import { ReportParseError } from "../types";

export interface StateMetrics {
  orders: number;
  ntbOrders: number;
  sales: number;
  ntbSales: number;
}

export interface StateRow {
  advertiser: string;
  uf: string;
  metrics: StateMetrics;
}

export interface ParsedStates {
  rows: StateRow[];
  advertisers: string[];
  /** Linhas com código que não é UF brasileira (outros países ou código desconhecido). */
  unmatched: { code: string; metrics: StateMetrics }[];
  warnings: string[];
}

export const REQUIRED_COLUMNS = ["iso_state_province_code", "total_conversions", "total_sales"];
export const OPTIONAL_COLUMNS = ["advertiser", "advertiser_id", "ntb_conversions", "ntb_sales"];

export const emptyStateMetrics = (): StateMetrics => ({ orders: 0, ntbOrders: 0, sales: 0, ntbSales: 0 });

function add(into: StateMetrics, m: StateMetrics): StateMetrics {
  into.orders += m.orders;
  into.ntbOrders += m.ntbOrders;
  into.sales += m.sales;
  into.ntbSales += m.ntbSales;
  return into;
}

export function parseStatesTable(table: CsvTable): ParsedStates {
  const idx = (c: string) => columnIndex(table, c);
  const missing = REQUIRED_COLUMNS.filter((c) => idx(c) < 0);
  if (missing.length > 0) {
    throw new ReportParseError(
      `O CSV não tem a(s) coluna(s) ${missing.join(", ")}. Colunas encontradas: ${table.headers.join(", ") || "nenhuma"}.`,
    );
  }
  const num = (r: string[], c: string) => {
    const v = idx(c) >= 0 ? parseNumber(r[idx(c)] ?? "") : NaN;
    return Number.isFinite(v) ? v : 0;
  };
  const text = (r: string[], c: string) => (idx(c) >= 0 ? (r[idx(c)] ?? "").trim() : "");

  const rows: StateRow[] = [];
  const unmatchedMap = new Map<string, StateMetrics>();
  for (const r of table.rows) {
    const code = text(r, "iso_state_province_code");
    const metrics: StateMetrics = {
      orders: num(r, "total_conversions"),
      ntbOrders: num(r, "ntb_conversions"),
      sales: num(r, "total_sales"),
      ntbSales: num(r, "ntb_sales"),
    };
    const uf = toUf(code);
    if (!uf) {
      if (code) unmatchedMap.set(code, add(unmatchedMap.get(code) ?? emptyStateMetrics(), metrics));
      continue;
    }
    const advertiser = text(r, "advertiser") || text(r, "advertiser_id") || "Anunciante";
    rows.push({ advertiser, uf, metrics });
  }
  if (rows.length === 0) {
    throw new ReportParseError("Nenhuma linha com estado brasileiro reconhecido (esperado iso_state_province_code como BR-SP ou SP).");
  }

  const unmatched = [...unmatchedMap.entries()].map(([code, metrics]) => ({ code, metrics })).sort((a, b) => b.metrics.sales - a.metrics.sales);
  const warnings: string[] = [];
  if (unmatched.length > 0) {
    const sales = unmatched.reduce((s, u) => s + u.metrics.sales, 0);
    warnings.push(
      `${unmatched.length} código(s) fora das UFs brasileiras ficaram de fora do mapa (${unmatched
        .slice(0, 5)
        .map((u) => u.code)
        .join(", ")}${unmatched.length > 5 ? "…" : ""}), somando ${sales.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em vendas.`,
    );
  }
  const advertisers = [...new Set(rows.map((r) => r.advertiser))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return { rows, advertisers, unmatched, warnings };
}

export interface AreaStat {
  id: string;
  name: string;
  region: RegionId;
  population: number;
  metrics: StateMetrics;
}

export interface StatesAnalysis {
  total: StateMetrics;
  /** As 27 UFs, com zero onde não houve venda. */
  states: AreaStat[];
  regions: AreaStat[];
}

export function analyzeStates(rows: StateRow[], advertiser: string | null): StatesAnalysis {
  const byUf = new Map(UFS.map((u) => [u.uf, emptyStateMetrics()]));
  for (const r of rows) if (advertiser === null || r.advertiser === advertiser) add(byUf.get(r.uf)!, r.metrics);

  const states: AreaStat[] = UFS.map((u) => ({ id: u.uf, name: u.name, region: u.region, population: u.population, metrics: byUf.get(u.uf)! }));
  const regions: AreaStat[] = REGIONS.map((reg) => {
    const members = states.filter((s) => s.region === reg.id);
    return {
      id: reg.id,
      name: reg.name,
      region: reg.id,
      population: members.reduce((s, m) => s + m.population, 0),
      metrics: members.reduce((m, s) => add(m, s.metrics), emptyStateMetrics()),
    };
  });
  const total = states.reduce((m, s) => add(m, s.metrics), emptyStateMetrics());
  return { total, states, regions };
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : NaN);
export const ticket = (m: StateMetrics) => ratio(m.sales, m.orders);
export const ntbSalesShare = (m: StateMetrics) => ratio(m.ntbSales, m.sales);
export const ntbOrdersShare = (m: StateMetrics) => ratio(m.ntbOrders, m.orders);
/** Vendas por mil habitantes. */
export const salesPerThousand = (a: AreaStat) => ratio(a.metrics.sales * 1000, a.population);
/** Índice de penetração: participação nas vendas / participação na população x 100 (100 = proporcional). */
export const penetrationIndex = (a: AreaStat, total: StateMetrics) =>
  ratio(ratio(a.metrics.sales, total.sales) * 100, a.population / BRAZIL_POPULATION);

/** Quantas áreas (da maior para a menor) somam a fração pedida das vendas. */
export function areasToReach(areas: AreaStat[], share: number): number {
  const total = areas.reduce((s, a) => s + a.metrics.sales, 0);
  if (total <= 0) return 0;
  let acc = 0;
  const sorted = [...areas].sort((a, b) => b.metrics.sales - a.metrics.sales);
  for (let i = 0; i < sorted.length; i++) {
    acc += sorted[i].metrics.sales;
    if (acc / total >= share - 1e-9) return i + 1;
  }
  return sorted.length;
}
