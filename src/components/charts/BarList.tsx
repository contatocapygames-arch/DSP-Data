import type { ReactNode } from "react";
import { barsSvg, composeSvg, token, type ChartExport } from "../../lib/chartExport";
import { ExportMenu } from "../ExportMenu";
import { useTipProps } from "../Tooltip";

export interface BarSegment {
  key: string;
  value: number;
  /** Índice do slot categórico (1..8). */
  series: number;
  /** Rótulo do valor quando as barras são agrupadas. */
  valueLabel?: string;
}

export interface BarItem {
  label: string;
  segments: BarSegment[];
  valueLabel?: string;
  tooltip: ReactNode;
}

/**
 * Barras horizontais em HTML (responsivas): simples, empilhadas ou agrupadas (uma barra por série na mesma linha).
 * A escala vai de 0 ao maior total (ou maior barra, se agrupadas).
 */
export function BarList({
  items,
  legend,
  layout = "stacked",
  exportAs,
  valueName = "Valor",
}: {
  items: BarItem[];
  legend?: { label: string; series: number }[];
  layout?: "stacked" | "grouped";
  /** Título do gráfico nos arquivos baixados (PNG, SVG, Excel). Obrigatório: todo gráfico é baixável. */
  exportAs: string;
  /** Nome da coluna de valor no Excel quando há uma única série. */
  valueName?: string;
}) {
  const tip = useTipProps();
  const finite = (v: number) => (Number.isFinite(v) ? v : 0);
  const max =
    Math.max(
      0,
      ...items.map((i) =>
        layout === "grouped" ? Math.max(0, ...i.segments.map((s) => finite(s.value))) : i.segments.reduce((s, x) => s + finite(x.value), 0),
      ),
    ) || 1;

  const legendItems = legend && legend.length > 1 ? legend : [];
  const seriesName = (series: number) => legend?.find((l) => l.series === series)?.label;
  const exporter: ChartExport = {
    svg: () => {
      const color = (n: number) => token(`--series-${n}`);
      const body = barsSvg(
        items.map((i) => ({
          label: i.label,
          valueLabel: i.valueLabel,
          values: i.segments.map((sg) => ({ value: sg.value, color: color(sg.series), valueLabel: sg.valueLabel })),
        })),
        layout,
      );
      return composeSvg(
        exportAs,
        body,
        legendItems.map((l) => ({ label: l.label, color: color(l.series) })),
      );
    },
    table: () => {
      const keys = [...new Map(items.flatMap((i) => i.segments.map((sg) => [sg.key, sg.series] as const))).entries()];
      const header = ["Item", ...keys.map(([k, series]) => (keys.length === 1 ? valueName : (seriesName(series) ?? k))), "Rótulo exibido"];
      return {
        header,
        rows: items.map((i) => [
          i.label,
          ...keys.map(([k]) => i.segments.find((sg) => sg.key === k)?.value ?? null),
          i.valueLabel ??
            i.segments
              .map((sg) => sg.valueLabel)
              .filter(Boolean)
              .join(" / "),
        ]),
      };
    },
  };

  return (
    <div className="bar-list">
      <div className="chart-toolbar">
        {legendItems.length > 0 && (
          <div className="legend">
            {legendItems.map((l) => (
              <span key={l.label} className="legend-item">
                <span className={`swatch s${l.series}`} />
                {l.label}
              </span>
            ))}
          </div>
        )}
        <ExportMenu name={exportAs} exporter={exporter} />
      </div>
      {items.map((item) => {
        if (layout === "grouped") {
          return (
            <div className="bar-row" key={item.label} {...tip(item.tooltip)}>
              <span className="bar-label" title={item.label}>
                {item.label}
              </span>
              <div className="bar-group">
                {item.segments.map((s) => (
                  <div className="bar-track" key={s.key}>
                    <div className="bar-stack thin" style={{ width: `${(finite(s.value) / max) * 100}%` }}>
                      <div className={`bar-seg s${s.series}`} style={{ flexGrow: 1 }} />
                    </div>
                    <span className="bar-value">{s.valueLabel}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        const total = item.segments.reduce((s, x) => s + finite(x.value), 0);
        return (
          <div className="bar-row" key={item.label} {...tip(item.tooltip)}>
            <span className="bar-label" title={item.label}>
              {item.label}
            </span>
            <div className="bar-track">
              <div className="bar-stack" style={{ width: `${(total / max) * 100}%` }}>
                {item.segments
                  .filter((s) => finite(s.value) > 0)
                  .map((s) => (
                    <div key={s.key} className={`bar-seg s${s.series}`} style={{ flexGrow: s.value }} />
                  ))}
              </div>
              <span className="bar-value">{item.valueLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
