import { useMemo, useState } from "react";
import { BarList } from "../../components/charts/BarList";
import { BrazilMap } from "../../components/charts/BrazilMap";
import { Heatmap } from "../../components/charts/Heatmap";
import { IndexBars } from "../../components/charts/IndexBars";
import { DataTable, type Column } from "../../components/DataTable";
import { StatTiles } from "../../components/StatTiles";
import { BRAZIL_POPULATION, REGION_BY_ID } from "../../lib/brazil";
import { formatBRL, formatCompact, formatInt, formatPct, formatShare } from "../../lib/format";
import {
  analyzeStates,
  areasToReach,
  ntbOrdersShare,
  ntbSalesShare,
  penetrationIndex,
  salesPerThousand,
  ticket,
  type AreaStat,
  type ParsedStates,
  type StateMetrics,
} from "./analyze";

type View = "state" | "region";
type MetricKey = "sales" | "orders" | "ntbSales" | "ntbOrders" | "ticket" | "ntbSalesShare" | "ntbOrdersShare" | "perCapita" | "index";

interface MetricDef {
  label: string;
  /** Métricas somáveis podem ser vistas em % do total. */
  additive: boolean;
  value: (a: AreaStat, total: StateMetrics) => number;
  format: (v: number) => string;
}

const METRICS: Record<MetricKey, MetricDef> = {
  sales: { label: "Vendas (R$)", additive: true, value: (a) => a.metrics.sales, format: (v) => formatBRL(v) },
  orders: { label: "Pedidos", additive: true, value: (a) => a.metrics.orders, format: formatCompact },
  ntbSales: { label: "Vendas NTB (R$)", additive: true, value: (a) => a.metrics.ntbSales, format: (v) => formatBRL(v) },
  ntbOrders: { label: "Pedidos NTB", additive: true, value: (a) => a.metrics.ntbOrders, format: formatCompact },
  ticket: { label: "Ticket médio (R$)", additive: false, value: (a) => ticket(a.metrics), format: (v) => formatBRL(v, false) },
  ntbSalesShare: { label: "% NTB nas vendas", additive: false, value: (a) => ntbSalesShare(a.metrics), format: (v) => formatPct(v) },
  ntbOrdersShare: { label: "% NTB nos pedidos", additive: false, value: (a) => ntbOrdersShare(a.metrics), format: (v) => formatPct(v) },
  perCapita: { label: "Vendas por mil habitantes (R$)", additive: false, value: salesPerThousand, format: (v) => formatBRL(v, false) },
  index: { label: "Índice vs população (100 = proporcional)", additive: false, value: penetrationIndex, format: (v) => (Number.isFinite(v) ? Math.round(v).toString() : "-") },
};

/** Para % do total, divide pelo total da mesma métrica. */
const totalOf = (key: MetricKey, total: StateMetrics) =>
  key === "sales" ? total.sales : key === "orders" ? total.orders : key === "ntbSales" ? total.ntbSales : total.ntbOrders;

