import { useState } from "react";
import { BarList } from "../../components/charts/BarList";
import { formatInt, formatMultiple, formatPct } from "../../lib/format";
import type { LengthStat, Segment, TouchpointStat } from "./analyze";
import type { Insight } from "./insights";
import type { MetricColumn } from "./metrics";
import type { Metrics } from "./parse";

export function InsightCards({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  return (
    <section className="insights">
      {insights.map((i) => (
        <article key={i.title} className="insight">
          <h3>{i.title}</h3>
          <p>{i.body}</p>
        </article>
      ))}
    </section>
  );
}

/** Barra por segmento para a métrica escolhida; o total vira a referência no subtítulo. */
export function SegmentCompare({ segments, columns, title }: { segments: Segment[]; columns: MetricColumn[]; title: string }) {
  const [key, setKey] = useState(columns[0].key);
  const col = columns.find((c) => c.key === key) ?? columns[0];
  const total = segments[0].metrics;
  const rows = segments.filter((s) => s.id !== "total");

  return (
    <section className="card">
      <header className="with-controls">
        <div>
          <h2>{title}</h2>
          <p>Todos os caminhos: {col.format(col.value(total, total))}</p>
        </div>
        <select value={key} onChange={(e) => setKey(e.target.value)} aria-label="Métrica">
          {columns.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </header>
      <BarList
        items={rows.map((s) => {
          const v = col.value(s.metrics, total);
          return {
            label: `${s.subsetOf ? "↳ " : ""}${s.label}`,
            valueLabel: col.format(v),
            segments: [{ key: "v", value: Number.isFinite(v) ? v : 0, series: 1 }],
            tooltip: (
              <>
                <strong>{s.label}</strong>
                <div>
                  {col.label}: {col.format(v)}
                </div>
                <div>{formatInt(s.metrics.users)} usuários</div>
              </>
            ),
          };
        })}
      />
    </section>
  );
}

/** Taxa com o ponto x sem o ponto, ordenado pelo lift. */
export function TouchCompare({
  touchpoints,
  metric,
  metricLabel,
  title,
  description,
}: {
  touchpoints: TouchpointStat[];
  metric: (m: Metrics) => number;
  metricLabel: string;
  title: string;
  description: string;
}) {
  const lift = (t: TouchpointStat) => metric(t.with) / metric(t.without);
  const sorted = [...touchpoints].sort((a, b) => (lift(b) || 0) - (lift(a) || 0));
  return (
    <section className="card">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <BarList
        layout="grouped"
        legend={[
          { label: "Com o ponto no caminho", series: 1 },
          { label: "Sem o ponto", series: 2 },
        ]}
        items={sorted.map((t) => ({
          label: t.name,
          segments: [
            { key: "with", value: metric(t.with), series: 1, valueLabel: formatPct(metric(t.with), 2) },
            { key: "without", value: metric(t.without), series: 2, valueLabel: formatPct(metric(t.without), 2) },
          ],
          tooltip: (
            <>
              <strong>{t.name}</strong>
              <div>
                {metricLabel} com: {formatPct(metric(t.with), 2)} ({formatInt(t.with.users)} usuários)
              </div>
              <div>
                {metricLabel} sem: {formatPct(metric(t.without), 2)} ({formatInt(t.without.users)} usuários)
              </div>
              <div>Lift: {formatMultiple(lift(t), "x")}</div>
            </>
          ),
        }))}
      />
    </section>
  );
}

/** Participação de cada ponto como primeiro ou último toque, ponderada pela métrica (ex.: compradores). */
export function PositionBars({
  touchpoints,
  pick,
  total,
  title,
  description,
}: {
  touchpoints: TouchpointStat[];
  pick: (t: TouchpointStat) => number;
  total: number;
  title: string;
  description: string;
}) {
  const sorted = [...touchpoints].sort((a, b) => pick(b) - pick(a));
  return (
    <section className="card">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <BarList
        items={sorted.map((t) => ({
          label: t.name,
          valueLabel: formatPct(pick(t) / total),
          segments: [{ key: "v", value: pick(t), series: 1 }],
          tooltip: (
            <>
              <strong>{t.name}</strong>
              <div>{formatInt(pick(t))} compradores</div>
              <div>{formatPct(pick(t) / total)} do total</div>
            </>
          ),
        }))}
      />
    </section>
  );
}

export function LengthBars({
  lengths,
  value,
  format,
  title,
  description,
}: {
  lengths: LengthStat[];
  value: (m: Metrics) => number;
  format: (v: number) => string;
  title: string;
  description: string;
}) {
  return (
    <section className="card">
      <header>
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <BarList
        items={lengths.map((l) => {
          const v = value(l.metrics);
          return {
            label: `${l.length} ponto${l.length > 1 ? "s" : ""}`,
            valueLabel: format(v),
            segments: [{ key: "v", value: Number.isFinite(v) ? v : 0, series: 1 }],
            tooltip: (
              <>
                <strong>
                  Caminhos com {l.length} ponto{l.length > 1 ? "s" : ""}
                </strong>
                <div>{format(v)}</div>
                <div>
                  {formatInt(l.metrics.users)} usuários · {formatInt(l.metrics.buyers)} compradores
                </div>
              </>
            ),
          };
        })}
      />
    </section>
  );
}
