import type { ReactNode } from "react";
import { truncate } from "../../lib/format";
import { useTipProps } from "../Tooltip";

interface Props {
  /** Rótulos das linhas (e das colunas, se `colLabels` não for passado). */
  labels: string[];
  /** Colunas diferentes das linhas (matriz retangular, sem diagonal). */
  colLabels?: string[];
  /** Valor exibido em cada célula (ex.: % ou contagem). */
  value: (i: number, j: number) => number;
  /** Intensidade 0..1 da célula. */
  intensity: (i: number, j: number) => number;
  format: (v: number) => string;
  tooltip: (i: number, j: number) => ReactNode;
  diagonal?: (i: number) => string;
}

const CELL = 66;
const LABEL_W = 170;
const HEADER_H = 120;

/** Matriz de sobreposição com escala sequencial de um só tom (opacidade do azul sobre a superfície). */
export function Heatmap({ labels, colLabels, value, intensity, format, tooltip, diagonal }: Props) {
  const tip = useTipProps();
  const cols = colLabels ?? labels;
  const square = !colLabels;
  // Folga à direita para os rótulos de coluna inclinados.
  const width = LABEL_W + cols.length * CELL + 110;
  const height = HEADER_H + labels.length * CELL + 4;

  return (
    <div className="chart-scroll">
      <svg className="heatmap" width={width} height={height} role="img" aria-label="Matriz de sobreposição entre anunciantes">
        {cols.map((l, j) => (
          <text
            key={`c${j}`}
            className="axis-label"
            transform={`translate(${LABEL_W + j * CELL + CELL / 2 + 4}, ${HEADER_H - 8}) rotate(-45)`}
          >
            <title>{l}</title>
            {truncate(l, 20)}
          </text>
        ))}
        {labels.map((l, i) => (
          <g key={`r${i}`} transform={`translate(0, ${HEADER_H + i * CELL})`}>
            <text className="axis-label" x={LABEL_W - 10} y={CELL / 2} textAnchor="end" dominantBaseline="central">
              <title>{l}</title>
              {truncate(l, 22)}
            </text>
            {cols.map((_, j) => {
              const isDiag = square && i === j;
              const t = isDiag ? 0 : Math.max(0, Math.min(1, intensity(i, j)));
              const x = LABEL_W + j * CELL;
              return (
                <g key={j} {...tip(tooltip(i, j))}>
                  <rect
                    x={x + 1}
                    y={1}
                    width={CELL - 2}
                    height={CELL - 2}
                    rx={4}
                    className={isDiag ? "cell-diag" : "cell"}
                    style={isDiag ? undefined : { fillOpacity: 0.06 + 0.94 * t }}
                  />
                  <text
                    x={x + CELL / 2}
                    y={CELL / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={`cell-text ${!isDiag && t > 0.5 ? "on-strong" : ""}`}
                  >
                    {isDiag ? (diagonal?.(i) ?? "") : format(value(i, j))}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}
