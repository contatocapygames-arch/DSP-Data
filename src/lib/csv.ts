export interface CsvTable {
  headers: string[];
  rows: string[][];
}

/** Detecta o separador olhando a primeira linha (fora de aspas). Excel pt-BR costuma salvar com ";". */
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : ",";
}

/** Parser RFC 4180: aspas duplas, aspas escapadas ("") e quebras de linha dentro de campos. */
export function parseCsv(input: string): CsvTable {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  const [headers = [], ...rows] = nonEmpty;
  return { headers: headers.map((h) => h.trim()), rows };
}

export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/^"|"$/g, "").replace(/\s+/g, "_");
}

/** Índice de uma coluna pelo nome, ignorando caixa e espaços; -1 se não existir. */
export function columnIndex(table: CsvTable, name: string): number {
  const target = normalizeHeader(name);
  return table.headers.findIndex((h) => normalizeHeader(h) === target);
}

/**
 * O AMC exporta colunas ARRAY como texto. Aceita JSON (["A","B"]), colchetes sem aspas ([A, B])
 * ou lista simples separada por vírgula.
 */
export function parseArrayCell(cell: string): string[] {
  const raw = cell.trim();
  if (raw === "" || raw === "[]") return [];
  if (raw.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      // cai no split abaixo
    }
  }
  return raw
    .replace(/^\[|\]$/g, "")
    .split(/\s*,\s*/)
    .map((v) => v.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** Inteiro tolerante a separador de milhar ("12,345" / "12.345"). NaN se não houver dígitos. */
export function parseCount(cell: string): number {
  const digits = cell.replace(/[^\d-]/g, "");
  return digits === "" || digits === "-" ? NaN : Number(digits);
}

/**
 * Número decimal tolerante a formato: "1234.56" (AMC), "1.234,56" / "887,67" (Excel pt-BR) e "1,234.56".
 * Vazio vira NaN.
 */
export function parseNumber(cell: string): number {
  let s = cell.trim().replace(/\s/g, "");
  if (s === "") return NaN;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // O separador que aparece por último é o decimal.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
