import { columnIndex, parseArrayCell, parseCount, type CsvTable } from "../../lib/csv";
import { ReportParseError } from "../types";

/** Uma linha do resultado: um grupo de usuários com exatamente esta combinação de exposições. */
export interface OverlapRow {
  advertisers: string[];
  campaignIds: string[];
  campaigns: string[];
  advertiserCount: number;
  users: number;
}

export interface ParsedOverlap {
  rows: OverlapRow[];
  warnings: string[];
}

export const REQUIRED_COLUMNS = ["advertiser_combination", "unique_users"];
export const OPTIONAL_COLUMNS = ["campaign_id_combination", "campaign_name_combination", "advertiser_count"];

export function parseOverlapTable(table: CsvTable): ParsedOverlap {
  const idx = Object.fromEntries(
    [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].map((c) => [c, columnIndex(table, c)]),
  ) as Record<string, number>;

  const missing = REQUIRED_COLUMNS.filter((c) => idx[c] < 0);
  if (missing.length > 0) {
    throw new ReportParseError(
      `O CSV não tem a(s) coluna(s) ${missing.join(", ")}. Colunas encontradas: ${table.headers.join(", ") || "nenhuma"}.`,
    );
  }

  const warnings: string[] = [];
  const rows: OverlapRow[] = [];
  let skipped = 0;
  const cell = (r: string[], col: string) => (idx[col] >= 0 ? (r[idx[col]] ?? "") : "");

  for (const r of table.rows) {
    const users = parseCount(cell(r, "unique_users"));
    const advertisers = parseArrayCell(cell(r, "advertiser_combination"));
    if (!Number.isFinite(users) || users <= 0 || advertisers.length === 0) {
      skipped++;
      continue;
    }
    const declaredCount = parseCount(cell(r, "advertiser_count"));
    rows.push({
      advertisers,
      campaignIds: parseArrayCell(cell(r, "campaign_id_combination")),
      campaigns: parseArrayCell(cell(r, "campaign_name_combination")),
      advertiserCount: Number.isFinite(declaredCount) && declaredCount > 0 ? declaredCount : advertisers.length,
      users,
    });
  }

  if (rows.length === 0) throw new ReportParseError("Nenhuma linha válida encontrada no CSV.");
  if (skipped > 0) warnings.push(`${skipped} linha(s) ignorada(s) por não terem anunciante ou unique_users válido.`);
  if (idx.campaign_name_combination < 0) {
    warnings.push("Sem a coluna campaign_name_combination: a análise por campanha fica indisponível.");
  }
  return { rows, warnings };
}

export interface AdvertiserStat {
  name: string;
  reach: number;
  /** Usuários impactados apenas por este anunciante. */
  exclusive: number;
  shared: number;
}

export interface ComboStat {
  advertisers: string[];
  users: number;
}

export interface CampaignStat {
  name: string;
  id?: string;
  advertiser?: string;
  reach: number;
  /** Usuários que só viram esta campanha. */
  exclusive: number;
  /** Usuários desta campanha que também viram outro anunciante. */
  crossAdvertiser: number;
}

export interface OverlapAnalysis {
  totalUsers: number;
  multiAdvertiserUsers: number;
  /** Ordenados por alcance, desc. */
  advertisers: AdvertiserStat[];
  /** pair[i][j] = usuários expostos a advertisers[i] e advertisers[j]; diagonal = alcance. */
  pair: number[][];
  /** Usuários por quantidade de anunciantes vistos (1, 2, 3...). */
  byAdvertiserCount: { count: number; users: number }[];
  /** Combinações de anunciantes (somando todas as combinações de campanha), desc. */
  combos: ComboStat[];
  campaigns: CampaignStat[];
}

