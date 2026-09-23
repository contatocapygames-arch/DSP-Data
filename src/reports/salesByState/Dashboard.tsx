import { useMemo, useState } from "react";
import { BarList } from "../../components/charts/BarList";
import { CountryMap } from "../../components/charts/CountryMap";
import { Heatmap } from "../../components/charts/Heatmap";
import { IndexBars } from "../../components/charts/IndexBars";
import { DataTable, type Column } from "../../components/DataTable";
import { StatTiles } from "../../components/StatTiles";
import { COUNTRY_BY_ID, regionName, type CountryDef } from "../../lib/geo";
import { formatCompact, formatCurrency, formatInt, formatPct, formatShare } from "../../lib/format";
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

type Money = (v: number, compact?: boolean) => string;
const moneyFor =
  (c: CountryDef): Money =>
  (v, compact = true) =>
    formatCurrency(v, c.currencySymbol, compact);
const formatIndex = (v: number) => (Number.isFinite(v) ? Math.round(v).toString() : "-");

const metricsFor = (money: Money, sym: string): Record<MetricKey, MetricDef> => ({
  sales: { label: `Vendas (${sym})`, additive: true, value: (a) => a.metrics.sales, format: (v) => money(v) },
  orders: { label: "Pedidos", additive: true, value: (a) => a.metrics.orders, format: formatCompact },
  ntbSales: { label: `Vendas NTB (${sym})`, additive: true, value: (a) => a.metrics.ntbSales, format: (v) => money(v) },
  ntbOrders: { label: "Pedidos NTB", additive: true, value: (a) => a.metrics.ntbOrders, format: formatCompact },
  ticket: { label: `Ticket médio (${sym})`, additive: false, value: (a) => ticket(a.metrics), format: (v) => money(v, false) },
  ntbSalesShare: { label: "% NTB nas vendas", additive: false, value: (a) => ntbSalesShare(a.metrics), format: (v) => formatPct(v) },
  ntbOrdersShare: { label: "% NTB nos pedidos", additive: false, value: (a) => ntbOrdersShare(a.metrics), format: (v) => formatPct(v) },
  perCapita: { label: `Vendas por mil habitantes (${sym})`, additive: false, value: salesPerThousand, format: (v) => money(v, false) },
  index: { label: "Índice vs população (100 = proporcional)", additive: false, value: penetrationIndex, format: formatIndex },
});

/** Para % do total, divide pelo total da mesma métrica. */
const totalOf = (key: MetricKey, total: StateMetrics) =>
  key === "sales" ? total.sales : key === "orders" ? total.orders : key === "ntbSales" ? total.ntbSales : total.ntbOrders;

export function SalesByStateDashboard({ data }: { data: ParsedStates }) {
  const [countryId, setCountryId] = useState(data.countries[0]);
  const country = COUNTRY_BY_ID.get(countryId)!;
  return (
    <div className="dashboard">
      {data.countries.length > 1 && (
        <div className="tabs" role="tablist">
          {data.countries.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={id === countryId} onClick={() => setCountryId(id)}>
              {COUNTRY_BY_ID.get(id)!.name}
            </button>
          ))}
        </div>
      )}
      <CountryView key={countryId} data={data} country={country} />
    </div>
  );
}

