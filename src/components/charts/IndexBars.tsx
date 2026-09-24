import type { ReactNode } from "react";
import { composeSvg, escapeXml, type ChartExport } from "../../lib/chartExport";
import { ExportMenu } from "../ExportMenu";
import { useTipProps } from "../Tooltip";

export interface IndexItem {
  label: string;
  /** Índice com base 100 (100 = proporcional). */
  value: number;
  tooltip: ReactNode;
}

const LIMIT = 2; // escala log2: ±2 = de 25 a 400

/**
 * Barras divergentes em torno de 100, em escala logarítmica (200 e 50 ficam à mesma distância do centro).
 * Acima de 100 no tom frio, abaixo no tom quente.
 */
export function IndexBars({ items, exportAs }: { items: IndexItem[]; exportAs: string }) {
  const tip = useTipProps();
  const exporter: ChartExport = {
    svg: () => composeSvg(exportAs, indexSvg(items), [], "100 = proporcional · escala logarítmica"),
    table: () => ({ header: ["Item", "Índice"], rows: items.map((i) => [i.label, i.value]) }),
  };
  return (
    <div className="index-bars">
      <div className="chart-toolbar">
        <ExportMenu name={exportAs} exporter={exporter} />
      </div>
      <div className="index-axis" aria-hidden>
        <span>25</span>
        <span>50</span>
        <span className="mid">100</span>
        <span>200</span>
        <span>400+</span>
      </div>
      {items.map((it) => {
        const pos = Math.max(-LIMIT, Math.min(LIMIT, Math.log2(Math.max(it.value, 1e-9) / 100))) / LIMIT;
        const up = pos >= 0;
        return (
          <div className="index-row" key={it.label} {...tip(it.tooltip)}>
            <span className="bar-label" title={it.label}>
              {it.label}
            </span>
            <div className="index-track">
              <div className="index-center" />
              <div
                className={`index-bar ${up ? "up" : "down"}`}
                style={up ? { left: "50%", width: `${pos * 50}%` } : { right: "50%", width: `${-pos * 50}%` }}
              />
            </div>
            <span className="bar-value">{Math.round(it.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Versão SVG para download (mesmas regras: log2, ±2 = 25 a 400, azul acima e vermelho abaixo de 100). */
function indexSvg(items: IndexItem[]) {
  const css = getComputedStyle(document.querySelector(".index-bars") ?? document.documentElement);
  const up = css.getPropertyValue("--up").trim() || "#2a78d6";
  const down = css.getPropertyValue("--down").trim() || "#e34948";
  const root = getComputedStyle(document.documentElement);
  const ink = root.getPropertyValue("--text-primary").trim();
  const muted = root.getPropertyValue("--text-secondary").trim();
  const axis = root.getPropertyValue("--baseline").trim();
  const labelW = Math.min(240, Math.max(80, ...items.map((i) => i.label.length * 6.7)) + 12);
  const trackW = 420;
  const rowH = 24;
  const top = 22;
  const cx = labelW + trackW / 2;
  const ticks = [25, 50, 100, 200, 400]
    .map((t) => {
      const x = cx + (Math.log2(t / 100) / LIMIT) * (trackW / 2);
      return `<text x="${x}" y="12" text-anchor="middle" font-size="11" fill="${muted}"${t === 100 ? ' font-weight="700"' : ""}>${t === 400 ? "400+" : t}</text>`;
    })
    .join("");
  const rows = items
    .map((it, i) => {
      const y = top + i * rowH;
      const pos = Math.max(-LIMIT, Math.min(LIMIT, Math.log2(Math.max(it.value, 1e-9) / 100))) / LIMIT;
      const w = Math.max(2, Math.abs(pos) * (trackW / 2));
      const x = pos >= 0 ? cx : cx - w;
      return (
        `<text x="${labelW - 12}" y="${y + rowH / 2}" text-anchor="end" dominant-baseline="central" font-size="12" fill="${muted}">${escapeXml(it.label)}</text>` +
        `<rect x="${x}" y="${y + 5}" width="${w}" height="14" rx="3" fill="${pos >= 0 ? up : down}"/>` +
        `<text x="${labelW + trackW + 10}" y="${y + rowH / 2}" dominant-baseline="central" font-size="12" fill="${ink}">${Math.round(it.value)}</text>`
      );
    })
    .join("");
  const height = top + items.length * rowH;
  return {
    markup: `${ticks}<line x1="${cx}" x2="${cx}" y1="${top - 4}" y2="${height}" stroke="${axis}"/>${rows}`,
    width: labelW + trackW + 50,
    height,
  };
}
