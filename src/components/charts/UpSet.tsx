import { useRef, type ReactNode } from "react";
import { composeSvg, serializeSvg, type ChartExport } from "../../lib/chartExport";
import { ExportMenu } from "../ExportMenu";
import { formatCompact, truncate } from "../../lib/format";
import { useTipProps } from "../Tooltip";

interface Props {
  /** Linhas do grid de pontos (conjuntos). */
  sets: string[];
  /** Colunas: cada combinação com os conjuntos que a compõem. */
  combos: { members: string[]; value: number }[];
  tooltip: (index: number) => ReactNode;
  /** Título do gráfico nos arquivos baixados. */
  exportAs: string;
  /** Nome da métrica das barras no Excel. */
  valueName?: string;
}

const COL = 38;
const ROW = 26;
const LABEL_W = 180;
const BAR_H = 180;
const BAR_W = 20;
const TOP = 22;

/**
 * Gráfico UpSet: barras = usuários de cada combinação exata; pontos abaixo = quais anunciantes compõem a combinação.
 * Lê melhor que diagrama de Venn com mais de 3 conjuntos.
 */
export function UpSet({ sets, combos, tooltip, exportAs, valueName = "Usuários" }: Props) {
  const tip = useTipProps();
  const svgRef = useRef<SVGSVGElement>(null);
  const max = Math.max(1, ...combos.map((c) => c.value));
  const width = LABEL_W + combos.length * COL + 8;
  const gridTop = TOP + BAR_H + 14;
  const height = gridTop + sets.length * ROW + 6;
  const setIndex = new Map(sets.map((s, i) => [s, i]));
  const ticks = [0, 0.5, 1].map((f) => f * max);

  const exporter: ChartExport = {
    svg: () => composeSvg(exportAs, serializeSvg(svgRef.current!)),
    table: () => ({
      header: ["Combinação", valueName, ...sets],
      rows: combos.map((c) => [c.members.join(" + "), c.value, ...sets.map((s) => (c.members.includes(s) ? 1 : 0))]),
    }),
  };

  return (
    <>
      <div className="chart-toolbar">
        <ExportMenu name={exportAs} exporter={exporter} />
      </div>
      <div className="chart-scroll">
        <svg
          ref={svgRef}
          className="upset"
          width={width}
          height={height}
          role="img"
          aria-label="Combinações de anunciantes por usuários únicos"
        >
          {ticks.map((t) => {
            const y = TOP + BAR_H - (t / max) * BAR_H;
            return (
              <g key={t}>
                <line x1={LABEL_W - 4} x2={width - 4} y1={y} y2={y} className={t === 0 ? "baseline" : "gridline"} />
                <text x={LABEL_W - 10} y={y} textAnchor="end" dominantBaseline="central" className="tick">
                  {formatCompact(t)}
                </text>
              </g>
            );
          })}

          {sets.map((s, i) => (
            <g key={s}>
              {i % 2 === 0 && <rect x={LABEL_W - 4} y={gridTop + i * ROW} width={combos.length * COL + 8} height={ROW} className="zebra" />}
              <text x={LABEL_W - 10} y={gridTop + i * ROW + ROW / 2} textAnchor="end" dominantBaseline="central" className="axis-label">
                <title>{s}</title>
                {truncate(s, 24)}
              </text>
            </g>
          ))}

          {combos.map((c, k) => {
            const cx = LABEL_W + k * COL + COL / 2;
            const h = Math.max(2, (c.value / max) * BAR_H);
            const rows = c.members.map((m) => setIndex.get(m)).filter((v): v is number => v !== undefined);
            const minR = Math.min(...rows);
            const maxR = Math.max(...rows);
            const r = Math.min(4, BAR_W / 2);
            const x = cx - BAR_W / 2;
            const y = TOP + BAR_H - h;
            return (
              <g key={k} className="upset-col" {...tip(tooltip(k))}>
                <rect x={LABEL_W + k * COL} y={0} width={COL} height={height} className="hit" />
                <path
                  className="bar s1"
                  d={`M${x},${TOP + BAR_H} V${y + r} Q${x},${y} ${x + r},${y} H${x + BAR_W - r} Q${x + BAR_W},${y} ${x + BAR_W},${y + r} V${TOP + BAR_H} Z`}
                />
                {k < 3 && (
                  <text x={cx} y={y - 6} textAnchor="middle" className="tick strong">
                    {formatCompact(c.value)}
                  </text>
                )}
                {sets.map((_, i) => (
                  <circle key={i} cx={cx} cy={gridTop + i * ROW + ROW / 2} r={5} className="dot-off" />
                ))}
                {rows.length > 1 && (
                  <line x1={cx} x2={cx} y1={gridTop + minR * ROW + ROW / 2} y2={gridTop + maxR * ROW + ROW / 2} className="dot-link" />
                )}
                {rows.map((i) => (
                  <circle key={`on${i}`} cx={cx} cy={gridTop + i * ROW + ROW / 2} r={5} className="dot-on" />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </>
  );
}
