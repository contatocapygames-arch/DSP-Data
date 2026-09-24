import { useMemo, useState } from "react";
import { Venn } from "../../components/charts/Venn";
import { StatTiles } from "../../components/StatTiles";
import { formatCompact, formatInt, formatPct } from "../../lib/format";
import { vennRegions, type AdvertiserStat, type ComboStat } from "./analyze";

const MAX_SELECTED = 3;

interface Props {
  advertisers: AdvertiserStat[];
  combos: ComboStat[];
}

/** Nome legível da região: "Só A", "A ∩ B", "A ∩ B (sem C)". */
function regionName(mask: number, sets: string[]): string {
  const inside = sets.filter((_, i) => mask & (1 << i));
  const outside = sets.filter((_, i) => !(mask & (1 << i)));
  if (inside.length === 1) return `Só ${inside[0]}`;
  const base = inside.join(" ∩ ");
  return outside.length > 0 ? `${base} (sem ${outside.join(", ")})` : base;
}

export function VennSection({ advertisers, combos }: Props) {
  // Três posições fixas: cada anunciante mantém sua cor mesmo quando outro sai da seleção.
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    Array.from({ length: MAX_SELECTED }, (_, i) => advertisers[i]?.name ?? null),
  );

  const active = slots.map((name, i) => ({ name, slot: i + 1 })).filter((s): s is { name: string; slot: number } => s.name !== null);
  const sets = active.map((s) => s.name);
  const setsKey = sets.join("\u0000");
  const regions = useMemo(() => vennRegions(combos, setsKey.split("\u0000")), [combos, setsKey]);

  const toggle = (name: string) =>
    setSlots((cur) => {
      const at = cur.indexOf(name);
      if (at >= 0) return cur.map((s, i) => (i === at ? null : s));
      const free = cur.indexOf(null);
      return free < 0 ? cur : cur.map((s, i) => (i === free ? name : s));
    });

  const union = [...regions.values()].reduce((s, v) => s + v, 0);
  const allMask = (1 << sets.length) - 1;
  const inAll = regions.get(allMask) ?? 0;
  const rows = [...regions.entries()].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
  const full = slots.every((s) => s !== null);

  const tooltip = (mask: number) => {
    const users = regions.get(mask) ?? 0;
    return (
      <>
        <strong>{regionName(mask, sets)}</strong>
        <div>{formatInt(users)} usuários</div>
        <div>{formatPct(users / union)} da união</div>
      </>
    );
  };

  return (
    <section className="card">
      <header>
        <h2>Diagrama de Venn</h2>
        <p>
          Escolha até {MAX_SELECTED} anunciantes para comparar. As regiões consideram só os selecionados: "Só A" é quem viu A e nenhum dos
          outros selecionados. Passe o mouse no diagrama para ver cada região.
        </p>
      </header>

      <div className="chip-picker" role="group" aria-label="Anunciantes do Venn">
        {advertisers.map((adv) => {
          const slot = slots.indexOf(adv.name);
          const selected = slot >= 0;
          return (
            <button
              key={adv.name}
              type="button"
              className="chip"
              aria-pressed={selected}
              disabled={!selected && full}
              onClick={() => toggle(adv.name)}
              title={!selected && full ? `Desmarque um anunciante para escolher outro (máx. ${MAX_SELECTED})` : undefined}
            >
              {selected && <span className={`chip-dot v${slot + 1}`} aria-hidden />}
              {adv.name}
              <span className="chip-meta">{formatCompact(adv.reach)}</span>
            </button>
          );
        })}
      </div>

      {sets.length < 2 ? (
        <p className="muted venn-empty">Selecione pelo menos 2 anunciantes.</p>
      ) : (
        <div className="venn-layout">
          <div className="venn-chart">
            <Venn
              sets={sets}
              slots={active.map((s) => s.slot)}
              regions={regions}
              tooltip={tooltip}
              regionLabel={(mask) => regionName(mask, sets)}
              exportAs={`Venn: ${sets.join(", ")}`}
            />
            {sets.length === 3 && (
              <p className="hint">Com 3 anunciantes o tamanho das áreas é aproximado; os números exatos estão na tabela.</p>
            )}
          </div>
          <div className="venn-side">
            <StatTiles
              stats={[
                { label: "União", value: formatCompact(union), note: formatInt(union) },
                {
                  label: sets.length === 2 ? "Em comum" : "Em comum aos 3",
                  value: formatPct(inAll / union),
                  note: `${formatInt(inAll)} usuários`,
                },
              ]}
            />
            <table className="venn-table">
              <thead>
                <tr>
                  <th>Região</th>
                  <th className="num">Usuários</th>
                  <th className="num">% da união</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([mask, users]) => (
                  <tr key={mask}>
                    <td>
                      <span className="region-dots" aria-hidden>
                        {active.map((s, i) => (
                          <span key={s.name} className={`region-dot ${mask & (1 << i) ? `v${s.slot}` : "off"}`} />
                        ))}
                      </span>
                      {regionName(mask, sets)}
                    </td>
                    <td className="num">{formatInt(users)}</td>
                    <td className="num">{formatPct(users / union)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
