import { useMemo, useState, type ReactNode } from "react";
import { downloadCsv } from "../lib/exportCsv";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Valor para ordenar e para exportar. */
  value: (row: T) => string | number;
  numeric?: boolean;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  searchText: (row: T) => string;
  initialSort: string;
  exportName: string;
  pageSize?: number;
}

export function DataTable<T>({ rows, columns, searchText, initialSort, exportName, pageSize = 25 }: Props<T>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; desc: boolean }>({ key: initialSort, desc: true });
  const [limit, setLimit] = useState(pageSize);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const col = columns.find((c) => c.key === sort.key) ?? columns[0];
    const list = q ? rows.filter((r) => searchText(r).toLowerCase().includes(q)) : [...rows];
    return list.sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return sort.desc ? -cmp : cmp;
    });
  }, [rows, columns, query, sort, searchText]);

  const download = () =>
    downloadCsv(
      exportName,
      columns.map((c) => c.label),
      filtered.map((r) => columns.map((c) => c.value(r))),
    );

  return (
    <div className="data-table">
      <div className="table-toolbar">
        <input
          type="search"
          placeholder="Buscar…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(pageSize);
          }}
        />
        <span className="muted">{filtered.length.toLocaleString("pt-BR")} linha(s)</span>
        <button type="button" className="btn ghost" onClick={download}>
          Baixar CSV
        </button>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.numeric ? "num" : undefined} aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : "none"}>
                  <button
                    type="button"
                    onClick={() => setSort((s) => ({ key: c.key, desc: s.key === c.key ? !s.desc : !!c.numeric }))}
                  >
                    {c.label}
                    {sort.key === c.key && <span aria-hidden> {sort.desc ? "↓" : "↑"}</span>}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, limit).map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c.key} className={c.numeric ? "num" : undefined}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > limit && (
        <button type="button" className="btn ghost more" onClick={() => setLimit((l) => l + pageSize * 2)}>
          Mostrar mais ({(filtered.length - limit).toLocaleString("pt-BR")} restantes)
        </button>
      )}
    </div>
  );
}
