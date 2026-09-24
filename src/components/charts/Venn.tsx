import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { composeSvg, serializeSvg, type ChartExport } from "../../lib/chartExport";
import { ExportMenu } from "../ExportMenu";
import { formatCompact, truncate } from "../../lib/format";
import { layoutVenn, regionLabelPoints, regionMask } from "../../lib/venn";
import { useTooltip } from "../Tooltip";

interface Props {
  sets: string[];
  /** Slot de cor (1..3) de cada conjunto; fica fixo mesmo quando outro conjunto sai da seleção. */
  slots: number[];
  /** Usuários por região (bitmask dos conjuntos). */
  regions: Map<number, number>;
  tooltip: (mask: number) => ReactNode;
  /** Nome legível de cada região (para o Excel). */
  regionLabel: (mask: number) => string;
  /** Título do gráfico nos arquivos baixados. */
  exportAs: string;
}

const W = 560;
const H = 400;
const PAD = 46;

const setSize = (regions: Map<number, number>, bits: number) =>
  [...regions.entries()].reduce((s, [mask, v]) => ((mask & bits) === bits ? s + v : s), 0);

/** Venn proporcional à área para 2 ou 3 conjuntos; hover em qualquer ponto mostra a região exata. */
export function Venn({ sets, slots, regions, tooltip, regionLabel, exportAs }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { show, hide } = useTooltip();
  const [hover, setHover] = useState<number>(0);

  const geo = useMemo(() => {
    const sizes = sets.map((_, i) => setSize(regions, 1 << i));
    const raw = layoutVenn(sizes, (i, j) => setSize(regions, (1 << i) | (1 << j)));
    const minX = Math.min(...raw.map((c) => c.x - c.r));
    const maxX = Math.max(...raw.map((c) => c.x + c.r));
    const minY = Math.min(...raw.map((c) => c.y - c.r));
    const maxY = Math.max(...raw.map((c) => c.y + c.r));
    const k = Math.min((W - 2 * PAD) / (maxX - minX || 1), (H - 2 * PAD) / (maxY - minY || 1));
    const ox = (W - (maxX - minX) * k) / 2 - minX * k;
    const oy = (H - (maxY - minY) * k) / 2 - minY * k;
    const circles = raw.map((c) => ({ x: c.x * k + ox, y: c.y * k + oy, r: c.r * k }));
    // Rótulos das regiões, da maior para a menor, pulando os que não cabem ou colidem com um já posto.
    // O que ficar sem rótulo continua no hover e na tabela.
    const placed: { mask: number; x: number; y: number; w: number }[] = [];
    const candidates = [...regionLabelPoints(circles).entries()].sort((p, q) => (regions.get(q[0]) ?? 0) - (regions.get(p[0]) ?? 0));
    for (const [mask, pt] of candidates) {
      const users = regions.get(mask) ?? 0;
      const w = formatCompact(users).length * 8 + 6;
      const collides = placed.some((o) => Math.abs(o.x - pt.x) < (o.w + w) / 2 && Math.abs(o.y - pt.y) < 18);
      if (users > 0 && pt.clearance >= 13 && !collides) placed.push({ mask, x: pt.x, y: pt.y, w });
    }
    return { circles, labels: placed };
  }, [sets, regions]);

  const cx = geo.circles.reduce((s, c) => s + c.x, 0) / geo.circles.length;
  const cy = geo.circles.reduce((s, c) => s + c.y, 0) / geo.circles.length;

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const mask = regionMask(geo.circles, ((e.clientX - box.left) * W) / box.width, ((e.clientY - box.top) * H) / box.height);
    setHover(mask);
    if (mask === 0) hide();
    else show(e, tooltip(mask));
  };

  const exporter: ChartExport = {
    // Os nomes já estão ao lado dos círculos; sem legenda extra.
    svg: () => composeSvg(exportAs, serializeSvg(svgRef.current!)),
    table: () => {
      const total = [...regions.values()].reduce((a, b) => a + b, 0);
      return {
        header: ["Região", "Usuários", "% da união", ...sets],
        rows: [...regions.entries()]
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([mask, v]) => [regionLabel(mask), v, total ? v / total : null, ...sets.map((_, i) => (mask & (1 << i) ? 1 : 0))]),
      };
    },
  };

  return (
    <>
      <div className="chart-toolbar">
        <ExportMenu name={exportAs} exporter={exporter} />
      </div>
      <svg
        ref={svgRef}
        className="venn"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Diagrama de Venn: ${sets.join(", ")}`}
        onMouseMove={onMove}
        onMouseLeave={() => {
          setHover(0);
          hide();
        }}
      >
        {geo.circles.map((c, i) => (
          <circle
            key={sets[i]}
            cx={c.x}
            cy={c.y}
            r={Math.max(c.r, 1)}
            className={`venn-circle v${slots[i]} ${hover & (1 << i) ? "active" : ""}`}
          />
        ))}

        {geo.labels.map((l) => (
          <text key={l.mask} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="central" className="venn-value">
            {formatCompact(regions.get(l.mask) ?? 0)}
          </text>
        ))}

        {geo.circles.map((c, i) => {
          // Nome do lado de fora: com 2 círculos (lado a lado) fica acima de cada um; com 3, na direção
          // oposta ao centro do grupo.
          let dx = c.x - cx;
          let dy = c.y - cy;
          const len = Math.hypot(dx, dy);
          if (geo.circles.length === 2 || len < 1e-6) [dx, dy] = [0, -1];
          else [dx, dy] = [dx / len, dy / len];
          const x = Math.min(W - 8, Math.max(8, c.x + dx * (c.r + 14)));
          const y = Math.min(H - 8, Math.max(12, c.y + dy * (c.r + 14)));
          const anchor = Math.abs(dx) < 0.35 ? "middle" : dx > 0 ? "start" : "end";
          return (
            <text key={`l${i}`} x={x} y={y} textAnchor={anchor} dominantBaseline="central" className="venn-set-label">
              <tspan className={`venn-key v${slots[i]}`}>●</tspan> {truncate(sets[i], 26)}
            </text>
          );
        })}
      </svg>
    </>
  );
}