function CountryView({ data, country }: { data: ParsedStates; country: CountryDef }) {
  const money = moneyFor(country);
  const METRICS = metricsFor(money, country.currencySymbol);
  const advertisers = useMemo(() => {
    const present = new Set(data.rows.filter((r) => r.country === country.id).map((r) => r.advertiser));
    return data.advertisers.filter((ad) => present.has(ad.key));
  }, [data, country.id]);
  const [advertiser, setAdvertiser] = useState<string | null>(null);
  const [view, setView] = useState<View>("state");
  const [metric, setMetric] = useState<MetricKey>("sales");
  const [asShare, setAsShare] = useState(false);

  const a = useMemo(() => analyzeStates(data.rows, country, advertiser), [data.rows, country, advertiser]);
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
        Vendas: {money(x.metrics.sales, false)} ({formatShare(x.metrics.sales / a.total.sales)})
      </div>
      <div>
        Pedidos: {formatInt(x.metrics.orders)} ({formatShare(x.metrics.orders / a.total.orders)})
      </div>
      <div>Ticket médio: {money(ticket(x.metrics), false)}</div>
      <div>% NTB nas vendas: {formatPct(ntbSalesShare(x.metrics))}</div>
      <div>Índice vs população: {formatIndex(penetrationIndex(x, a.total))}</div>
    </>
  );

  const ranking = [...areas].sort((p, q) => (valueOf(q) || 0) - (valueOf(p) || 0)).filter((x) => x.metrics.orders > 0 || view === "region");
  const top = [...a.states].sort((p, q) => q.metrics.sales - p.metrics.sales);
  const topRegion = [...a.regions].sort((p, q) => q.metrics.sales - p.metrics.sales)[0];
  const indexCandidates = withSales.filter((s) => s.popShare >= 0.005);
  const bestIndex = [...indexCandidates].sort((p, q) => penetrationIndex(q, a.total) - penetrationIndex(p, a.total))[0];
  const bestNtb = [...withSales]
    .filter((s) => s.metrics.orders >= a.total.orders * 0.01)
    .sort((p, q) => ntbSalesShare(q.metrics) - ntbSalesShare(p.metrics))[0];

  return (
    <>
      <section className="card">
        <div className="filters-row">
          {advertisers.length > 1 && (
            <label>
              Anunciante
              <select value={advertiser ?? ""} onChange={(e) => setAdvertiser(e.target.value || null)}>
                <option value="">Todos ({advertisers.length})</option>
                {advertisers.map((ad) => (
                  <option key={ad.key} value={ad.key}>
                    {ad.label}
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
              {areasToReach(a.states, 0.5)} estado(s) somam metade das vendas e {areasToReach(a.states, 0.8)} somam 80%. {withSales.length} de{" "}
              {country.states.length} estados tiveram venda.
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
          { label: "Vendas", value: money(a.total.sales), note: money(a.total.sales, false) },
          { label: "Pedidos", value: formatCompact(a.total.orders), note: formatInt(a.total.orders) },
          { label: "Ticket médio", value: money(ticket(a.total), false) },
          { label: "% NTB nas vendas", value: formatPct(ntbSalesShare(a.total)), note: money(a.total.ntbSales, false) },
          { label: "% NTB nos pedidos", value: formatPct(ntbOrdersShare(a.total)), note: `${formatInt(a.total.ntbOrders)} pedidos` },
          { label: "Estados com venda", value: `${withSales.length} / ${country.states.length}` },
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
        <div className={`map-layout ${country.width / country.height > 1.3 ? "wide" : ""}`}>
          <CountryMap
            country={country}
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
        <RegionTable regions={a.regions} total={a.total} money={money} />
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
            <p>Vendas / pedidos. Média geral: {money(ticket(a.total), false)}.</p>
          </header>
          <BarList
            items={[...withSales]
              .sort((p, q) => ticket(q.metrics) - ticket(p.metrics))
              .map((s) => ({
                label: `${s.id} · ${s.name}`,
                valueLabel: money(ticket(s.metrics), false),
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

      {advertisers.length > 1 && advertiser === null && <AdvertiserSection data={data} country={country} advertisers={advertisers} money={money} />}

      <section className="card">
        <header>
          <h2>Tabela por estado</h2>
        </header>
        <StateTable states={a.states} total={a.total} country={country} money={money} />
      </section>

      <p className="footnote">
        Vendas e pedidos atribuídos pelo AMC (amazon_attributed_events_by_conversion_time), pelo estado do endereço do cliente, na moeda da
        conta ({country.currency}). {country.sources}
      </p>
    </>
  );
}

const formatMultipleX = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;

function RegionTable({ regions, total, money }: { regions: AreaStat[]; total: StateMetrics; money: Money }) {
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
                <td className="num">{money(r.metrics.sales, false)}</td>
                <td className="num">{formatShare(r.metrics.sales / total.sales)}</td>
                <td className="num">{formatInt(r.metrics.orders)}</td>
                <td className="num">{formatShare(r.metrics.orders / total.orders)}</td>
                <td className="num">{money(ticket(r.metrics), false)}</td>
                <td className="num">{formatPct(ntbSalesShare(r.metrics))}</td>
                <td className="num">{formatPct(r.popShare)}</td>
                <td className="num">{formatIndex(penetrationIndex(r, total))}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function StateTable({ states, total, country, money }: { states: AreaStat[]; total: StateMetrics; country: CountryDef; money: Money }) {
  const cols: Column<AreaStat>[] = [
    { key: "uf", label: "Sigla", value: (s) => s.id, render: (s) => s.id },
    { key: "name", label: "Estado", value: (s) => s.name, render: (s) => s.name },
    { key: "region", label: "Região", value: (s) => regionName(country, s.region), render: (s) => regionName(country, s.region) },
    { key: "sales", label: `Vendas (${country.currencySymbol})`, numeric: true, value: (s) => s.metrics.sales, render: (s) => money(s.metrics.sales, false) },
    { key: "salesShare", label: "% vendas", numeric: true, value: (s) => s.metrics.sales / total.sales, render: (s) => formatShare(s.metrics.sales / total.sales) },
    { key: "orders", label: "Pedidos", numeric: true, value: (s) => s.metrics.orders, render: (s) => formatInt(s.metrics.orders) },
    { key: "ordersShare", label: "% pedidos", numeric: true, value: (s) => s.metrics.orders / total.orders, render: (s) => formatShare(s.metrics.orders / total.orders) },
    { key: "ticket", label: "Ticket médio", numeric: true, value: (s) => ticket(s.metrics), render: (s) => money(ticket(s.metrics), false) },
    { key: "ntbSales", label: `Vendas NTB (${country.currencySymbol})`, numeric: true, value: (s) => s.metrics.ntbSales, render: (s) => money(s.metrics.ntbSales, false) },
    { key: "ntbShare", label: "% NTB vendas", numeric: true, value: (s) => ntbSalesShare(s.metrics), render: (s) => formatPct(ntbSalesShare(s.metrics)) },
    { key: "ntbOrders", label: "Pedidos NTB", numeric: true, value: (s) => s.metrics.ntbOrders, render: (s) => formatInt(s.metrics.ntbOrders) },
    { key: "ntbOrdersShare", label: "% NTB pedidos", numeric: true, value: (s) => ntbOrdersShare(s.metrics), render: (s) => formatPct(ntbOrdersShare(s.metrics)) },
    { key: "perCapita", label: `${country.currencySymbol} / mil hab.`, numeric: true, value: salesPerThousand, render: (s) => money(salesPerThousand(s), false) },
    { key: "index", label: "Índice", numeric: true, value: (s) => penetrationIndex(s, total), render: (s) => formatIndex(penetrationIndex(s, total)) },
  ];
  return <DataTable rows={states} columns={cols} searchText={(s) => `${s.id} ${s.name} ${regionName(country, s.region)}`} initialSort="sales" exportName={`vendas-por-estado-${country.id.toLowerCase()}`} pageSize={country.states.length} />;
}

function AdvertiserSection({
  data,
  country,
  advertisers,
  money,
}: {
  data: ParsedStates;
  country: CountryDef;
  advertisers: ParsedStates["advertisers"];
  money: Money;
}) {
  const stats = useMemo(
    () => advertisers.map((ad) => ({ name: ad.label, ...analyzeStates(data.rows, country, ad.key) })).sort((p, q) => q.total.sales - p.total.sales),
    [data, country, advertisers],
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
            <div>{money(stats[i].regions[j].metrics.sales, false)}</div>
            <div>{formatPct(pct(i, j))} das vendas do anunciante</div>
          </>
        )}
      />
    </section>
  );
}
