import { describe, expect, it } from "vitest";
import { parseCsv } from "../../../lib/csv";
import { ReportParseError } from "../../types";
import { analyzeOverlap, buildInsights, parseOverlapTable, vennRegions } from "../analyze";

const CSV = `advertiser_combination,campaign_id_combination,campaign_name_combination,advertiser_count,unique_users
"[""A""]","[""1""]","[""A1""]",1,100
"[""A""]","[""1"",""2""]","[""A1"",""A2""]",1,50
"[""B""]","[""3""]","[""B1""]",1,80
"[""A"",""B""]","[""1"",""3""]","[""A1"",""B1""]",2,30
"[""A"",""B"",""C""]","[""2"",""3"",""4""]","[""A2"",""B1"",""C1""]",3,20
`;

describe("advertiser overlap", () => {
  const { rows } = parseOverlapTable(parseCsv(CSV));
  const a = analyzeOverlap(rows);

  it("soma usuários únicos e alcance por anunciante", () => {
    expect(a.totalUsers).toBe(280);
    expect(a.multiAdvertiserUsers).toBe(50);
    expect(a.advertisers.map((x) => [x.name, x.reach, x.exclusive])).toEqual([
      ["A", 200, 150],
      ["B", 130, 80],
      ["C", 20, 0],
    ]);
  });

  it("monta a matriz de pares simétrica com alcance na diagonal", () => {
    expect(a.pair).toEqual([
      [200, 50, 20],
      [50, 130, 20],
      [20, 20, 20],
    ]);
  });

  it("distribui usuários por quantidade de anunciantes", () => {
    expect(a.byAdvertiserCount).toEqual([
      { count: 1, users: 230 },
      { count: 2, users: 30 },
      { count: 3, users: 20 },
    ]);
  });

  it("agrega combinações de anunciantes ignorando campanhas", () => {
    expect(a.combos[0]).toEqual({ advertisers: ["A"], users: 150 });
    expect(a.combos).toHaveLength(4);
  });

  it("calcula campanhas com anunciante e ID inferidos", () => {
    const a1 = a.campaigns.find((c) => c.name === "A1")!;
    expect(a1).toMatchObject({ id: "1", advertiser: "A", reach: 180, exclusive: 100, crossAdvertiser: 30 });
    const c1 = a.campaigns.find((c) => c.name === "C1")!;
    expect(c1.advertiser).toBeUndefined();
  });

  it("gera insights", () => {
    const text = buildInsights(a).map((i) => i.body).join(" ");
    expect(text).toContain("A e B dividem 50 usuários");
  });

  it("rejeita CSV sem as colunas exigidas", () => {
    expect(() => parseOverlapTable(parseCsv("foo,bar\n1,2"))).toThrow(ReportParseError);
  });
});

describe("vennRegions", () => {
  it("agrupa por anunciantes selecionados ignorando os demais", () => {
    const { rows } = parseOverlapTable(parseCsv(CSV));
    const regions = vennRegions(analyzeOverlap(rows).combos, ["A", "C"]);
    // A sozinho (150) + A∩B sem C (30) contam como "só A" dentro da seleção.
    expect(Object.fromEntries(regions)).toEqual({ 1: 180, 3: 20 });
  });
});
