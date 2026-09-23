import { columnIndex, parseNumber, type CsvTable } from "../../lib/csv";
import { ReportParseError } from "../types";

/** Métricas somáveis de um caminho (ou de um grupo de caminhos). */
export interface Metrics {
  paths: number;
  /** path_occurrences: usuários que fizeram exatamente este caminho. */
  users: number;
  impressions: number;
  cost: number;
  buyers: number;
  purchases: number;
  sales: number;
  ntbBuyers: number;
  ntbPurchases: number;
  ntbSales: number;
}

export interface PathRow {
  /** Pontos de contato na ordem do caminho. */
  steps: string[];
  metrics: Metrics;
}

export interface ParsedPaths {
  rows: PathRow[];
  templateName?: string;
  startDate?: string;
  endDate?: string;
  hasNtb: boolean;
  warnings: string[];
}

export const REQUIRED_COLUMNS = ["path", "path_occurrences", "users_that_purchased"];
export const OPTIONAL_COLUMNS = [
  "impressions",
  "total_cost",
  "purchases",
  "sales_amount",
  "ntb_users_that_purchased",
  "ntb_purchases",
  "ntb_sales_amount",
];

const METRIC_COLUMNS: [keyof Metrics, string][] = [
  ["users", "path_occurrences"],
  ["impressions", "impressions"],
  ["cost", "total_cost"],
  ["buyers", "users_that_purchased"],
  ["purchases", "purchases"],
  ["sales", "sales_amount"],
  ["ntbBuyers", "ntb_users_that_purchased"],
  ["ntbPurchases", "ntb_purchases"],
  ["ntbSales", "ntb_sales_amount"],
];

export const emptyMetrics = (): Metrics => ({
  paths: 0,
  users: 0,
  impressions: 0,
  cost: 0,
  buyers: 0,
  purchases: 0,
  sales: 0,
  ntbBuyers: 0,
  ntbPurchases: 0,
  ntbSales: 0,
});

export function addMetrics(into: Metrics, m: Metrics): Metrics {
  for (const k of Object.keys(into) as (keyof Metrics)[]) into[k] += m[k];
  return into;
}

/**
 * Lê a coluna path do AMC: "[[1, SP], [2, DSP NTB]]". Os nomes vêm sem aspas e são livres
 * (grupos de campanha definidos por quem montou a query), então tudo entre a vírgula e o "]" é o nome.
 */
export function parsePath(cell: string): string[] {
  const steps: [number, string][] = [];
  const re = /\[\s*(\d+)\s*,\s*([^[\]]*?)\s*\]/g;
  for (let m = re.exec(cell); m; m = re.exec(cell)) {
    const label = m[2].replace(/^["']|["']$/g, "").trim();
    if (label) steps.push([Number(m[1]), label]);
  }
  if (steps.length > 0) return steps.sort((a, b) => a[0] - b[0]).map((s) => s[1]);
  // Formato alternativo: lista simples "A > B > C" ou "A, B, C".
  return cell
    .replace(/^\[|\]$/g, "")
    .split(/\s*(?:>|,|\|)\s*/)
    .map((s) => s.replace(/^["']|["']$/g, "").trim())
    .filter(Boolean);
}

export function parsePathTable(table: CsvTable): ParsedPaths {
  const idx = (c: string) => columnIndex(table, c);
  const missing = REQUIRED_COLUMNS.filter((c) => idx(c) < 0);
  if (missing.length > 0) {
    throw new ReportParseError(
      `O CSV não tem a(s) coluna(s) ${missing.join(", ")}. Colunas encontradas: ${table.headers.join(", ") || "nenhuma"}.`,
    );
  }

  const cols = METRIC_COLUMNS.map(([key, col]) => [key, idx(col)] as const);
  const pathIdx = idx("path");
  const rows: PathRow[] = [];
  let skipped = 0;

  for (const r of table.rows) {
    const steps = parsePath(r[pathIdx] ?? "");
    const metrics = emptyMetrics();
    metrics.paths = 1;
    for (const [key, i] of cols) {
      const v = i >= 0 ? parseNumber(r[i] ?? "") : NaN;
      metrics[key] = Number.isFinite(v) ? v : 0;
    }
    if (steps.length === 0 || metrics.users <= 0) {
      skipped++;
      continue;
    }
    rows.push({ steps, metrics });
  }
  if (rows.length === 0) throw new ReportParseError("Nenhum caminho válido encontrado no CSV.");

  const first = table.rows[0] ?? [];
  const opt = (c: string) => (idx(c) >= 0 ? first[idx(c)]?.trim() || undefined : undefined);
  const warnings: string[] = [];
  if (skipped > 0) warnings.push(`${skipped} linha(s) ignorada(s) sem caminho ou sem path_occurrences.`);
  const missingOptional = OPTIONAL_COLUMNS.filter((c) => idx(c) < 0);
  if (missingOptional.length > 0) warnings.push(`Colunas ausentes (tratadas como zero): ${missingOptional.join(", ")}.`);

  return {
    rows,
    templateName: opt("amc_template_name"),
    startDate: opt("start_date"),
    endDate: opt("end_date"),
    hasNtb: idx("ntb_users_that_purchased") >= 0 || idx("ntb_purchases") >= 0,
    warnings,
  };
}

// Métricas derivadas. Divisão por zero vira NaN, exibido como "-".
const ratio = (a: number, b: number) => (b > 0 ? a / b : NaN);
export const purchaseRate = (m: Metrics) => ratio(m.buyers, m.users);
export const roas = (m: Metrics) => ratio(m.sales, m.cost);
export const cpa = (m: Metrics) => ratio(m.cost, m.purchases);
export const ntbShare = (m: Metrics) => ratio(m.ntbPurchases, m.purchases);
export const ntbBuyerShare = (m: Metrics) => ratio(m.ntbBuyers, m.buyers);
export const ntbSalesShare = (m: Metrics) => ratio(m.ntbSales, m.sales);
/** Taxa de aquisição NTB: compradores novos para a marca por usuário exposto. */
export const ntbRate = (m: Metrics) => ratio(m.ntbBuyers, m.users);
export const costPerNtb = (m: Metrics) => ratio(m.cost, m.ntbBuyers);
