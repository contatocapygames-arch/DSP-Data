import type { ReactElement } from "react";
import type { CsvTable } from "../lib/csv";

/** Resultado de processar um CSV: avisos de leitura + o dashboard já ligado aos dados. */
export interface ProcessedReport {
  warnings: string[];
  render: () => ReactElement;
}

export interface ReportDefinition {
  id: string;
  title: string;
  /** Uma linha para o card da home. */
  summary: string;
  /** Texto explicativo na página do report. */
  description: string;
  /** Tabelas do AMC que a query usa. */
  sources: string[];
  query: string;
  expectedColumns: string[];
  /** Lê a tabela do CSV. Lança ReportParseError quando o arquivo não é deste report. */
  process: (table: CsvTable) => ProcessedReport;
}

export class ReportParseError extends Error {}
