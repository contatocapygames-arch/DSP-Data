import type { ReactNode } from "react";
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
export function IndexBars({ items }: { items: IndexItem[] }) {
  const tip = useTipProps();
  return (
    <div className="index-bars">
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