export function SalesByStateDashboard({ data }: { data: ParsedStates }) {
  const [advertiser, setAdvertiser] = useState<string | null>(null);
  const [view, setView] = useState<View>("state");
  const [metric, setMetric] = useState<MetricKey>("sales");
  const [asShare, setAsShare] = useState(false);

  const a = useMemo(() => analyzeStates(data.rows, advertiser), [data.rows, advertiser]);
  const def = METRICS[metric];
  const share = asShare && def.additive;
  const areas = view === "state" ? a.states : a.regions;
  const areaById = new Map(areas.map((x) => [x.id, x]));
  const valueOf = (x: AreaStat) => {
    const v = def.value(x, a.total);
    return share ? v / totalOf(metric, a.total) : v;
  };
  const fmt = share ? (v: number) => formatShare(v) : def.format;
  const withSales = a.states.filter((s) => s.metrics.orders > 0);

  const areaTooltip = (x: AreaStat) => (
    <>
      <strong>
        {x.name}
        {view === "state" ? ` (${x.id})` : ""}
      </strong>
      <div>
        Vendas: {formatBRL(x.metrics.sales, false)} ({formatShare(x.metrics.sales / a.total.sales)})
      </div>
      <div>
        Pedidos: {formatInt(x.metrics.orders)} ({formatShare(x.metrics.orders / a.total.orders)})
      </div>
      <div>Ticket médio: {formatBRL(ticket(x.metrics), false)}</div>
      <div>% NTB nas vendas: {formatPct(ntbSalesShare(x.metrics))}</div>
      <div>Índice vs população: {METRICS.index.format(penetrationIndex(x, a.total))}</div>
    </>
  );

  const ranking = [...areas].sort((p, q) => (valueOf(q) || 0) - (valueOf(p) || 0)).filter((x) => x.metrics.orders > 0 || view === "region");
  const top = [...a.states].sort((p, q) => q.metrics.sales - p.metrics.sales);
  const topRegion = [...a.regions].sort((p, q) => q.metrics.sales - p.metrics.sales)[0];
  const indexCandidates = withSales.filter((s) => s.population >= BRAZIL_POPULATION * 0.005);
  const bestIndex = [...indexCandidates].sort((p, q) => penetrationIndex(q, a.total) - penetrationIndex(p, a.total))[0];
  const bestNtb = [...withSales]
    .filter((s) => s.metrics.orders >= a.total.orders * 0.01)
    .sort((p, q) => ntbSalesShare(q.metrics) - ntbSalesShare(p.metrics))[0];

  return (
    <div className="dashboard">
      <section className="card">
        <div className="filters-row">
          {data.advertisers.length > 1 && (
            <label>
              Anunciante
              <select value={advertiser ?? ""} onChange={(e) => setAdvertiser(e.target.value || null)}>
                <option value="">Todos ({data.advertisers.length})</option>
                {data.advertisers.map((ad) => (
                  <option key={ad} value={ad}>
                    {ad}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="segmented" role="group" aria-label="Visão do mapa">
            <button type="button" aria-pressed={view === "state"} onClick={() => setView("state")}>
              Por estado
            </button>
            <button type="button" aria-pressed={view === "region"} onClick={() => setView("region")}>
              Por região
            </button>
          </div>
          <label>
            Métrica
            <select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
              {(Object.keys(METRICS) as MetricKey[]).map((k) => (
                <option key={k} value={k}>
                  {METRICS[k].label}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented" role="group" aria-label="Formato">
            <button type="button" aria-pressed={!share} onClick={() => setAsShare(false)}>
              Valor
            </button>
            <button type="button" aria-pressed={share} disabled={!def.additive} onClick={() => setAsShare(true)} title={def.additive ? undefined : "Disponível para vendas e pedidos"}>
              % do total
            </button>
          </div>
        </div>
      </section>

      {a.total.orders > 0 && (
        <section className="insights">
          <article className="insight">
            <h3>Estado líder</h3>
            <p>
              {top[0].name} concentra {formatPct(top[0].metrics.sales / a.total.sales)} das vendas; {topRegion.name} é a maior região (
              {formatPct(topRegion.metrics.sales / a.total.sales)}).
            </p>
          </article>
          <article className="insight">
            <h3>Concentração</h3>
            <p>
              {areasToReach(a.states, 0.5)} estado(s) somam metade das vendas e {areasToReach(a.states, 0.8)} somam 80%. {withSales.length} de 27
              UFs tiveram venda.
            </p>
          </article>
          {bestIndex && (
            <article className="insight">
              <h3>Acima do peso populacional</h3>
              <p>
                {bestIndex.name} tem índice {Math.round(penetrationIndex(bestIndex, a.total))}: vende {formatMultipleX(penetrationIndex(bestIndex, a.total) / 100)} o
                que o tamanho da população sugere.
              </p>
            </article>
          )}
          {bestNtb && a.total.ntbSales > 0 && (
            <article className="insight">
              <h3>Mais clientes novos</h3>
              <p>
                {bestNtb.name}: {formatPct(ntbSalesShare(bestNtb.metrics))} das vendas vêm de clientes NTB (média {formatPct(ntbSalesShare(a.total))}).
              </p>
            </article>
          )}
        </section>
      )}

      <StatTiles
        stats={[
          { label: "Vendas", value: formatBRL(a.total.sales), note: formatBRL(a.total.sales, false) },
          { label: "Pedidos", value: formatCompact(a.total.orders), note: formatInt(a.total.orders) },
          { label: "Ticket médio", value: formatBRL(ticket(a.total), false) },
          { label: "% NTB nas vendas", value: formatPct(ntbSalesShare(a.total)), note: formatBRL(a.total.ntbSales, false) },
          { label: "% NTB nos pedidos", value: formatPct(ntbOrdersShare(a.total)), note: `${formatInt(a.total.ntbOrders)} pedidos` },
          { label: "UFs com venda", value: `${withSales.length} / 27` },
        ]}
      />

      <section className="card">
        <header>
          <h2>
            {def.label}
            {share ? " · % do total" : ""} por {view === "state" ? "estado" : "região"}
          </h2>
          <p>Passe o mouse no mapa ou no ranking para ver todas as métricas da área.</p>
        </header>
        <div className="map-layout">
          <BrazilMap
            mode={view}
            value={(id) => {
              const x = areaById.get(id);
              return x && x.metrics.orders > 0 ? valueOf(x) : NaN;
            }}
            format={fmt}
            tooltip={(id) => {
              const x = areaById.get(id);
              return x ? areaTooltip(x) : null;
            }}
            legendLabel={`${def.label}${share ? " (% do total)" : ""}`}
          />
          <div>
            <h3 className="subhead">Ranking</h3>
            <BarList
              items={ranking.map((x) => {
                const v = valueOf(x);
                return {
                  label: view === "state" ? `${x.id} · ${x.name}` : x.name,
                  valueLabel: fmt(v),
                  segments: [{ key: "v", value: Number.isFinite(v) ? Math.max(v, 0) : 0, series: 1 }],
                  tooltip: areaTooltip(x),
                };
              })}
            />
          </div>
        </div>
      </section>

      <section className="card">
        <header>
          <h2>Regiões</h2>
          <p>Índice = participação nas vendas / participação na população (IBGE, Censo 2022) x 100. Acima de 100, a região vende mais que o seu peso populacional.</p>
        </header>
        <RegionTable regions={a.regions} total={a.total} />
      </section>

      <div className="grid-2">
        <section className="card">
          <header>
            <h2>Concentração das vendas</h2>
            <p>Estados em ordem de vendas, com a participação acumulada.</p>
          </header>
          <BarList
            items={(() => {
              let acc = 0;
              return top
                .filter((s) => s.metrics.sales > 0)
                .slice(0, 12)
                .map((s) => {
                  acc += s.metrics.sales;
                  const cum = acc / a.total.sales;
                  return {
                    label: `${s.id} · ${s.name}`,
                    valueLabel: `${formatShare(s.metrics.sales / a.total.sales)} · acum. ${formatPct(cum, 0)}`,
                    segments: [{ key: "v", value: s.metrics.sales, series: 1 }],
                    tooltip: areaTooltip(s),
                  };
                });
            })()}
          />
        </section>
        <section className="card">
          <header>
            <h2>Índice de vendas vs população</h2>
            <p>100 = vende na proporção da população. Escala logarítmica: 200 (o dobro) e 50 (a metade) ficam à mesma distância do centro.</p>
          </header>
          <IndexBars
            items={[...withSales]
              .sort((p, q) => penetrationIndex(q, a.total) - penetrationIndex(p, a.total))
              .map((s) => ({ label: `${s.id} · ${s.name}`, value: penetrationIndex(s, a.total), tooltip: areaTooltip(s) }))}
          />
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <header>
            <h2>Ticket médio por estado</h2>
            <p>Vendas / pedidos. Média geral: {formatBRL(ticket(a.total), false)}.</p>
          </header>
          <BarList
            items={[...withSales]
              .sort((p, q) => ticket(q.metrics) - ticket(p.metrics))
              .map((s) => ({
                label: `${s.id} · ${s.name}`,
                valueLabel: formatBRL(ticket(s.metrics), false),
                segments: [{ key: "v", value: ticket(s.metrics), series: 1 }],
                tooltip: areaTooltip(s),
              }))}
          />
        </section>
        <section className="card">
          <header>
            <h2>% NTB nas vendas por estado</h2>
            <p>Quanto das vendas veio de clientes novos para a marca. Média geral: {formatPct(ntbSalesShare(a.total))}.</p>
          </header>
          <BarList
            items={[...withSales]
              .sort((p, q) => (ntbSalesShare(q.metrics) || 0) - (ntbSalesShare(p.metrics) || 0))
              .map((s) => ({
                label: `${s.id} · ${s.name}`,
                valueLabel: formatPct(ntbSalesShare(s.metrics)),
                segments: [{ key: "v", value: ntbSalesShare(s.metrics) || 0, series: 1 }],
                tooltip: areaTooltip(s),
              }))}
          />
        </section>
      </div>

      {data.advertisers.length > 1 && advertiser === null && <AdvertiserSection data={data} />}

      <section className="card">
        <header>
          <h2>Tabela por estado</h2>
        </header>
        <StateTable states={a.states} total={a.total} />
      </section>

      <p className="footnote">
        Vendas e pedidos atribuídos pelo AMC (amazon_attributed_events_by_conversion_time), pelo estado do endereço do cliente. População: IBGE,
        Censo 2022. Mapa: @svg-maps/brazil (Victor Cazanave, CC BY 4.0).
      </p>
    </div>
  );
}

const formatMultipleX = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;

function RegionTable({ regions, total }: { regions: AreaStat[]; total: StateMetrics }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Região</th>
            <th className="num">Vendas</th>
            <th className="num">% vendas</th>
            <th className="num">Pedidos</th>
            <th className="num">% pedidos</th>
            <th className="num">Ticket médio</th>
            <th className="num">% NTB vendas</th>
            <th className="num">% população</th>
            <th className="num">Índice</th>
          </tr>
        </thead>
        <tbody>
          {[...regions]
            .sort((p, q) => q.metrics.sales - p.metrics.sales)
            .map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="num">{formatBRL(r.metrics.sales, false)}</td>
                <td className="num">{formatShare(r.metrics.sales / total.sales)}</td>
                <td className="num">{formatInt(r.metrics.orders)}</td>
                <td className="num">{formatShare(r.metrics.orders / total.orders)}</td>
                <td className="num">{formatBRL(ticket(r.metrics), false)}</td>
                <td className="num">{formatPct(ntbSalesShare(r.metrics))}</td>
                <td className="num">{formatPct(r.population / BRAZIL_POPULATION)}</td>
                <td className="num">{METRICS.index.format(penetrationIndex(r, total))}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function StateTable({ states, total }: { states: AreaStat[]; total: StateMetrics }) {
  const cols: Column<AreaStat>[] = [
    { key: "uf", label: "UF", value: (s) => s.id, render: (s) => s.id },
    { key: "name", label: "Estado", value: (s) => s.name, render: (s) => s.name },
    { key: "region", label: "Região", value: (s) => REGION_BY_ID.get(s.region)!.name, render: (s) => REGION_BY_ID.get(s.region)!.name },
    { key: "sales", label: "Vendas (R$)", numeric: true, value: (s) => s.metrics.sales, render: (s) => formatBRL(s.metrics.sales, false) },
    { key: "salesShare", label: "% vendas", numeric: true, value: (s) => s.metrics.sales / total.sales, render: (s) => formatShare(s.metrics.sales / total.sales) },
    { key: "orders", label: "Pedidos", numeric: true, value: (s) => s.metrics.orders, render: (s) => formatInt(s.metrics.orders) },
    { key: "ordersShare", label: "% pedidos", numeric: true, value: (s) => s.metrics.orders / total.orders, render: (s) => formatShare(s.metrics.orders / total.orders) },
    { key: "ticket", label: "Ticket médio", numeric: true, value: (s) => ticket(s.metrics), render: (s) => formatBRL(ticket(s.metrics), false) },
    { key: "ntbSales", label: "Vendas NTB (R$)", numeric: true, value: (s) => s.metrics.ntbSales, render: (s) => formatBRL(s.metrics.ntbSales, false) },
    { key: "ntbShare", label: "% NTB vendas", numeric: true, value: (s) => ntbSalesShare(s.metrics), render: (s) => formatPct(ntbSalesShare(s.metrics)) },
    { key: "ntbOrders", label: "Pedidos NTB", numeric: true, value: (s) => s.metrics.ntbOrders, render: (s) => formatInt(s.metrics.ntbOrders) },
    { key: "ntbOrdersShare", label: "% NTB pedidos", numeric: true, value: (s) => ntbOrdersShare(s.metrics), render: (s) => formatPct(ntbOrdersShare(s.metrics)) },
    { key: "perCapita", label: "R$ / mil hab.", numeric: true, value: salesPerThousand, render: (s) => formatBRL(salesPerThousand(s), false) },
    { key: "index", label: "Índice", numeric: true, value: (s) => penetrationIndex(s, total), render: (s) => METRICS.index.format(penetrationIndex(s, total)) },
  ];
  return <DataTable rows={states} columns={cols} searchText={(s) => `${s.id} ${s.name} ${REGION_BY_ID.get(s.region)!.name}`} initialSort="sales" exportName="vendas-por-estado" pageSize={27} />;
}

function AdvertiserSection({ data }: { data: ParsedStates }) {
  const stats = useMemo(
    () => data.advertisers.map((ad) => ({ name: ad, ...analyzeStates(data.rows, ad) })).sort((p, q) => q.total.sales - p.total.sales),
    [data],
  );
  const regionNames = stats[0].regions.map((r) => r.name);
  const pct = (i: number, j: number) => stats[i].regions[j].metrics.sales / stats[i].total.sales || 0;
  const maxPct = Math.max(1e-9, ...stats.flatMap((_, i) => regionNames.map((_, j) => pct(i, j))));

  return (
    <section className="card">
      <header>
        <h2>Anunciantes por região</h2>
        <p>Leia por linha: como as vendas de cada anunciante se dividem entre as regiões.</p>
      </header>
      <Heatmap
        labels={stats.map((s) => s.name)}
        colLabels={regionNames}
        value={pct}
        intensity={(i, j) => pct(i, j) / maxPct}
        format={(v) => formatPct(v, 0)}
        tooltip={(i, j) => (
          <>
            <strong>
              {stats[i].name} · {regionNames[j]}
            </strong>
            <div>{formatBRL(stats[i].regions[j].metrics.sales, false)}</div>
            <div>{formatPct(pct(i, j))} das vendas do anunciante</div>
          </>
        )}
      />
    </section>
  );
}