export function analyzeOverlap(rows: OverlapRow[]): OverlapAnalysis {
  // Cada usuário cai em exatamente uma linha, então somar linhas dá usuários únicos sem duplicar.
  const totalUsers = rows.reduce((s, r) => s + r.users, 0);

  const reach = new Map<string, number>();
  const exclusive = new Map<string, number>();
  const comboMap = new Map<string, ComboStat>();
  const countMap = new Map<number, number>();

  for (const r of rows) {
    const advs = [...new Set(r.advertisers)];
    for (const a of advs) reach.set(a, (reach.get(a) ?? 0) + r.users);
    if (advs.length === 1) exclusive.set(advs[0], (exclusive.get(advs[0]) ?? 0) + r.users);

    const key = [...advs].sort().join("\u0000");
    const combo = comboMap.get(key) ?? { advertisers: [...advs].sort(), users: 0 };
    combo.users += r.users;
    comboMap.set(key, combo);

    countMap.set(advs.length, (countMap.get(advs.length) ?? 0) + r.users);
  }

  const advertisers: AdvertiserStat[] = [...reach.entries()]
    .map(([name, rch]) => ({ name, reach: rch, exclusive: exclusive.get(name) ?? 0, shared: rch - (exclusive.get(name) ?? 0) }))
    .sort((a, b) => b.reach - a.reach || a.name.localeCompare(b.name));

  const pos = new Map(advertisers.map((a, i) => [a.name, i]));
  const pair = advertisers.map(() => advertisers.map(() => 0));
  for (const combo of comboMap.values()) {
    const ids = combo.advertisers.map((a) => pos.get(a)!);
    for (const i of ids) for (const j of ids) pair[i][j] += combo.users;
  }

  const maxCount = Math.max(...countMap.keys());
  const byAdvertiserCount = Array.from({ length: maxCount }, (_, k) => ({ count: k + 1, users: countMap.get(k + 1) ?? 0 }));
  const multiAdvertiserUsers = totalUsers - (countMap.get(1) ?? 0);

  return {
    totalUsers,
    multiAdvertiserUsers,
    advertisers,
    pair,
    byAdvertiserCount,
    combos: [...comboMap.values()].sort((a, b) => b.users - a.users),
    campaigns: analyzeCampaigns(rows),
  };
}

function analyzeCampaigns(rows: OverlapRow[]): CampaignStat[] {
  const stats = new Map<string, CampaignStat>();
  const get = (name: string) => {
    let s = stats.get(name);
    if (!s) {
      s = { name, reach: 0, exclusive: 0, crossAdvertiser: 0 };
      stats.set(name, s);
    }
    return s;
  };

  for (const r of rows) {
    const names = [...new Set(r.campaigns)];
    const multiAdv = new Set(r.advertisers).size > 1;
    for (const n of names) {
      const s = get(n);
      s.reach += r.users;
      if (multiAdv) s.crossAdvertiser += r.users;
    }
    if (names.length === 1) {
      const s = get(names[0]);
      s.exclusive += r.users;
      // Nome e ID vêm em arrays ordenados independentemente; só dá para parear quando há um de cada.
      if (r.campaignIds.length === 1) s.id ??= r.campaignIds[0];
    }
    // Com um único anunciante na linha, todas as campanhas dela são desse anunciante.
    if (new Set(r.advertisers).size === 1) for (const n of names) get(n).advertiser ??= r.advertisers[0];
  }

  return [...stats.values()].sort((a, b) => b.reach - a.reach || a.name.localeCompare(b.name));
}

export interface Insight {
  title: string;
  body: string;
}

const pct = (r: number) => `${(r * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const int = (n: number) => n.toLocaleString("pt-BR");

/** Frases de leitura rápida geradas a partir da análise. */
export function buildInsights(a: OverlapAnalysis): Insight[] {
  const out: Insight[] = [];
  if (a.advertisers.length < 2) {
    out.push({
      title: "Só um anunciante no arquivo",
      body: "Não há sobreposição entre anunciantes para medir. Rode a query num período ou instância com mais de um anunciante.",
    });
    return out;
  }

  out.push({
    title: "Audiência compartilhada",
    body: `${pct(a.multiAdvertiserUsers / a.totalUsers)} dos usuários (${int(a.multiAdvertiserUsers)}) foram impactados por 2 ou mais anunciantes.`,
  });

  let best = { i: -1, j: -1, users: 0 };
  a.pair.forEach((row, i) =>
    row.forEach((users, j) => {
      if (j > i && users > best.users) best = { i, j, users };
    }),
  );
  if (best.i >= 0) {
    const A = a.advertisers[best.i];
    const B = a.advertisers[best.j];
    out.push({
      title: "Maior sobreposição entre dois anunciantes",
      body: `${A.name} e ${B.name} dividem ${int(best.users)} usuários: ${pct(best.users / A.reach)} do alcance de ${A.name} e ${pct(best.users / B.reach)} do de ${B.name}.`,
    });
  }

  const byExclusivity = [...a.advertisers].sort((x, y) => y.exclusive / y.reach - x.exclusive / x.reach);
  const top = byExclusivity[0];
  const bottom = byExclusivity[byExclusivity.length - 1];
  out.push({
    title: "Alcance mais exclusivo",
    body: `${top.name}: ${pct(top.exclusive / top.reach)} do alcance não foi impactado por nenhum outro anunciante.`,
  });
  if (bottom !== top) {
    out.push({
      title: "Alcance mais sobreposto",
      body: `${bottom.name}: ${pct(bottom.shared / bottom.reach)} do alcance também viu outro anunciante.`,
    });
  }
  return out;
}
