import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildXlsx } from "../xlsx";

describe("buildXlsx", () => {
  it("gera um zip com planilha, números tipados e texto escapado", () => {
    const files = unzipSync(
      buildXlsx(
        {
          header: ["Estado", "Vendas"],
          rows: [
            ["São Paulo & <Capital>", 1234.5],
            ["RJ", NaN],
          ],
        },
        "Vendas: estado?",
      ),
    );
    expect(Object.keys(files).sort()).toEqual(
      [
        "[Content_Types].xml",
        "_rels/.rels",
        "xl/_rels/workbook.xml.rels",
        "xl/styles.xml",
        "xl/workbook.xml",
        "xl/worksheets/sheet1.xml",
      ].sort(),
    );
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(sheet).toContain('<c r="B2"><v>1234.5</v></c>');
    expect(sheet).toContain("São Paulo &amp; &lt;Capital&gt;");
    expect(sheet).not.toContain('r="B3"');
    expect(strFromU8(files["xl/workbook.xml"])).toContain('name="Vendas  estado"');
  });
});
