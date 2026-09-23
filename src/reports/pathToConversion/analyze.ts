import { addMetrics, emptyMetrics, type Metrics, type PathRow } from "./parse";

export type MatchOp = "contains" | "notContains" | "equals" | "startsWith";

export interface FilterRule {
  op: MatchOp;
  value: string;
}

/** Filtro de texto que separa os pontos de contato em "do grupo" (ex.: DSP) e "outros". */
export interface TouchFilter {
  rules: FilterRule[];
  /** Como juntar as regras: basta uma (any) ou todas (all). */
  join: "any" | "all";
  /** Nome do grupo nas tabelas; vazio usa o texto da primeira regra. */
  name: string;
}

export const OP_LABEL: Record<MatchOp, string> = {
  contains: "Contém",
  notContains: "Não contém",
  equals: "É igual a",
  startsWith: "Começa com",
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function ruleMatches(rule: FilterRule, label: string): boolean {
  const l = norm(label);
  const v = norm(rule.value);
  switch (rule.op) {
    case "contains":
      return l.includes(v);
    case "notContains":
      return !l.includes(v);
    case "equals":
      return l === v;
    case "startsWith":
      return l.startsWith(v);
  }
}

/** Regras vazias são ignoradas; sem nenhuma regra válida nada casa. Ignora caixa e acentos. */
export function matchesFilter(filter: TouchFilter, label: string): boolean {
  const rules = filter.rules.filter((r) => r.value.trim() !== "");
  if (rules.length === 0) return false;
  return filter.join === "all" ? rules.every((r) => ruleMatches(r, label)) : rules.some((r) => ruleMatches(r, label));
}

export function filterName(filter: TouchFilter): string {
  if (filter.name.trim()) return filter.name.trim();
  const first = filter.rules.find((r) => r.value.trim());
  return first ? first.value.trim() : "Grupo";
}

export function describeFilter(filter: TouchFilter): string {
  const rules = filter.rules.filter((r) => r.value.trim());
  return rules.map((r) => `${OP_LABEL[r.op]} "${r.value.trim()}"`).join(filter.join === "all" ? " E " : " OU ");
}

export function allTouchpoints(rows: PathRow[]): string[] {
  const users = new Map<string, number>();
  for (const r of rows) for (const s of new Set(r.steps)) users.set(s, (users.get(s) ?? 0) + r.metrics.users);
  return [...users.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([s]) => s);
}

export const totals = (rows: PathRow[]) => rows.reduce((m, r) => addMetrics(m, r.metrics), emptyMetrics());

export type SegmentId = "total" | "fullFunnel" | "only" | "none" | "othersAll" | "mixed";

export interface Segment {
  id: SegmentId;
  label: string;
  /** Rótulo curto para colunas de tabela e seletores. */
  short: string;
  description: string;
  metrics: Metrics;
  /** Linha que é subconjunto de outra (não soma no total). */
  subsetOf?: SegmentId;
}

export interface SegmentAnalysis {
  matched: string[];
  others: string[];
  segments: Segment[];
  /** Segmento de cada caminho, na mesma ordem das linhas. */
  rowSegment: SegmentId[];
}

/**
 * Classifica cada caminho em relação ao grupo do filtro. Full funnel, Só grupo, Sem grupo e
 * "grupo + outros" são uma partição do total; "Todos os outros sem grupo" é um recorte de "Sem grupo".
 */
export function analyzeSegments(rows: PathRow[], filter: TouchFilter): SegmentAnalysis {
  const all = allTouchpoints(rows);
  const matched = all.filter((t) => matchesFilter(filter, t));
  const matchedSet = new Set(matched);
  const others = all.filter((t) => !matchedSet.has(t));
  const g = filterName(filter);

  const seg = (id: SegmentId, label: string, short: string, description: string, subsetOf?: SegmentId): Segment => ({
    id,
    label,
    short,
    description,
    metrics: emptyMetrics(),
    subsetOf,
  });
  const segments: Record<SegmentId, Segment> = {
    total: seg("total", "Todos os caminhos", "Todos", "Base: todos os caminhos do arquivo."),
    fullFunnel: seg("fullFunnel", "Full funnel (todos os pontos de contato)", "Full funnel", `Passou por todos os ${all.length} pontos de contato do arquivo.`),
    only: seg("only", `Só ${g}`, `Só ${g}`, `Todos os pontos do caminho são ${g}.`),
    none: seg("none", `Sem ${g}`, `Sem ${g}`, `Nenhum ponto do caminho é ${g}.`),
    othersAll: seg(
      "othersAll",
      `Todos os outros pontos, sem ${g}`,
      `Outros pontos sem ${g}`,
      `Passou por todos os pontos que não são ${g} (${others.join(", ")}) e por nenhum ${g}.`,
      "none",
    ),
    mixed: seg("mixed", `${g} + outros pontos (demais permutações)`, `${g} + outros`, `Mistura ${g} com outros pontos, sem ser full funnel.`),
  };

  const rowSegment: SegmentId[] = [];
  for (const r of rows) {
    const set = new Set(r.steps);
    const nMatched = [...set].filter((s) => matchedSet.has(s)).length;
    let id: SegmentId;
    if (all.every((t) => set.has(t))) id = "fullFunnel";
    else if (nMatched === set.size) id = "only";
    else if (nMatched === 0) id = "none";
    else id = "mixed";
    rowSegment.push(id);
    addMetrics(segments.total.metrics, r.metrics);
    addMetrics(segments[id].metrics, r.metrics);
    if (id === "none" && others.length > 0 && others.every((t) => set.has(t))) addMetrics(segments.othersAll.metrics, r.metrics);
  }

  return {
    matched,
    others,
    segments: [segments.total, segments.fullFunnel, segments.only, segments.none, segments.othersAll, segments.mixed],
    rowSegment,
  };
}

export interface GroupStat {
  key: string;
  /** Pontos do grupo: conjunto ordenado (combinação) ou caminho na ordem. */
  steps: string[];
  segment: SegmentId;
  metrics: Metrics;
}

/** Agrupa caminhos pelo conjunto de pontos (ignorando ordem) ou pelo caminho exato. */
export function groupPaths(rows: PathRow[], rowSegment: SegmentId[], ordered: boolean): GroupStat[] {
  const map = new Map<string, GroupStat>();
  rows.forEach((r, i) => {
    const steps = ordered ? r.steps : [...new Set(r.steps)].sort((a, b) => a.localeCompare(b));
    const key = steps.join(" › ");
    let g = map.get(key);
    if (!g) {
      g = { key, steps, segment: rowSegment[i], metrics: emptyMetrics() };
      map.set(key, g);
    }
    addMetrics(g.metrics, r.metrics);
  });
  return [...map.values()].sort((a, b) => b.metrics.buyers - a.metrics.buyers || b.metrics.users - a.metrics.users);
}

export interface TouchpointStat {
  name: string;
  /** Caminhos que passam pelo ponto. */
  with: Metrics;
  /** Caminhos que não passam pelo ponto. */
  without: Metrics;
  /** Compradores cujo caminho começa / termina neste ponto. */
  firstBuyers: number;
  lastBuyers: number;
  firstNtbBuyers: number;
  lastNtbBuyers: number;
  /** Posição média (1 = primeiro) nos caminhos com compra, ponderada por compradores. */
  avgPosition: number;
}

export function analyzeTouchpoints(rows: PathRow[]): TouchpointStat[] {
  const total = totals(rows);
  const stats = new Map<string, TouchpointStat & { posSum: number; posW: number }>();
  const get = (name: string) => {
    let s = stats.get(name);
    if (!s) {
      s = {
        name,
        with: emptyMetrics(),
        without: emptyMetrics(),
        firstBuyers: 0,
        lastBuyers: 0,
        firstNtbBuyers: 0,
        lastNtbBuyers: 0,
        avgPosition: NaN,
        posSum: 0,
        posW: 0,
      };
      stats.set(name, s);
    }
    return s;
  };

  for (const r of rows) {
    const m = r.metrics;
    new Set(r.steps).forEach((s) => addMetrics(get(s).with, m));
    const first = get(r.steps[0]);
    const last = get(r.steps[r.steps.length - 1]);
    first.firstBuyers += m.buyers;
    first.firstNtbBuyers += m.ntbBuyers;
    last.lastBuyers += m.buyers;
    last.lastNtbBuyers += m.ntbBuyers;
    r.steps.forEach((s, i) => {
      const st = get(s);
      st.posSum += (i + 1) * m.buyers;
      st.posW += m.buyers;
    });
  }

  return [...stats.values()]
    .map(({ posSum, posW, ...s }) => {
      const without = emptyMetrics();
      for (const k of Object.keys(without) as (keyof Metrics)[]) without[k] = total[k] - s.with[k];
      return { ...s, without, avgPosition: posW > 0 ? posSum / posW : NaN };
    })
    .sort((a, b) => b.with.users - a.with.users || a.name.localeCompare(b.name));
}

export interface LengthStat {
  length: number;
  metrics: Metrics;
}

export function analyzeLengths(rows: PathRow[]): LengthStat[] {
  const map = new Map<number, Metrics>();
  for (const r of rows) {
    const n = r.steps.length;
    map.set(n, addMetrics(map.get(n) ?? emptyMetrics(), r.metrics));
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([length, metrics]) => ({ length, metrics }));
}

/** Transições consecutivas (de → para) somando uma métrica dos caminhos em que ocorrem. */
export function analyzeTransitions(rows: PathRow[], labels: string[], weight: (m: Metrics) => number): number[][] {
  const pos = new Map(labels.map((l, i) => [l, i]));
  const matrix = labels.map(() => labels.map(() => 0));
  for (const r of rows) {
    const w = weight(r.metrics);
    if (w === 0) continue;
    for (let i = 0; i + 1 < r.steps.length; i++) {
      const a = pos.get(r.steps[i]);
      const b = pos.get(r.steps[i + 1]);
      if (a !== undefined && b !== undefined) matrix[a][b] += w;
    }
  }
  return matrix;
}
