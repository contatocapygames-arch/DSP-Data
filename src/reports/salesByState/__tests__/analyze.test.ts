import { describe, expect, it } from "vitest";
import { BRAZIL, MEXICO, resolveState } from "../../../lib/geo";
import { parseCsv } from "../../../lib/csv";
import { ReportParseError } from "../../types";
import { analyzeStates, areasToReach, parseStatesTable, penetrationIndex, ticket } from "../analyze";

const CSV = `advertiser,advertiser_id,iso_state_province_code,total_conversions,ntb_conversions,ntb_conversion_pct,total_sales,ntb_sales,ntb_sales_pct
Marca A,1,BR-SP,100,40,40.0,10000.50,4000,40.0
Marca A,1,BR-RJ,50,10,20.0,4000,800,20.0
Marca A,1,BR-BA,20,15,75.0,1500,1000,66.6
Marca B,2,BR-SP,10,5,50.0,900,450,50.0
Marca B,3,BR-SP,7,2,28.5,700,200,28.5
Marca A,1,MX-CMX,30,10,33.3,6000,2000,33.3
Marca A,1,MX-DIF,5,1,20.0,1000,100,10.0
Marca A,1,MX-JAL,10,5,50.0,2000,1000,50.0
Marca B,2,US-CA,3,1,33.3,300,100,33.3
`;

describe("vendas por estado", () => {
  const parsed = parseStatesTable(parseCsv(CSV));

  it("identifica país e estado", () => {
    const r = (c: string) => {
      const x = resolveState(c);
      return x && `${x.country.id}-${x.code}`;
    };
    expect(r("BR-SP")).toBe("BR-SP");
    expect(r("sp")).toBe("BR-SP");
    expect(r("São Paulo")).toBe("BR-SP");
    expect(r("MX-CMX")).toBe("MX-CMX");
    expect(r("MX-DIF")).toBe("MX-CMX");
    expect(r("jal")).toBe("MX-JAL");
    expect(r("Nuevo León")).toBe("MX-NLE");
    expect(r("US-CA")).toBeUndefined();
    expect(BRAZIL.states).toHaveLength(27);
    expect(MEXICO.states).toHaveLength(32);
  });

  it("lê linhas e separa códigos fora do Brasil", () => {
    expect(parsed.rows).toHaveLength(8);
    expect(parsed.countries).toEqual(["BR", "MX"]);
    expect(parsed.advertisers.map((a) => a.label)).toEqual(["Marca A (1)", "Marca B (2)", "Marca B (3)"]);
    expect(parsed.unmatched).toEqual([{ code: "US-CA", metrics: { orders: 3, ntbOrders: 1, sales: 300, ntbSales: 100 } }]);
    expect(parsed.warnings[0]).toContain("US-CA");
  });

  it("agrega por estado, região e anunciante", () => {
    const all = analyzeStates(parsed.rows, BRAZIL, null);
    expect(all.states).toHaveLength(27);
    expect(all.total.sales).toBeCloseTo(17100.5);
    expect(all.states.find((s) => s.id === "SP")!.metrics.orders).toBe(117);
    expect(all.regions.find((r) => r.id === "SE")!.metrics.sales).toBeCloseTo(15600.5);
    expect(all.regions.find((r) => r.id === "N")!.metrics.sales).toBe(0);

    // Mesmo nome, IDs diferentes: cada ID é um anunciante.
    const b = analyzeStates(parsed.rows, BRAZIL, "2");
    expect(b.total.sales).toBe(900);
    expect(ticket(b.total)).toBe(90);
    expect(analyzeStates(parsed.rows, BRAZIL, "3").total.sales).toBe(700);
  });

  it("agrega o México separado, com regiões do Banxico", () => {
    const mx = analyzeStates(parsed.rows, MEXICO, null);
    expect(mx.states).toHaveLength(32);
    expect(mx.total.sales).toBe(9000);
    expect(mx.states.find((s) => s.id === "CMX")!.metrics.orders).toBe(35);
    expect(mx.regions.map((r) => [r.name, r.metrics.sales])).toEqual([
      ["Norte", 0],
      ["Centro Norte", 2000],
      ["Centro", 7000],
      ["Sur", 0],
    ]);
    expect(mx.regions.reduce((s, r) => s + r.popShare, 0)).toBeCloseTo(1);
  });

  it("índice de penetração e concentração", () => {
    const all = analyzeStates(parsed.rows, BRAZIL, null);
    const sp = all.states.find((s) => s.id === "SP")!;
    expect(penetrationIndex(sp, all.total)).toBeGreaterThan(100);
    expect(areasToReach(all.states, 0.6)).toBe(1);
    expect(areasToReach(all.states, 0.95)).toBe(3);
  });

  it("rejeita CSV sem colunas", () => {
    expect(() => parseStatesTable(parseCsv("a,b\n1,2"))).toThrow(ReportParseError);
  });
});
