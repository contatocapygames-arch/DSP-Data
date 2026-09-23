import { useMemo, useState } from "react";
import { BarList } from "../../components/charts/BarList";
import { Heatmap } from "../../components/charts/Heatmap";
import { UpSet } from "../../components/charts/UpSet";
import { DataTable, type Column } from "../../components/DataTable";
import { StatTiles } from "../../components/StatTiles";
import { formatCompact, formatInt, formatPct } from "../../lib/format";
import { VennSection } from "./VennSection";
import { analyzeOverlap, buildInsights, type CampaignStat, type ComboStat, type OverlapRow } from "./analyze";

const MAX_MATRIX = 15;

type MatrixMode = "pct" | "users";

export function AdvertiserOverlapDashboard({ rows }: { rows: OverlapRow[] }) {
  const a = useMemo(() => analyzeOverlap(rows), [rows]);
  const insights = useMemo(() => buildInsights(a), [a]);
  const [mode, setMode] = useState<MatrixMode>("pct");
  const [topCombos, setTopCombos] = useState(15);
  const [onlyShared, setOnlyShared] = useState(false);

  const matrixN = Math.min(MAX_MATRIX, a.advertisers.length);
  const matrixAdv = a.advertisers.slice(0, matrixN);
  // Escala da cor vai de 0 ao maior valor fora da diagonal, para usar a faixa inteira do tom.
  const offDiag = (f: (i: number, j: number) => number) =>
    Math.max(1e-9, ...matrixAdv.flatMap((_, i) => matrixAdv.map((_, j) => (i === j ? 0 : f(i, j)))));
  const pctOf = (i: number, j: number) => a.pair[i][j] / matrixAdv[i].reach;
  const maxPct = offDiag(pctOf);
  const maxUsers = offDiag((i, j) => a.pair[i][j]);

  const upsetCombos = (onlyShared ? a.combos.filter((c) => c.advertisers.length > 1) : a.combos).slice(0, topCombos);
  const upsetSets = a.advertisers.map((x) => x.name).filter((n) => upsetCombos.some((c) => c.advertisers.includes(n)));

  const hasCampaigns = a.campaigns.length > 0;
  const campaignsWithIds = a.campaigns.some((c) => c.id);

  return (
    <div className="dashboard">
      <section className="insights">
        {insights.map((i) => (
          <article key={i.title} className="insight">
            <h3>{i.title}</h3>
            <p>{i.body}</p>
          </article>
        ))}
      </section>

      <StatTiles
        stats={[
          { label: "Usuários únicos", value: formatCompact(a.totalUsers), note: formatInt(a.totalUsers) },
          { label: "Anunciantes", value: formatInt(a.advertisers.length) },
          ...(hasCampaigns ? [{ label: "Campanhas", value: formatInt(a.campaigns.length) }] : []),
          {
            label: "Expostos a 2+ anunciantes",
            value: formatPct(a.multiAdvertiserUsers / a.totalUsers),
            note: `${formatInt(a.multiAdvertiserUsers)} usuários`,
          },
          { label: "Combinações de anunciantes", value: formatInt(a.combos.length) },
        ]}
      />

      <div className="grid-2">
        <section className="card">
          <header>
            <h2>Alcance por anunciante</h2>
            <p>Usuários únicos impactados. Exclusivo = não viu nenhum outro anunciante do arquivo.</p>
          </header>
          <BarList
            legend={[
              { label: "Exclusivo", series: 1 },
              { label: "Compartilhado", series: 2 },
            ]}
            items={a.advertisers.map((x) => ({
              label: x.name,
              valueLabel: formatCompact(x.reach),
              segments: [
                { key: "exclusive", value: x.exclusive, series: 1 },
                { key: "shared", value: x.shared, series: 2 },
              ],
              tooltip: (
                <>
                  <strong>{x.name}</strong>
                  <div>Alcance: {formatInt(x.reach)}</div>
                  <div>
                    Exclusivo: {formatInt(x.exclusive)} ({formatPct(x.exclusive / x.reach)})
                  </div>
                  <div>
                    Compartilhado: {formatInt(x.shared)} ({formatPct(x.shared / x.reach)})
                  </div>
                </>
              ),
            }))}
          />
        </section>

        <section className="card">
          <header>
            <h2>Anunciantes vistos por usuário</h2>
            <p>Quantos usuários foram impactados por 1, 2, 3… anunciantes diferentes.</p>
          </header>
          <BarList
            items={a.byAdvertiserCount.map((b) => ({
              label: `${b.count} anunciante${b.count > 1 ? "s" : ""}`,
              valueLabel: formatPct(b.users / a.totalUsers),
              segments: [{ key: "users", value: b.users, series: 1 }],
              tooltip: (
                <>
                  <strong>
                    {b.count} anunciante{b.count > 1 ? "s" : ""}
                  </strong>
                  <div>{formatInt(b.users)} usuários</div>
                  <div>{formatPct(b.users / a.totalUsers)} do total</div>
                </>
              ),
            }))}
          />
        </section>
      </div>

      {a.advertisers.length > 1 && (
        <section className="card">
          <header className="with-controls">
            <div>
              <h2>Sobreposição entre pares de anunciantes</h2>
              <p>
                {mode === "pct"
                  ? "Leia por linha: % do alcance do anunciante da linha que também viu o anunciante da coluna."
                  : "Usuários únicos expostos aos dois anunciantes."}{" "}
                A diagonal mostra o alcance total.
                {a.advertisers.length > MAX_MATRIX && ` Mostrando os ${MAX_MATRIX} maiores por alcance.`}
              </p>
            </div>
            <div className="segmented" role="group" aria-label="Métrica da matriz">
              <button type="button" aria-pressed={mode === "pct"} onClick={() => setMode("pct")}>
                % da linha
              </button>
              <button type="button" aria-pressed={mode === "users"} onClick={() => setMode("users")}>
                Usuários
              </button>
            </div>
          </header>
          <Heatmap
            labels={matrixAdv.map((x) => x.name)}
            value={(i, j) => (mode === "pct" ? pctOf(i, j) : a.pair[i][j])}
            intensity={(i, j) => (mode === "pct" ? pctOf(i, j) / maxPct : a.pair[i][j] / maxUsers)}
            format={(v) => (mode === "pct" ? formatPct(v, 0) : formatCompact(v))}
            diagonal={(i) => formatCompact(matrixAdv[i].reach)}
            tooltip={(i, j) => {
              const A = matrixAdv[i];
              const B = matrixAdv[j];
              if (i === j)
                return (
                  <>
                    <strong>{A.name}</strong>
                    <div>Alcance: {formatInt(A.reach)}</div>
                  </>
                );
              const both = a.pair[i][j];
              return (
                <>
                  <strong>
                    {A.name} ∩ {B.name}
                  </strong>
                  <div>{formatInt(both)} usuários em comum</div>
                  <div>
                    {formatPct(both / A.reach)} do alcance de {A.name}
                  </div>
                  <div>
                    {formatPct(both / B.reach)} do alcance de {B.name}
                  </div>
                  <div>Índice de Jaccard: {formatPct(both / (A.reach + B.reach - both))}</div>
                </>
              );
            }}
          />
        </section>
      )}

      {a.advertisers.length > 1 && <VennSection advertisers={a.advertisers} combos={a.combos} />}

      <section className="card">
        <header className="with-controls">
          <div>
            <h2>Combinações exatas de anunciantes</h2>
            <p>Cada coluna é um grupo de usuários que viu exatamente os anunciantes marcados, e nenhum outro.</p>
          </div>
          <div className="controls">
            <label className="check">
              <input type="checkbox" checked={onlyShared} onChange={(e) => setOnlyShared(e.target.checked)} />
              Só combinações com 2+
            </label>
            <select value={topCombos} onChange={(e) => setTopCombos(Number(e.target.value))} aria-label="Quantidade de combinações">
              {[10, 15, 25, 40].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </div>
        </header>
        {upsetCombos.length > 0 ? (
          <UpSet
            sets={upsetSets}
            combos={upsetCombos.map((c) => ({ members: c.advertisers, value: c.users }))}
            tooltip={(k) => {
              const c = upsetCombos[k];
              return (
                <>
                  <strong>{c.advertisers.join(" + ")}</strong>
                  <div>{formatInt(c.users)} usuários</div>
                  <div>{formatPct(c.users / a.totalUsers)} do total</div>
                </>
              );
            }}
          />
        ) : (
          <p className="muted">Nenhuma combinação com 2 ou mais anunciantes.</p>
        )}
      </section>

      <section className="card">
        <header>
          <h2>Tabela de combinações</h2>
        </header>
        <DataTable<ComboStat>
          rows={a.combos}
          initialSort="users"
          exportName="combinacoes-anunciantes"
          searchText={(c) => c.advertisers.join(" ")}
          columns={[
            { key: "combo", label: "Anunciantes", value: (c) => c.advertisers.join(" + "), render: (c) => c.advertisers.join(" + ") },
            { key: "n", label: "Qtd.", numeric: true, value: (c) => c.advertisers.length, render: (c) => c.advertisers.length },
            { key: "users", label: "Usuários", numeric: true, value: (c) => c.users, render: (c) => formatInt(c.users) },
            { key: "share", label: "% do total", numeric: true, value: (c) => c.users / a.totalUsers, render: (c) => formatPct(c.users / a.totalUsers) },
          ]}
        />
      </section>

      {hasCampaigns && (
        <section className="card">
          <header>
            <h2>Campanhas</h2>
            <p>
              Alcance de cada campanha, quanto dele só viu essa campanha e quanto também foi impactado por outro anunciante. O anunciante é
              inferido das linhas com um único anunciante.
            </p>
          </header>
          <DataTable<CampaignStat>
            rows={a.campaigns}
            initialSort="reach"
            exportName="campanhas-overlap"
            searchText={(c) => `${c.name} ${c.id ?? ""} ${c.advertiser ?? ""}`}
            columns={
              [
                { key: "name", label: "Campanha", value: (c: CampaignStat) => c.name, render: (c: CampaignStat) => c.name },
                campaignsWithIds && { key: "id", label: "ID", value: (c: CampaignStat) => c.id ?? "", render: (c: CampaignStat) => c.id ?? "-" },
                { key: "adv", label: "Anunciante", value: (c: CampaignStat) => c.advertiser ?? "", render: (c: CampaignStat) => c.advertiser ?? "-" },
                { key: "reach", label: "Alcance", numeric: true, value: (c: CampaignStat) => c.reach, render: (c: CampaignStat) => formatInt(c.reach) },
                {
                  key: "excl",
                  label: "% só esta campanha",
                  numeric: true,
                  value: (c: CampaignStat) => c.exclusive / c.reach,
                  render: (c: CampaignStat) => formatPct(c.exclusive / c.reach),
                },
                {
                  key: "cross",
                  label: "% viu outro anunciante",
                  numeric: true,
                  value: (c: CampaignStat) => c.crossAdvertiser / c.reach,
                  render: (c: CampaignStat) => formatPct(c.crossAdvertiser / c.reach),
                },
              ].filter(Boolean) as Column<CampaignStat>[]
            }
          />
        </section>
      )}

      <p className="footnote">
        Como os números são calculados: cada usuário aparece em exatamente uma linha do resultado (a combinação completa do que ele viu), então
        somar linhas dá usuários únicos sem duplicar. O AMC omite linhas abaixo do limite de agregação, portanto os totais podem ficar um pouco
        abaixo do alcance real e combinações raras podem não aparecer.
      </p>
    </div>
  );
}
