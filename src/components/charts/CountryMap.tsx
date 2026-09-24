import { useRef, type ReactNode } from "react";
import { composeSvg, mixColor, serializeSvg, token, type ChartExport } from "../../lib/chartExport";
import type { CountryDef } from "../../lib/geo";
import { ExportMenu } from "../ExportMenu";
import { useTipProps } from "../Tooltip";

interface Props {
  country: CountryDef;
  mode: "state" | "region";
  /** Valor de cada UF (modo estado) ou região (modo região); NaN = sem dado. */
  value: (id: string) => number;
  format: (v: number) => string;
  tooltip: (id: string) => ReactNode;
  /** Rótulo da legenda (métrica atual). */
  legendLabel: string;
  /** Título do gráfico nos arquivos baixados. */
  exportAs: string;
}

/** Intensidade de cada classe (mistura do azul com a superfície), da mais clara à mais escura. */
const STEPS = [16, 34, 54, 76, 100];

/**
 * Coroplético de um país com escala sequencial de um só tom.
 * 5 classes por quantil: um estado muito grande, como SP, não apaga os demais, e com 5 regiões cada uma
 * ganha um tom. No modo região os estados herdam a cor da região e as divisas internas somem.
 */
export function CountryMap({ country, mode, value, format, tooltip, legendLabel, exportAs }: Props) {
  const tip = useTipProps();
  const svgRef = useRef<SVGSVGElement>(null);
  const ids = mode === "state" ? country.states.map((s) => s.code) : country.regions.map((r) => r.id);
  const regionOf = new Map(country.states.map((s) => [s.code, s.region]));
  const values = ids.map(value).filter((v) => Number.isFinite(v) && v !== 0);
  const sorted = [...values].sort((a, b) => a - b);
  const max = sorted[sorted.length - 1] ?? 0;

  // Limites inferiores de cada classe.
  const breaks = STEPS.map((_, i) => sorted[Math.floor((i * sorted.length) / STEPS.length)] ?? 0);
  const classOf = (v: number) => {
    let k = 0;
    breaks.forEach((b, i) => {
      if (v >= b) k = i;
    });
    return k;
  };
  const fillOf = (v: number) => `color-mix(in srgb, var(--series-1) ${STEPS[classOf(v)]}%, var(--surface))`;
  const idOf = (code: string) => (mode === "state" ? code : (regionOf.get(code) ?? code));
  const hasValue = (v: number) => Number.isFinite(v) && v !== 0;
  const strong = (v: number) => hasValue(v) && classOf(v) >= 3;
  const legend = STEPS.map((_, i) => breaks[i]).filter((b, i, arr) => i === 0 || b !== arr[i - 1]);
  const legendText = (b: number, i: number) =>
    i < legend.length - 1 ? `${format(b)} a ${format(legend[i + 1])}` : b === max ? format(b) : `${format(b)} a ${format(max)}`;
  const hasEmpty = ids.some((id) => !hasValue(value(id)));

  const exporter: ChartExport = {
    svg: () => {
      const blue = token("--series-1");
      const surface = token("--surface");
      const items = legend.map((b, i) => ({ label: legendText(b, i), color: mixColor(blue, surface, STEPS[classOf(b)]) }));
      if (hasEmpty) items.push({ label: "Sem vendas", color: token("--surface-2") });
      return composeSvg(exportAs, serializeSvg(svgRef.current!), items);
    },
    table: () => {
      const header = mode === "state" ? ["Sigla", "Estado", "Região", legendLabel] : ["Região", legendLabel];
      const regionName = (id: string) => country.regions.find((r) => r.id === id)?.name ?? id;
      const rows =
        mode === "state"
          ? country.states.map((st) => [st.code, st.name, regionName(st.region), Number.isFinite(value(st.code)) ? value(st.code) : null])
          : country.regions.map((r) => [r.name, Number.isFinite(value(r.id)) ? value(r.id) : null]);
      return { header, rows };
    },
  };

  return (
    <div className="country-map">
      <div className="chart-toolbar">
        <ExportMenu name={exportAs} exporter={exporter} />
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${country.width} ${country.height}`}
        role="img"
        aria-label={`Mapa: ${country.name}, ${legendLabel} por ${mode === "state" ? "estado" : "região"}`}
      >
        {country.map.locations.map((loc) => {
          const uf = loc.id.toUpperCase();
          const v = value(idOf(uf));
          const fill = hasValue(v) ? fillOf(v) : undefined;
          return (
            <path
              key={loc.id}
              d={loc.path}
              className={`map-area ${fill ? "" : "empty"} ${mode === "region" ? "merged" : ""}`}
              style={fill ? { fill, stroke: mode === "region" ? fill : undefined } : undefined}
              {...tip(tooltip(idOf(uf)))}
            />
          );
        })}

        {mode === "state" &&
          country.states.map((u) => {
            const v = value(u.code);
            if (u.outside) {
              const gap = u.outside.anchor === "start" ? -4 : 4;
              return (
                <g key={u.code} className="map-callout">
                  <line x1={u.label.x} y1={u.label.y} x2={u.outside.x + gap} y2={u.outside.y} />
                  <circle cx={u.label.x} cy={u.label.y} r={1.8} />
                  <text x={u.outside.x} y={u.outside.y} textAnchor={u.outside.anchor} dominantBaseline="central" className="map-label">
                    {u.code}
                  </text>
                </g>
              );
            }
            return (
              <text
                key={u.code}
                x={u.label.x}
                y={u.label.y}
                textAnchor="middle"
                dominantBaseline="central"
                className={`map-label ${strong(v) ? "on-strong" : ""}`}
              >
                {u.code}
              </text>
            );
          })}

        {mode === "region" &&
          country.regions.map((r) => {
            const v = value(r.id);
            return (
              <g key={r.id} className={`map-region-label ${strong(v) ? "on-strong" : ""}`}>
                <text x={r.label.x} y={r.label.y - 9} textAnchor="middle" className="name">
                  {r.name}
                </text>
                <text x={r.label.x} y={r.label.y + 10} textAnchor="middle" className="val">
                  {Number.isFinite(v) ? format(v) : "-"}
                </text>
              </g>
            );
          })}
      </svg>

      <div className="map-legend" aria-hidden>
        <span className="map-legend-title">{legendLabel}</span>
        <div className="map-legend-steps">
          {legend.map((b, i) => (
            <span key={i} className="map-legend-step">
              <i style={{ background: fillOf(b) }} />
              {legendText(b, i)}
            </span>
          ))}
        </div>
        {hasEmpty && (
          <span className="map-legend-empty">
            <i /> Sem vendas
          </span>
        )}
      </div>
    </div>
  );
}
