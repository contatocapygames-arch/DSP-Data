import { describe, expect, it } from "vitest";
import { parseCsv } from "../../../lib/csv";
import { ReportParseError } from "../../types";
import {
  analyzeLengths,
  analyzeSegments,
  analyzeTouchpoints,
  analyzeTransitions,
  groupPaths,
  matchesFilter,
  type TouchFilter,
} from "../analyze";
import { parsePath, parsePathTable, purchaseRate, roas } from "../parse";

const CSV = `amc_template_name,start_date,end_date,path,path_occurrences,impressions,total_cost,users_that_purchased,sales_amount,purchases,user_purchase_rate,ntb_users_that_purchased,ntb_sales_amount,ntb_purchases,ntb_user_percentage,ntb_purchases_percentage,insight1,insight2
T,2026-05-22,2026-08-20,"[[1, SP]]",100,1000,10.0,10,500.0,12,0.1,4,200.0,5,"","","",""
T,2026-05-22,2026-08-20,"[[1, DSP NTB]]",200,2000,20.0,2,100.0,2,0.01,2,100.0,2,1.0,1.0,"",""
T,2026-05-22,2026-08-20,"[[1, DSP NTB], [2, DSP Awareness]]",50,500,5.0,1,50.0,1,0.02,1,50.0,1,1.0,1.0,"",""
T,2026-05-22,2026-08-20,"[[1, DSP NTB], [2, SP]]",40,400,4.0,8,400.0,9,0.2,6,300.0,6,"","","",""
T,2026-05-22,2026-08-20,"[[1, SB], [2, SP]]",30,300,3.0,3,150.0,3,0.1,0,0.0,0,"","","",""
T,2026-05-22,2026-08-20,"[[1, SP], [2, DSP Awareness], [3, SB], [4, DSP NTB]]",10,100,1.0,5,250.0,6,0.5,1,50.0,1,"","","",""
`;

const DSP: TouchFilter = { rules: [{ op: "contains", value: "dsp" }], join: "any", name: "" };

describe("path to conversion", () => {
  const parsed = parsePathTable(parseCsv(CSV));
  const rows = parsed.rows;

  it("lê caminho, métricas e período", () => {
    expect(parsePath("[[2, SB SOV], [1, DSP Conversão]]")).toEqual(["DSP Conversão", "SB SOV"]);
    expect(rows).toHaveLength(6);
    expect(rows[3].metrics).toMatchObject({ users: 40, buyers: 8, sales: 400, ntbBuyers: 6 });
    expect(parsed).toMatchObject({ startDate: "2026-05-22", endDate: "2026-08-20", hasNtb: true });
  });

  it("filtro ignora caixa e acento e combina regras", () => {
    expect(matchesFilter(DSP, "DSP Conversão")).toBe(true);
    expect(matchesFilter({ ...DSP, rules: [{ op: "contains", value: "conversao" }] }, "DSP Conversão")).toBe(true);
    expect(
      matchesFilter({ join: "all", name: "", rules: [{ op: "contains", value: "dsp" }, { op: "notContains", value: "ntb" }] }, "DSP NTB"),
    ).toBe(false);
  });

  it("segmentos formam partição do total", () => {
    const { segments, matched, others } = analyzeSegments(rows, DSP);
    const by = Object.fromEntries(segments.map((s) => [s.id, s.metrics.users]));
    expect(matched).toEqual(["DSP NTB", "DSP Awareness"]);
    expect(others).toEqual(["SP", "SB"]);
    expect(by).toEqual({ total: 430, fullFunnel: 10, only: 250, none: 130, othersAll: 30, mixed: 40 });
    expect(by.fullFunnel + by.only + by.none + by.mixed).toBe(by.total);
    expect(segments[0].label).toBe("Todos os caminhos");
    expect(segments[2].label).toBe("Só dsp");
  });

  it("agrupa por combinação ignorando ordem", () => {
    const { rowSegment } = analyzeSegments(rows, DSP);
    const combos = groupPaths(rows, rowSegment, false);
    expect(combos.find((c) => c.key === "DSP NTB › SP")?.metrics.users).toBe(40);
    expect(groupPaths(rows, rowSegment, true)).toHaveLength(6);
  });

  it("pontos de contato: com/sem, primeiro e último toque", () => {
    const sp = analyzeTouchpoints(rows).find((t) => t.name === "SP")!;
    expect(sp.with.users).toBe(180);
    expect(sp.without.users).toBe(250);
    expect(sp.firstBuyers).toBe(15);
    expect(sp.lastBuyers).toBe(21);
    expect(purchaseRate(sp.with)).toBeCloseTo(26 / 180);
  });

  it("tamanho do caminho e transições", () => {
    expect(analyzeLengths(rows).map((l) => [l.length, l.metrics.users])).toEqual([
      [1, 300],
      [2, 120],
      [4, 10],
    ]);
    const labels = ["SP", "DSP NTB", "SB", "DSP Awareness"];
    const t = analyzeTransitions(rows, labels, (m) => m.buyers);
    expect(t[1][0]).toBe(8); // DSP NTB → SP
    expect(t[2][0]).toBe(3); // SB → SP
  });

  it("ROAS e rejeição de CSV errado", () => {
    expect(roas(rows[0].metrics)).toBe(50);
    expect(() => parsePathTable(parseCsv("a,b\n1,2"))).toThrow(ReportParseError);
  });
});
