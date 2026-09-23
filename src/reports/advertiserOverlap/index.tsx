import type { ReportDefinition } from "../types";
import { parseOverlapTable, OPTIONAL_COLUMNS, REQUIRED_COLUMNS } from "./analyze";
import { AdvertiserOverlapDashboard } from "./Dashboard";
import { ADVERTISER_OVERLAP_QUERY } from "./query";

export const advertiserOverlapReport: ReportDefinition = {
  id: "advertiser-overlap",
  title: "Overlap entre anunciantes",
  summary: "Quantos usuários foram impactados por mais de um anunciante e quais combinações de anunciantes e campanhas se sobrepõem.",
  description:
    "Agrupa cada usuário exposto em DSP pela combinação exata de anunciantes e campanhas que ele viu. Com isso dá para medir alcance exclusivo, sobreposição entre pares de anunciantes e as combinações mais comuns.",
  sources: ["dsp_impressions"],
  query: ADVERTISER_OVERLAP_QUERY,
  expectedColumns: [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS],
  process: (table) => {
    const { rows, warnings } = parseOverlapTable(table);
    return { warnings, render: () => <AdvertiserOverlapDashboard rows={rows} /> };
  },
};
