import { useRef, useState } from "react";
import { downloadPng, downloadSvg, downloadXlsx, withLightTheme, type ChartExport } from "../lib/chartExport";

/** Menu "Baixar" padrão de todo gráfico: PNG, SVG e Excel. */
export function ExportMenu({ name, exporter }: { name: string; exporter: ChartExport }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: "png" | "svg" | "xlsx") => {
    ref.current?.removeAttribute("open");
    setError(null);
    try {
      if (kind === "xlsx") return downloadXlsx(name, exporter.table());
      const img = withLightTheme(exporter.svg);
      if (kind === "svg") downloadSvg(name, img);
      else await downloadPng(name, img);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="export-menu">
      <details ref={ref}>
        <summary className="btn ghost small" aria-label={`Baixar gráfico: ${name}`}>
          Baixar
        </summary>
        <div className="export-options" role="menu">
          <button type="button" role="menuitem" onClick={() => run("png")}>
            Imagem PNG
          </button>
          <button type="button" role="menuitem" onClick={() => run("svg")}>
            Vetor SVG
          </button>
          <button type="button" role="menuitem" onClick={() => run("xlsx")}>
            Excel (.xlsx)
          </button>
        </div>
      </details>
      {error && <span className="error small">{error}</span>}
    </div>
  );
}
