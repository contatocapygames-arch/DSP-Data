import { advertiserOverlapReport } from "./advertiserOverlap";
import type { ReportDefinition } from "./types";

/** Para adicionar um report: crie a pasta em src/reports/<nome> e registre aqui. */
export const REPORTS: ReportDefinition[] = [advertiserOverlapReport];

export const findReport = (id: string) => REPORTS.find((r) => r.id === id);
