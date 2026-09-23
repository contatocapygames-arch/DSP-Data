import { downloadCsv } from "../../lib/exportCsv";
import type { Segment } from "./analyze";
import { EXPORT_COLUMNS, type MetricColumn } from "./metrics";

interface Props {
  segments: Segment[];
  columns: MetricColumn[];
  filterSummary: string;
  exportName: string;
}

/** A "planilha" de segmentos do filtro, com download em CSV para Excel. */
export function SegmentTable({ segments, columns, filterSummary, exportName }: Props) {
  const total = segments[0].metrics;

  const download = () =>
    downloadCsv(
      exportName,
      ["Filtro", "Segmento", "Definição", ...EXPORT_COLUMNS.map((c) => c.label)],
      segments.map((s) => [filterSummary, s.label, s.description, ...EXPORT_COLUMNS.map((c) => c.value(s.metrics, total))]),
    );

  return (
    <div className="data-table">
      <div className="table-toolbar">
        <span className="muted">Filtro: {filterSummary || "nenhum"}</span>
        <button type="button" className="btn ghost" onClick={download}>
          Baixar planilha (CSV)
        </button>
      </div>
      <div className="table-scroll">
        <table className="seg-table">
          <thead>
            <tr>
              <th>Segmento</th>
              {columns.map((c) => (
                <th key={c.key} className="num">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.id} className={s.id === "total" ? "total" : s.subsetOf ? "subset" : undefined}>
                <td>
                  {s.subsetOf && <span aria-hidden>↳ </span>}
                  {s.label}
                  <span className="seg-desc">{s.description}</span>
                </td>
                {columns.map((c) => (
                  <td key={c.key} className="num">
                    {c.format(c.value(s.metrics, total))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
