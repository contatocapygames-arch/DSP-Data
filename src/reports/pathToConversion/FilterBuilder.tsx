import { OP_LABEL, describeFilter, filterName, type FilterRule, type MatchOp, type TouchFilter } from "./analyze";

interface Props {
  filter: TouchFilter;
  onChange: (f: TouchFilter) => void;
  touchpoints: string[];
  matched: string[];
}

export function FilterBuilder({ filter, onChange, touchpoints, matched }: Props) {
  const setRule = (i: number, patch: Partial<FilterRule>) =>
    onChange({ ...filter, rules: filter.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const matchedSet = new Set(matched);
  const summary = describeFilter(filter);

  return (
    <section className="card filter-card">
      <header>
        <h2>Filtro de pontos de contato</h2>
        <p>
          Defina por texto quais pontos de contato formam o grupo que você quer analisar (ex.: tudo que contém "DSP"). Os segmentos, tabelas e
          gráficos abaixo usam esse grupo. Maiúsculas e acentos são ignorados.
        </p>
      </header>

      <div className="filter-rules">
        {filter.rules.map((r, i) => (
          <div className="filter-rule" key={i}>
            {i > 0 && <span className="filter-join">{filter.join === "all" ? "E" : "OU"}</span>}
            <select value={r.op} onChange={(e) => setRule(i, { op: e.target.value as MatchOp })} aria-label="Condição">
              {(Object.keys(OP_LABEL) as MatchOp[]).map((op) => (
                <option key={op} value={op}>
                  {OP_LABEL[op]}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={r.value}
              placeholder="texto, ex.: DSP"
              onChange={(e) => setRule(i, { value: e.target.value })}
              aria-label="Texto do filtro"
            />
            {filter.rules.length > 1 && (
              <button
                type="button"
                className="btn ghost icon"
                aria-label="Remover condição"
                onClick={() => onChange({ ...filter, rules: filter.rules.filter((_, j) => j !== i) })}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <div className="filter-actions">
          <button type="button" className="btn ghost" onClick={() => onChange({ ...filter, rules: [...filter.rules, { op: "contains", value: "" }] })}>
            + Condição
          </button>
          {filter.rules.length > 1 && (
            <div className="segmented" role="group" aria-label="Como combinar as condições">
              <button type="button" aria-pressed={filter.join === "any"} onClick={() => onChange({ ...filter, join: "any" })}>
                Qualquer uma (OU)
              </button>
              <button type="button" aria-pressed={filter.join === "all"} onClick={() => onChange({ ...filter, join: "all" })}>
                Todas (E)
              </button>
            </div>
          )}
          <label className="filter-name">
            Nome do grupo
            <input type="text" value={filter.name} placeholder={filterName({ ...filter, name: "" })} onChange={(e) => onChange({ ...filter, name: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="filter-result">
        <span className="muted">
          {summary ? `Filtro: ${summary}` : "Sem filtro"} · {matched.length} de {touchpoints.length} pontos no grupo
        </span>
        <div className="touch-chips">
          {touchpoints.map((t) => (
            <span key={t} className={`touch-chip ${matchedSet.has(t) ? "in" : ""}`}>
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
