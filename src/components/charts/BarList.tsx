import type { ReactNode } from "react";
import { useTipProps } from "../Tooltip";

export interface BarSegment {
  key: string;
  value: number;
  /** Índice do slot categórico (1..8). */
  series: number;
}

export interface BarItem {
  label: string;
  segments: BarSegment[];
  valueLabel: string;
  tooltip: ReactNode;
}

/**
 * Barras horizontais em HTML (responsivas), simples ou empilhadas.
 * A escala vai de 0 ao maior total.
 */
export function BarList({ items, legend }: { items: BarItem[]; legend?: { label: string; series: number }[] }) {
  const tip = useTipProps();
  const max = Math.max(1, ...items.map((i) => i.segments.reduce((s, x) => s + x.value, 0)));

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
        const total = item.segments.reduce((s, x) => s + x.value, 0);
        return (
          <div className="bar-row" key={item.label} {...tip(item.tooltip)}>
            <span className="bar-label" title={item.label}>
              {item.label}
            </span>
            <div className="bar-track">
              <div className="bar-stack" style={{ width: `${(total / max) * 100}%` }}>
                {item.segments
                  .filter((s) => s.value > 0)
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
