import { COUNTRIES, countryPopulation, resolveState, type CountryDef } from "../../lib/geo";
import { columnIndex, parseNumber, type CsvTable } from "../../lib/csv";
import { ReportParseError } from "../types";

export interface StateMetrics {
  orders: number;
  ntbOrders: number;
  sales: number;
  ntbSales: number;
}

export interface StateRow {
  /** Chave do anunciante: o advertiser_id (ou o nome, se o CSV não trouxer o ID). */
  advertiser: string;
  /** País (ISO alfa-2) e código do estado sem o prefixo. */
  country: string;
  state: string;
  metrics: StateMetrics;
}

export interface ParsedStates {
  rows: StateRow[];
  advertisers: AdvertiserInfo[];
  /** Países com dados, na ordem de COUNTRIES. */
  countries: string[];
  /** Linhas com código de estado não suportado (outros países ou código desconhecido). */
  unmatched: { code: string; metrics: StateMetrics }[];
  warnings: string[];
}

export interface AdvertiserInfo {
  key: string;
  name: string;
  id: string;
  /** "Nome (ID)": o mesmo nome pode existir em mais de um advertiser_id. */
  label: string;
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
  const advertiserMap = new Map<string, AdvertiserInfo>();
  const unmatchedMap = new Map<string, StateMetrics>();
  for (const r of table.rows) {
    const code = text(r, "iso_state_province_code");
    const metrics: StateMetrics = {
      orders: num(r, "total_conversions"),
      ntbOrders: num(r, "ntb_conversions"),
      sales: num(r, "total_sales"),
      ntbSales: num(r, "ntb_sales"),
    };
    const resolved = resolveState(code);
    if (!resolved) {
      if (code) unmatchedMap.set(code, add(unmatchedMap.get(code) ?? emptyStateMetrics(), metrics));
      continue;
    }
    const name = text(r, "advertiser");
    const id = text(r, "advertiser_id");
    const key = id || name || "Anunciante";
    if (!advertiserMap.has(key)) advertiserMap.set(key, { key, name: name || id || "Anunciante", id, label: name && id ? `${name} (${id})` : name || id || "Anunciante" });
    rows.push({ advertiser: key, country: resolved.country.id, state: resolved.code, metrics });
  }
  if (rows.length === 0) {
    throw new ReportParseError(
      `Nenhuma linha com estado reconhecido. Países suportados: ${COUNTRIES.map((c) => c.name).join(", ")} (iso_state_province_code como BR-SP ou MX-CMX).`,
    );
  }

  const unmatched = [...unmatchedMap.entries()].map(([code, metrics]) => ({ code, metrics })).sort((a, b) => b.metrics.sales - a.metrics.sales);
  const warnings: string[] = [];
  if (unmatched.length > 0) {
    const sales = unmatched.reduce((s, u) => s + u.metrics.sales, 0);
    warnings.push(
      `${unmatched.length} código(s) de estado fora dos países suportados ficaram de fora (${unmatched
        .slice(0, 5)
        .map((u) => u.code)
        .join(", ")}${unmatched.length > 5 ? "…" : ""}), somando ${sales.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} em vendas.`,
    );
  }
  const advertisers = [...advertiserMap.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id));
  const present = new Set(rows.map((r) => r.country));
  const countries = COUNTRIES.filter((c) => present.has(c.id)).map((c) => c.id);
  return { rows, advertisers, countries, unmatched, warnings };
}

export interface AreaStat {
  id: string;
  name: string;
  region: string;
  population: number;
  /** Participação na população do país (0..1). */
  popShare: number;
  metrics: StateMetrics;
}

export interface StatesAnalysis {
  total: StateMetrics;
  /** Todos os estados do país, com zero onde não houve venda. */
  states: AreaStat[];
  regions: AreaStat[];
}

/** Agrega um país; `advertiser` é a chave (advertiser_id) ou null para todos. */
export function analyzeStates(rows: StateRow[], country: CountryDef, advertiser: string | null): StatesAnalysis {
  const byState = new Map(country.states.map((u) => [u.code, emptyStateMetrics()]));
  for (const r of rows) {
    if (r.country !== country.id || (advertiser !== null && r.advertiser !== advertiser)) continue;
    add(byState.get(r.state)!, r.metrics);
  }
  const pop = countryPopulation(country);
  const states: AreaStat[] = country.states.map((u) => ({
    id: u.code,
    name: u.name,
    region: u.region,
    population: u.population,
    popShare: u.population / pop,
    metrics: byState.get(u.code)!,
  }));
  const regions: AreaStat[] = country.regions.map((reg) => {
    const members = states.filter((s) => s.region === reg.id);
    const population = members.reduce((s, m) => s + m.population, 0);
    return {
      id: reg.id,
      name: reg.name,
      region: reg.id,
      population,
      popShare: population / pop,
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
export const penetrationIndex = (a: AreaStat, total: StateMetrics) => ratio(ratio(a.metrics.sales, total.sales) * 100, a.popShare);

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
