import type { ReportDefinition } from "../types";
import { PathToConversionDashboard } from "./Dashboard";
import { OPTIONAL_COLUMNS, parsePathTable, REQUIRED_COLUMNS } from "./parse";

export const pathToConversionReport: ReportDefinition = {
  id: "path-to-conversion",
  title: "Path to Conversion",
  summary: "Caminhos de conversão por grupo de campanha: segmentos por filtro de texto (ex.: com/sem DSP), pontos de contato, sequências e aquisição de NTB.",
  description:
    "Cada linha do resultado é um caminho (sequência de grupos de campanha) com usuários, compras, vendas e NTB. Monte um filtro de texto para separar um grupo de pontos de contato (ex.: DSP) e compare full funnel, só o grupo, sem o grupo e as demais permutações.",
  sources: ["Template AMC", "Path to Conversion by Campaign Groups"],
  instructions:
    'Na biblioteca de instruções do AMC, abra o template "Path to Conversion by Campaign Groups" (ou "by Ad Group"), preencha os grupos de campanha como quiser (os nomes aparecem na coluna path), rode no período desejado e exporte o resultado em CSV.',
  expectedColumns: [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS],
  process: (table) => {
    const data = parsePathTable(table);
    return { warnings: data.warnings, render: () => <PathToConversionDashboard data={data} /> };
  },
};
