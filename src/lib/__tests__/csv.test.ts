import { describe, expect, it } from "vitest";
import { columnIndex, parseArrayCell, parseCount, parseCsv, parseNumber } from "../csv";

describe("parseCsv", () => {
  it("lê campos com aspas, vírgulas e aspas escapadas", () => {
    const t = parseCsv('a,b\n"[""X"", ""Y, Inc""]",10\r\n"linha\nquebrada",2\n');
    expect(t.headers).toEqual(["a", "b"]);
    expect(t.rows).toEqual([
      ['["X", "Y, Inc"]', "10"],
      ["linha\nquebrada", "2"],
    ]);
  });

  it("detecta ponto e vírgula e remove BOM", () => {
    const t = parseCsv("﻿Advertiser_Combination;unique_users\n[A];5");
    expect(t.rows).toEqual([["[A]", "5"]]);
    expect(columnIndex(t, "advertiser_combination")).toBe(0);
  });
});

describe("parseArrayCell", () => {
  it("aceita JSON, colchetes sem aspas e vazio", () => {
    expect(parseArrayCell('["Y, Inc","B"]')).toEqual(["Y, Inc", "B"]);
    expect(parseArrayCell("[A, B]")).toEqual(["A", "B"]);
    expect(parseArrayCell("[]")).toEqual([]);
  });
});

describe("parseCount", () => {
  it("ignora separadores de milhar", () => {
    expect(parseCount("12,345")).toBe(12345);
    expect(parseCount("")).toBeNaN();
  });
});

describe("parseNumber", () => {
  it("aceita formatos AMC, pt-BR e en-US", () => {
    expect(parseNumber("207.92554")).toBeCloseTo(207.92554);
    expect(parseNumber("1.234,56")).toBeCloseTo(1234.56);
    expect(parseNumber("887,67")).toBeCloseTo(887.67);
    expect(parseNumber("1,234.5")).toBeCloseTo(1234.5);
    expect(parseNumber("12,345")).toBe(12345);
    expect(parseNumber("")).toBeNaN();
  });
});
