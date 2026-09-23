import { describe, expect, it } from "vitest";
import { toUf } from "../../../lib/brazil";
import { parseCsv } from "../../../lib/csv";
import { ReportParseError } from "../../types";
import { analyzeStates, areasToReach, parseStatesTable, penetrationIndex, ticket } from "../analyze";

const CSV = `advertiser,advertiser_id,iso_state_province_code,total_conversions,ntb_conversions,ntb_conversion_pct,total_sales,ntb_sales,ntb_sales_pct
Marca A,1,BR-SP,100,40,40.0,10000.50,4000,40.0
Marca A,1,BR-RJ,50,10,20.0,4000,800,20.0
Marca A,1,BR-BA,20,15,75.0,1500,1000,66.6
Marca B,2,BR-SP,10,5,50.0,900,450,50.0
Marca B,3,BR-SP,7,2,28.5,700,200,28.5
Marca B,2,US-CA,3,1,33.3,300,100,33.3
`;

describe("vendas por estado", () => {
  const parsed = parseStatesTable(parseCsv(CSV));

  it("normaliza códigos de UF", () => {
    expect(toUf("BR-SP")).toBe("SP");
    expect(toUf("sp")).toBe("SP");
    expect(toUf("São Paulo")).toBe("SP");
    expect(toUf("US-CA")).toBeUndefined();
  });

  it("lê linhas e separa códigos fora do Brasil", () => {
    expect(parsed.rows).toHaveLength(5);
    expect(parsed.advertisers.map((a) => a.label)).toEqual(["Marca A (1)", "Marca B (2)", "Marca B (3)"]);
    expect(parsed.unmatched).toEqual([{ code: "US-CA", metrics: { orders: 3, ntbOrders: 1, sales: 300, ntbSales: 100 } }]);
    expect(parsed.warnings[0]).toContain("US-CA");
  });

  it("agrega por estado, região e anunciante", () => {
    const all = analyzeStates(parsed.rows, null);
    expect(all.states).toHaveLength(27);
    expect(all.total.sales).toBeCloseTo(17100.5);
    expect(all.states.find((s) => s.id === "SP")!.metrics.orders).toBe(117);
    expect(all.regions.find((r) => r.id === "SE")!.metrics.sales).toBeCloseTo(15600.5);
    expect(all.regions.find((r) => r.id === "N")!.metrics.sales).toBe(0);

    // Mesmo nome, IDs diferentes: cada ID é um anunciante.
    const b = analyzeStates(parsed.rows, "2");
    expect(b.total.sales).toBe(900);
    expect(ticket(b.total)).toBe(90);
    expect(analyzeStates(parsed.rows, "3").total.sales).toBe(700);
  });

  it("índice de penetração e concentração", () => {
    const all = analyzeStates(parsed.rows, null);
    const sp = all.states.find((s) => s.id === "SP")!;
    expect(penetrationIndex(sp, all.total)).toBeGreaterThan(100);
    expect(areasToReach(all.states, 0.6)).toBe(1);
    expect(areasToReach(all.states, 0.95)).toBe(3);
  });

  it("rejeita CSV sem colunas", () => {
    expect(() => parseStatesTable(parseCsv("a,b\n1,2"))).toThrow(ReportParseError);
  });
});
