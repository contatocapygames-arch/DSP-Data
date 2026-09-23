import { formatMultiple, formatPct } from "../../lib/format";
import type { LengthStat, SegmentAnalysis, TouchpointStat } from "./analyze";
import { ntbRate, ntbShare, purchaseRate, type Metrics } from "./parse";

export interface Insight {
  title: string;
  body: string;
}

const lift = (a: number, b: number) => (b > 0 && Number.isFinite(a) ? a / b : NaN);
const MIN_USERS_SHARE = 0.01;

/** Pontos com volume mínimo (1% dos usuários de cada lado) para a comparação com/sem não ser ruído. */
const comparable = (t: TouchpointStat, total: Metrics) =>
  t.with.users >= total.users * MIN_USERS_SHARE && t.without.users >= total.users * MIN_USERS_SHARE;

export function buildPathInsights(seg: SegmentAnalysis, tps: TouchpointStat[], lengths: LengthStat[], groupName: string): Insight[] {
  const total = seg.segments[0].metrics;
  const by = Object.fromEntries(seg.segments.map((s) => [s.id, s.metrics])) as Record<string, Metrics>;
  const out: Insight[] = [];

  if (seg.matched.length > 0 && seg.others.length > 0) {
    const withGroup = total.buyers - by.none.buyers;
    out.push({
      title: `Participação de ${groupName}`,
      body: `${formatPct(withGroup / total.buyers)} dos compradores tiveram ${groupName} no caminho. A taxa de compra de quem viu ${groupName} é ${formatMultiple(
        lift(purchaseRate({ ...total, users: total.users - by.none.users, buyers: withGroup }), purchaseRate(by.none)),
        "x",
      )} a de quem não viu.`,
    });
  }

  const best = tps.filter((t) => comparable(t, total)).sort((a, b) => lift(purchaseRate(b.with), purchaseRate(b.without)) - lift(purchaseRate(a.with), purchaseRate(a.without)))[0];
  if (best) {
    out.push({
      title: "Ponto de contato com maior lift",
      body: `Caminhos com ${best.name} convertem ${formatMultiple(lift(purchaseRate(best.with), purchaseRate(best.without)), "x")} mais que caminhos sem ele (${formatPct(
        purchaseRate(best.with),
        2,
      )} x ${formatPct(purchaseRate(best.without), 2)}).`,
    });
  }

  const first = [...tps].sort((a, b) => b.firstBuyers - a.firstBuyers)[0];
  const last = [...tps].sort((a, b) => b.lastBuyers - a.lastBuyers)[0];
  if (first && total.buyers > 0) {
    out.push({
      title: "Início e fim dos caminhos com compra",
      body: `${first.name} é o primeiro toque mais comum (${formatPct(first.firstBuyers / total.buyers)} dos compradores) e ${last.name} o último (${formatPct(
        last.lastBuyers / total.buyers,
      )}).`,
    });
  }

  const bestLen = lengths.filter((l) => l.metrics.users >= total.users * MIN_USERS_SHARE).sort((a, b) => purchaseRate(b.metrics) - purchaseRate(a.metrics))[0];
  const single = lengths.find((l) => l.length === 1);
  if (bestLen && single && bestLen.length !== 1) {
    out.push({
      title: "Tamanho do caminho",
      body: `Caminhos com ${bestLen.length} pontos de contato têm a maior taxa de compra (${formatPct(purchaseRate(bestLen.metrics), 2)}), ${formatMultiple(
        lift(purchaseRate(bestLen.metrics), purchaseRate(single.metrics)),
        "x",
      )} a de quem viu um único ponto.`,
    });
  }
  return out;
}

export function buildNtbInsights(seg: SegmentAnalysis, tps: TouchpointStat[], groupName: string): Insight[] {
  const total = seg.segments[0].metrics;
  const out: Insight[] = [];
  if (total.purchases === 0) return out;

  out.push({
    title: "Peso dos novos clientes",
    body: `${formatPct(ntbShare(total))} das compras e ${formatPct(total.ntbSales / total.sales)} das vendas vieram de clientes novos para a marca (NTB).`,
  });

  const best = tps.filter((t) => comparable(t, total)).sort((a, b) => lift(ntbRate(b.with), ntbRate(b.without)) - lift(ntbRate(a.with), ntbRate(a.without)))[0];
  if (best) {
    out.push({
      title: "Ponto que mais adquire NTB",
      body: `Caminhos com ${best.name} adquirem ${formatMultiple(lift(ntbRate(best.with), ntbRate(best.without)), "x")} mais clientes NTB por usuário que caminhos sem ele.`,
    });
  }

  const candidates = seg.segments.filter((s) => s.id !== "total" && s.metrics.purchases > 0 && s.metrics.users >= total.users * MIN_USERS_SHARE);
  const top = [...candidates].sort((a, b) => ntbShare(b.metrics) - ntbShare(a.metrics))[0];
  if (top) {
    out.push({
      title: "Segmento mais NTB",
      body: `${top.label}: ${formatPct(ntbShare(top.metrics))} das compras são NTB (média geral ${formatPct(ntbShare(total))}).`,
    });
  }

  const firstNtb = [...tps].sort((a, b) => b.firstNtbBuyers - a.firstNtbBuyers)[0];
  if (firstNtb && total.ntbBuyers > 0) {
    out.push({
      title: "Porta de entrada do NTB",
      body: `${formatPct(firstNtb.firstNtbBuyers / total.ntbBuyers)} dos compradores NTB começaram o caminho por ${firstNtb.name}${
        seg.matched.includes(firstNtb.name) ? ` (grupo ${groupName})` : ""
      }.`,
    });
  }
  return out;
}
