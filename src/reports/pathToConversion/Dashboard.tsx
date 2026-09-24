import { useMemo, useState } from "react";
import { BarList } from "../../components/charts/BarList";
import { Heatmap } from "../../components/charts/Heatmap";
import { DataTable, type Column } from "../../components/DataTable";
import { StatTiles } from "../../components/StatTiles";
import { formatCompact, formatInt, formatMoney, formatMoneyFull, formatMultiple, formatPct, formatShare } from "../../lib/format";
import {
  allTouchpoints,
  analyzeLengths,
  analyzeSegments,
  analyzeTouchpoints,
  analyzeTransitions,
  describeFilter,
  filterName,
  groupPaths,
  type GroupStat,
  type SegmentId,
  type TouchFilter,
  type TouchpointStat,
} from "./analyze";
import { FilterBuilder } from "./FilterBuilder";
import { buildNtbInsights, buildPathInsights } from "./insights";
import { NTB_COLUMNS, PATH_COLUMNS } from "./metrics";
import {
  costPerNtb,
  ntbBuyerShare,
  ntbRate,
  ntbSalesShare,
  ntbShare,
  purchaseRate,
  roas,
  type Metrics,
  type ParsedPaths,
} from "./parse";
import { PathChips } from "./PathChips";
import { InsightCards, LengthBars, PositionBars, SegmentCompare, TouchCompare } from "./sections";
import { SegmentTable } from "./SegmentTable";

type Tab = "paths" | "ntb";

const DEFAULT_FILTER: TouchFilter = { rules: [{ op: "contains", value: "DSP" }], join: "any", name: "" };

function formatDate(iso?: string) {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function PathToConversionDashboard({ data }: { data: ParsedPaths }) {
  const { rows } = data;
  const [filter, setFilter] = useState<TouchFilter>(() => {
    // Se nenhum ponto tiver "DSP", começa sem filtro para não mostrar segmentos vazios.
    const has = allTouchpoints(rows).some((t) => /dsp/i.test(t));
    return has ? DEFAULT_FILTER : { ...DEFAULT_FILTER, rules: [{ op: "contains", value: "" }] };
  });
  const [tab, setTab] = useState<Tab>("paths");

  const touchpointNames = useMemo(() => allTouchpoints(rows), [rows]);
  const touchpoints = useMemo(() => analyzeTouchpoints(rows), [rows]);
  const lengths = useMemo(() => analyzeLengths(rows), [rows]);
  const seg = useMemo(() => analyzeSegments(rows, filter), [rows, filter]);
  const groupName = filterName(filter);
  const summary = describeFilter(filter);
  const matchedSet = useMemo(() => new Set(seg.matched), [seg.matched]);
  const total = seg.segments[0].metrics;
  const segmentLabel = Object.fromEntries(seg.segments.map((s) => [s.id, s.short])) as Record<SegmentId, string>;
  const degenerate = seg.matched.length === 0 || seg.others.length === 0;

  return (
    <div className="dashboard">
      {(data.startDate || data.templateName) && (
        <p className="period">
          {data.templateName && <strong>{data.templateName}</strong>}
          {data.startDate && ` · ${formatDate(data.startDate)} a ${formatDate(data.endDate)}`}
        </p>
      )}

      <FilterBuilder filter={filter} onChange={setFilter} touchpoints={touchpointNames} matched={seg.matched} />
      {degenerate && (
        <ul className="warnings">
          <li>
            {seg.matched.length === 0
              ? "Nenhum ponto de contato casa com o filtro: todos os caminhos caem em \"Sem grupo\"."
              : "Todos os pontos de contato casam com o filtro: todos os caminhos caem em \"Só grupo\" ou full funnel."}
          </li>
        </ul>
      )}

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "paths"} onClick={() => setTab("paths")}>
          Caminhos de conversão
        </button>
        <button type="button" role="tab" aria-selected={tab === "ntb"} onClick={() => setTab("ntb")}>
          NTB · novos clientes
        </button>
      </div>

      {tab === "paths" ? (
        <PathsTab
          data={data}
          seg={seg}
          touchpoints={touchpoints}
          lengths={lengths}
          total={total}
          groupName={groupName}
          summary={summary}
          matchedSet={matchedSet}
          touchpointNames={touchpointNames}
          segmentLabel={segmentLabel}
        />
      ) : (
        <NtbTab
          data={data}
          seg={seg}
          touchpoints={touchpoints}
          lengths={lengths}
          total={total}
          groupName={groupName}
          summary={summary}
          matchedSet={matchedSet}
          segmentLabel={segmentLabel}
        />
      )}

      <p className="footnote">
        Cada linha do CSV é um caminho único (sequência de grupos de campanha até a compra ou até o fim do período) e path_occurrences é o
        número de usuários que fizeram esse caminho. Somar linhas não duplica usuários. Custo e vendas estão na moeda da conta do AMC. O AMC
        omite caminhos abaixo do limite de agregação, então os totais podem ficar um pouco abaixo do real.
      </p>
    </div>
  );
}

