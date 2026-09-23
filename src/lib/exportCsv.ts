/** Gera e baixa um CSV pronto para o Excel em pt-BR: separador ";", decimal com vírgula e BOM UTF-8. */
export function downloadCsv(fileName: string, header: string[], rows: (string | number)[][]): void {
  const cell = (v: string | number) => {
    const s =
      typeof v === "number"
        ? Number.isFinite(v)
          ? v.toLocaleString("pt-BR", { useGrouping: false, maximumFractionDigits: 6 })
          : ""
        : v;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
