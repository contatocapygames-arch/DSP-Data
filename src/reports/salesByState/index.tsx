import type { ReportDefinition } from "../types";
import { OPTIONAL_COLUMNS, parseStatesTable, REQUIRED_COLUMNS } from "./analyze";
import { SalesByStateDashboard } from "./Dashboard";
import { SALES_BY_STATE_QUERY } from "./query";

export const salesByStateReport: ReportDefinition = {
  id: "sales-by-state",
  title: "Vendas por estado",
  summary: "Mapa do Brasil com vendas, pedidos e NTB por estado e por região, concentração, ticket médio e índice vs população.",
  description:
    "Vendas e pedidos atribuídos por estado do cliente, com a parte de clientes novos para a marca (NTB). O mapa alterna entre estados e as cinco regiões, em R$, pedidos ou % do total.",
  sources: ["amazon_attributed_events_by_conversion_time"],
  query: SALES_BY_STATE_QUERY,
  expectedColumns: [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS],
  process: (table) => {
    const data = parseStatesTable(table);
    return { warnings: data.warnings, render: () => <SalesByStateDashboard data={data} /> };
  },
};