interface TabProps {
  data: ParsedPaths;
  seg: ReturnType<typeof analyzeSegments>;
  touchpoints: TouchpointStat[];
  lengths: ReturnType<typeof analyzeLengths>;
  total: Metrics;
  groupName: string;
  summary: string;
  matchedSet: Set<string>;
  segmentLabel: Record<SegmentId, string>;
}

function PathsTab({ data, seg, touchpoints, lengths, total, groupName, summary, matchedSet, touchpointNames, segmentLabel }: TabProps & { touchpointNames: string[] }) {
  const insights = useMemo(() => buildPathInsights(seg, touchpoints, lengths, groupName), [seg, touchpoints, lengths, groupName]);
  const [transMode, setTransMode] = useState<"pct" | "abs">("pct");
  const transitions = useMemo(() => analyzeTransitions(data.rows, touchpointNames, (m) => m.buyers), [data.rows, touchpointNames]);
  const rowTotals = transitions.map((r) => r.reduce((s, v) => s + v, 0));
  const maxAbs = Math.max(1, ...transitions.flat());
  const maxPct = Math.max(1e-9, ...transitions.map((r, i) => Math.max(...r.map((v) => (rowTotals[i] ? v / rowTotals[i] : 0)))));

  return (
    <>
      <InsightCards insights={insights} />
      <StatTiles
        stats={[
          { label: "Caminhos únicos", value: formatInt(total.paths) },
          { label: "Usuários", value: formatCompact(total.users), note: formatInt(total.users) },
          { label: "Compradores", value: formatCompact(total.buyers), note: formatInt(total.buyers) },
          { label: "Taxa de compra", value: formatPct(purchaseRate(total), 2) },
          { label: "Vendas", value: formatMoney(total.sales), note: `Custo ${formatMoney(total.cost)}` },
          { label: "ROAS", value: formatMultiple(roas(total)) },
        ]}
      />

      <section className="card">
        <header>
          <h2>Planilha por segmento do filtro</h2>
          <p>
            Full funnel, Só {groupName}, Sem {groupName} e "{groupName} + outros" somam o total. "Todos os outros pontos, sem {groupName}" é um
            recorte de "Sem {groupName}". O download traz também as colunas de NTB.
          </p>
        </header>
        <SegmentTable segments={seg.segments} columns={PATH_COLUMNS} filterSummary={summary} exportName={`path-to-conversion-segmentos-${groupName}`} />
      </section>

      <SegmentCompare segments={seg.segments} columns={PATH_COLUMNS.filter((c) => c.key !== "paths")} title="Comparar segmentos" />

      <div className="grid-2">
        <TouchCompare
          touchpoints={touchpoints}
          metric={purchaseRate}
          metricLabel="Taxa de compra"
          title="Taxa de compra com e sem cada ponto"
          description="Compara quem teve o ponto de contato no caminho com quem não teve. Ordenado pelo lift."
        />
        <section className="card">
          <header>
            <h2>Pontos de contato nos caminhos com compra</h2>
            <p>% dos compradores cujo caminho passou pelo ponto (um comprador conta em todos os pontos do seu caminho).</p>
          </header>
          <PositionBarsShare touchpoints={touchpoints} total={total} />
        </section>
      </div>

      <div className="grid-2">
        <PositionBars
          touchpoints={touchpoints}
          pick={(t) => t.firstBuyers}
          total={total.buyers}
          title="Primeiro toque dos compradores"
          description="Por onde começam os caminhos que terminaram em compra."
        />
        <PositionBars
          touchpoints={touchpoints}
          pick={(t) => t.lastBuyers}
          total={total.buyers}
          title="Último toque dos compradores"
          description="O último ponto de contato antes da compra."
        />
      </div>

      <div className="grid-2">
        <LengthBars
          lengths={lengths}
          value={(m) => m.users / total.users}
          format={(v) => formatPct(v)}
          title="Usuários por tamanho do caminho"
          description="Quantos pontos de contato diferentes cada usuário teve."
        />
        <LengthBars
          lengths={lengths}
          value={purchaseRate}
          format={(v) => formatPct(v, 2)}
          title="Taxa de compra por tamanho do caminho"
          description="Compradores / usuários para cada tamanho de caminho."
        />
      </div>

      <section className="card">
        <header className="with-controls">
          <div>
            <h2>Sequência entre pontos de contato</h2>
            <p>
              {transMode === "pct"
                ? "Leia por linha: dos compradores que passaram pelo ponto da linha e seguiram para outro, qual foi o próximo."
                : "Compradores cujo caminho tem a passagem direta da linha para a coluna."}
            </p>
          </div>
          <div className="segmented" role="group" aria-label="Métrica da sequência">
            <button type="button" aria-pressed={transMode === "pct"} onClick={() => setTransMode("pct")}>
              % da linha
            </button>
            <button type="button" aria-pressed={transMode === "abs"} onClick={() => setTransMode("abs")}>
              Compradores
            </button>
          </div>
        </header>
        <Heatmap
          exportAs={transMode === "pct" ? "Sequência entre pontos de contato (% da linha)" : "Sequência entre pontos de contato (compradores)"}
          labels={touchpointNames}
          value={(i, j) => (transMode === "pct" ? (rowTotals[i] ? transitions[i][j] / rowTotals[i] : 0) : transitions[i][j])}
          intensity={(i, j) => (transMode === "pct" ? (rowTotals[i] ? transitions[i][j] / rowTotals[i] / maxPct : 0) : transitions[i][j] / maxAbs)}
          format={(v) => (transMode === "pct" ? formatPct(v, 0) : formatCompact(v))}
          diagonal={() => "-"}
          tooltip={(i, j) => (
            <>
              <strong>
                {touchpointNames[i]} → {touchpointNames[j]}
              </strong>
              <div>{formatInt(transitions[i][j])} compradores</div>
              {rowTotals[i] > 0 && <div>{formatPct(transitions[i][j] / rowTotals[i])} das saídas de {touchpointNames[i]}</div>}
            </>
          )}
        />
      </section>

      <TouchpointTable touchpoints={touchpoints} total={total} matchedSet={matchedSet} />
      <PathGroupsTable data={data} seg={seg} matchedSet={matchedSet} segmentLabel={segmentLabel} mode="paths" />
    </>
  );
}

