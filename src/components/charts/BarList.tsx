import type { ReactNode } from "react";
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
}: {
  items: BarItem[];
  legend?: { label: string; series: number }[];
  layout?: "stacked" | "grouped";
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

  return (
    <div className="bar-list">
      {legend && legend.length > 1 && (
        <div className="legend">
          {legend.map((l) => (
            <span key={l.label} className="legend-item">
              <span className={`swatch s${l.series}`} />
              {l.label}
            </span>
          ))}
        </div>
      )}
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
