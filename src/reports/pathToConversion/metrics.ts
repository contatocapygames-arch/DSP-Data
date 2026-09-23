import { formatInt, formatMoneyFull, formatMultiple, formatPct, formatShare } from "../../lib/format";
import {
  costPerNtb,
  cpa,
  ntbBuyerShare,
  ntbRate,
  ntbSalesShare,
  ntbShare,
  purchaseRate,
  roas,
  type Metrics,
} from "./parse";

/** Coluna de métrica: valor bruto (para ordenar/exportar) e formatação. `total` permite colunas de participação. */
export interface MetricColumn {
  key: string;
  label: string;
  value: (m: Metrics, total: Metrics) => number;
  format: (v: number) => string;
}

const share = (a: number, b: number) => (b > 0 ? a / b : NaN);
const pct = formatShare;
const rate = (v: number) => formatPct(v, 2);

export const PATH_COLUMNS: MetricColumn[] = [
  { key: "paths", label: "Caminhos", value: (m) => m.paths, format: formatInt },
  { key: "users", label: "Usuários", value: (m) => m.users, format: formatInt },
  { key: "usersShare", label: "% usuários", value: (m, t) => share(m.users, t.users), format: pct },
  { key: "buyers", label: "Compradores", value: (m) => m.buyers, format: formatInt },
  { key: "buyersShare", label: "% compradores", value: (m, t) => share(m.buyers, t.buyers), format: pct },
  { key: "rate", label: "Taxa de compra", value: purchaseRate, format: rate },
  { key: "purchases", label: "Compras", value: (m) => m.purchases, format: formatInt },
  { key: "sales", label: "Vendas", value: (m) => m.sales, format: formatMoneyFull },
  { key: "salesShare", label: "% vendas", value: (m, t) => share(m.sales, t.sales), format: pct },
  { key: "cost", label: "Custo", value: (m) => m.cost, format: formatMoneyFull },
  { key: "roas", label: "ROAS", value: roas, format: (v) => formatMultiple(v) },
  { key: "cpa", label: "CPA", value: cpa, format: formatMoneyFull },
];

export const NTB_COLUMNS: MetricColumn[] = [
  { key: "users", label: "Usuários", value: (m) => m.users, format: formatInt },
  { key: "ntbBuyers", label: "Compradores NTB", value: (m) => m.ntbBuyers, format: formatInt },
  { key: "ntbBuyersOfAll", label: "% dos compradores NTB", value: (m, t) => share(m.ntbBuyers, t.ntbBuyers), format: pct },
  { key: "ntbBuyerShare", label: "% NTB nos compradores", value: ntbBuyerShare, format: pct },
  { key: "ntbPurchases", label: "Compras NTB", value: (m) => m.ntbPurchases, format: formatInt },
  { key: "ntbShare", label: "% NTB nas compras", value: ntbShare, format: pct },
  { key: "ntbSales", label: "Vendas NTB", value: (m) => m.ntbSales, format: formatMoneyFull },
  { key: "ntbSalesShare", label: "% NTB nas vendas", value: ntbSalesShare, format: pct },
  { key: "ntbRate", label: "Taxa de aquisição NTB", value: ntbRate, format: rate },
  { key: "costPerNtb", label: "Custo por comprador NTB", value: costPerNtb, format: formatMoneyFull },
];

/** Colunas da planilha exportada: métricas de caminho + NTB, sem repetir usuários. */
export const EXPORT_COLUMNS: MetricColumn[] = [...PATH_COLUMNS, ...NTB_COLUMNS.filter((c) => c.key !== "users")];