function PositionBarsShare({ touchpoints, total }: { touchpoints: TouchpointStat[]; total: Metrics }) {
  return (
    <BarList
      exportAs="Pontos de contato nos caminhos com compra"
      valueName="Compradores"
      items={[...touchpoints]
        .sort((a, b) => b.with.buyers - a.with.buyers)
        .map((t) => ({
          label: t.name,
          valueLabel: formatPct(t.with.buyers / total.buyers),
          segments: [{ key: "v", value: t.with.buyers, series: 1 }],
          tooltip: (
            <>
              <strong>{t.name}</strong>
              <div>{formatInt(t.with.buyers)} compradores passaram por este ponto</div>
              <div>{formatPct(t.with.buyers / total.buyers)} dos compradores</div>
            </>
          ),
        }))}
    />
  );
}

function TouchpointTable({ touchpoints, total, matchedSet }: { touchpoints: TouchpointStat[]; total: Metrics; matchedSet: Set<string> }) {
  const lift = (t: TouchpointStat) => purchaseRate(t.with) / purchaseRate(t.without);
  const cols: Column<TouchpointStat>[] = [
    { key: "name", label: "Ponto de contato", value: (t) => t.name, render: (t) => <span className={`touch-chip small ${matchedSet.has(t.name) ? "in" : ""}`}>{t.name}</span> },
    { key: "users", label: "Usuários", numeric: true, value: (t) => t.with.users, render: (t) => formatInt(t.with.users) },
    { key: "usersShare", label: "% usuários", numeric: true, value: (t) => t.with.users / total.users, render: (t) => formatShare(t.with.users / total.users) },
    { key: "buyers", label: "Compradores", numeric: true, value: (t) => t.with.buyers, render: (t) => formatInt(t.with.buyers) },
    { key: "rateWith", label: "Taxa com", numeric: true, value: (t) => purchaseRate(t.with), render: (t) => formatPct(purchaseRate(t.with), 2) },
    { key: "rateWithout", label: "Taxa sem", numeric: true, value: (t) => purchaseRate(t.without), render: (t) => formatPct(purchaseRate(t.without), 2) },
    { key: "lift", label: "Lift", numeric: true, value: lift, render: (t) => formatMultiple(lift(t), "x") },
    { key: "roas", label: "ROAS dos caminhos", numeric: true, value: (t) => roas(t.with), render: (t) => formatMultiple(roas(t.with)) },
    { key: "first", label: "1º toque", numeric: true, value: (t) => t.firstBuyers / total.buyers, render: (t) => formatPct(t.firstBuyers / total.buyers) },
    { key: "last", label: "Último toque", numeric: true, value: (t) => t.lastBuyers / total.buyers, render: (t) => formatPct(t.lastBuyers / total.buyers) },
    {
      key: "pos",
      label: "Posição média",
      numeric: true,
      value: (t) => t.avgPosition,
      render: (t) => (Number.isFinite(t.avgPosition) ? t.avgPosition.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "-"),
    },
  ];
  return (
    <section className="card">
      <header>
        <h2>Pontos de contato</h2>
        <p>
          Métricas dos caminhos que passam por cada ponto. Custo e vendas são do caminho inteiro (o AMC não separa por ponto), então o ROAS aqui
          é dos caminhos que incluem o ponto. Posição média considera só caminhos com compra (1 = primeiro toque).
        </p>
      </header>
      <DataTable rows={touchpoints} columns={cols} searchText={(t) => t.name} initialSort="users" exportName="pontos-de-contato" />
    </section>
  );
}

const SEGMENT_FILTERS: (SegmentId | "all")[] = ["all", "fullFunnel", "only", "none", "mixed"];

function PathGroupsTable({
  data,
  seg,
  matchedSet,
  segmentLabel,
  mode,
}: {
  data: ParsedPaths;
  seg: ReturnType<typeof analyzeSegments>;
  matchedSet: Set<string>;
  segmentLabel: Record<SegmentId, string>;
  mode: "paths" | "ntb";
}) {
  const [ordered, setOrdered] = useState(false);
  const [segFilter, setSegFilter] = useState<SegmentId | "all">("all");
  const groups = useMemo(() => groupPaths(data.rows, seg.rowSegment, ordered), [data.rows, seg.rowSegment, ordered]);
  const visible = segFilter === "all" ? groups : groups.filter((g) => g.segment === segFilter);
  const total = seg.segments[0].metrics;

  const base: Column<GroupStat>[] = [
    {
      key: "path",
      label: ordered ? "Caminho" : "Combinação de pontos",
      value: (g) => g.key,
      render: (g) => <PathChips steps={g.steps} matched={matchedSet} ordered={ordered} />,
    },
    { key: "segment", label: "Segmento", value: (g) => segmentLabel[g.segment], render: (g) => segmentLabel[g.segment] },
    { key: "n", label: "Pontos", numeric: true, value: (g) => g.steps.length, render: (g) => g.steps.length },
    { key: "users", label: "Usuários", numeric: true, value: (g) => g.metrics.users, render: (g) => formatInt(g.metrics.users) },
  ];
  const pathCols: Column<GroupStat>[] = [
    { key: "buyers", label: "Compradores", numeric: true, value: (g) => g.metrics.buyers, render: (g) => formatInt(g.metrics.buyers) },
    { key: "rate", label: "Taxa de compra", numeric: true, value: (g) => purchaseRate(g.metrics), render: (g) => formatPct(purchaseRate(g.metrics), 2) },
    { key: "sales", label: "Vendas", numeric: true, value: (g) => g.metrics.sales, render: (g) => formatMoneyFull(g.metrics.sales) },
    { key: "salesShare", label: "% vendas", numeric: true, value: (g) => g.metrics.sales / total.sales, render: (g) => formatShare(g.metrics.sales / total.sales) },
    { key: "roas", label: "ROAS", numeric: true, value: (g) => roas(g.metrics), render: (g) => formatMultiple(roas(g.metrics)) },
    { key: "ntb", label: "% NTB compras", numeric: true, value: (g) => ntbShare(g.metrics), render: (g) => formatPct(ntbShare(g.metrics)) },
  ];
  const ntbCols: Column<GroupStat>[] = [
    { key: "ntbBuyers", label: "Compradores NTB", numeric: true, value: (g) => g.metrics.ntbBuyers, render: (g) => formatInt(g.metrics.ntbBuyers) },
    { key: "ntbOfAll", label: "% dos NTB", numeric: true, value: (g) => g.metrics.ntbBuyers / total.ntbBuyers, render: (g) => formatShare(g.metrics.ntbBuyers / total.ntbBuyers) },
    { key: "ntbShare", label: "% NTB compras", numeric: true, value: (g) => ntbShare(g.metrics), render: (g) => formatPct(ntbShare(g.metrics)) },
    { key: "ntbRate", label: "Taxa aquisição NTB", numeric: true, value: (g) => ntbRate(g.metrics), render: (g) => formatPct(ntbRate(g.metrics), 2) },
    { key: "ntbSales", label: "Vendas NTB", numeric: true, value: (g) => g.metrics.ntbSales, render: (g) => formatMoneyFull(g.metrics.ntbSales) },
    { key: "costNtb", label: "Custo por NTB", numeric: true, value: (g) => costPerNtb(g.metrics), render: (g) => formatMoneyFull(costPerNtb(g.metrics)) },
  ];

  return (
    <section className="card">
      <header className="with-controls">
        <div>
          <h2>{mode === "paths" ? "Todas as permutações" : "Caminhos que mais adquirem NTB"}</h2>
          <p>
            {ordered
              ? "Cada linha é um caminho exato, na ordem em que os pontos aconteceram."
              : "Cada linha junta os caminhos com o mesmo conjunto de pontos de contato, em qualquer ordem."}{" "}
            Pontos do grupo do filtro ficam destacados.
          </p>
        </div>
        <div className="controls">
          <select value={segFilter} onChange={(e) => setSegFilter(e.target.value as SegmentId | "all")} aria-label="Segmento">
            {SEGMENT_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "Todos os segmentos" : segmentLabel[s]}
              </option>
            ))}
          </select>
          <div className="segmented" role="group" aria-label="Agrupamento">
            <button type="button" aria-pressed={!ordered} onClick={() => setOrdered(false)}>
              Ignorar ordem
            </button>
            <button type="button" aria-pressed={ordered} onClick={() => setOrdered(true)}>
              Caminho exato
            </button>
          </div>
        </div>
      </header>
      <DataTable
        key={`${mode}-${ordered}`}
        rows={visible}
        columns={[...base, ...(mode === "paths" ? pathCols : ntbCols)]}
        searchText={(g) => `${g.key} ${segmentLabel[g.segment]}`}
        initialSort={mode === "paths" ? "buyers" : "ntbBuyers"}
        exportName={mode === "paths" ? (ordered ? "caminhos" : "combinacoes") : ordered ? "caminhos-ntb" : "combinacoes-ntb"}
      />
    </section>
  );
}

function NtbTab({ data, seg, touchpoints, lengths, total, groupName, summary, matchedSet, segmentLabel }: TabProps) {
  const insights = useMemo(() => buildNtbInsights(seg, touchpoints, groupName), [seg, touchpoints, groupName]);

  if (!data.hasNtb) {
    return (
      <section className="card">
        <p className="muted">O CSV não tem as colunas de NTB (ntb_users_that_purchased, ntb_purchases, ntb_sales_amount).</p>
      </section>
    );
  }

  return (
    <>
      <InsightCards insights={insights} />
      <StatTiles
        stats={[
          { label: "Compradores NTB", value: formatCompact(total.ntbBuyers), note: `${formatPct(ntbBuyerShare(total))} dos compradores` },
          { label: "Compras NTB", value: formatCompact(total.ntbPurchases), note: `${formatPct(ntbShare(total))} das compras` },
          { label: "Vendas NTB", value: formatMoney(total.ntbSales), note: `${formatPct(ntbSalesShare(total))} das vendas` },
          { label: "Taxa de aquisição NTB", value: formatPct(ntbRate(total), 2), note: "compradores NTB / usuários" },
          { label: "Custo por comprador NTB", value: formatMoney(costPerNtb(total)) },
        ]}
      />

      <section className="card">
        <header>
          <h2>NTB por segmento do filtro</h2>
          <p>Mesmos segmentos da aba de caminhos, com as métricas de aquisição de novos clientes.</p>
        </header>
        <SegmentTable segments={seg.segments} columns={NTB_COLUMNS} filterSummary={summary} exportName={`path-to-conversion-segmentos-${groupName}`} />
      </section>

      <SegmentCompare segments={seg.segments} columns={NTB_COLUMNS.filter((c) => c.key !== "users")} title="Comparar segmentos (NTB)" />

      <div className="grid-2">
        <TouchCompare
          touchpoints={touchpoints}
          metric={ntbRate}
          metricLabel="Aquisição NTB"
          title="Aquisição NTB com e sem cada ponto"
          description="Compradores NTB por usuário, com e sem o ponto no caminho. Ordenado pelo lift."
        />
        <section className="card">
          <header>
            <h2>% NTB nas compras por ponto de contato</h2>
            <p>Dos caminhos que passam pelo ponto, quanto das compras veio de clientes novos. Média geral: {formatPct(ntbShare(total))}.</p>
          </header>
          <ShareBars touchpoints={touchpoints} />
        </section>
      </div>

      <div className="grid-2">
        <PositionBars
          touchpoints={touchpoints}
          pick={(t) => t.firstNtbBuyers}
          total={total.ntbBuyers}
          title="Primeiro toque dos compradores NTB"
          description="Por onde começam os caminhos de quem comprou a marca pela primeira vez."
        />
        <PositionBars
          touchpoints={touchpoints}
          pick={(t) => t.lastNtbBuyers}
          total={total.ntbBuyers}
          title="Último toque dos compradores NTB"
          description="O último ponto de contato antes da primeira compra."
        />
      </div>

      <div className="grid-2">
        <LengthBars
          lengths={lengths}
          value={ntbShare}
          format={(v) => formatPct(v)}
          title="% NTB nas compras por tamanho do caminho"
          description="Caminhos mais longos trazem mais ou menos clientes novos?"
        />
        <LengthBars
          lengths={lengths}
          value={ntbRate}
          format={(v) => formatPct(v, 2)}
          title="Aquisição NTB por tamanho do caminho"
          description="Compradores NTB / usuários para cada tamanho de caminho."
        />
      </div>

      <PathGroupsTable data={data} seg={seg} matchedSet={matchedSet} segmentLabel={segmentLabel} mode="ntb" />
    </>
  );
}

function ShareBars({ touchpoints }: { touchpoints: TouchpointStat[] }) {
  return (
    <BarList
      exportAs="% NTB nas compras por ponto de contato"
      valueName="% NTB nas compras"
      items={[...touchpoints]
        .filter((t) => t.with.purchases > 0)
        .sort((a, b) => ntbShare(b.with) - ntbShare(a.with))
        .map((t) => ({
          label: t.name,
          valueLabel: formatPct(ntbShare(t.with)),
          segments: [{ key: "v", value: ntbShare(t.with), series: 1 }],
          tooltip: (
            <>
              <strong>{t.name}</strong>
              <div>
                {formatInt(t.with.ntbPurchases)} de {formatInt(t.with.purchases)} compras são NTB
              </div>
            </>
          ),
        }))}
    />
  );
}
