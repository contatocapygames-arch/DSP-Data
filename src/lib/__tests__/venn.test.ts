import { describe, expect, it } from "vitest";
import { circleOverlap, distanceForOverlap, layoutVenn, regionLabelPoints } from "../venn";

describe("venn geometry", () => {
  it("área de interseção nos casos limite", () => {
    expect(circleOverlap(1, 1, 3)).toBe(0);
    expect(circleOverlap(2, 1, 0.5)).toBeCloseTo(Math.PI);
  });

  it("distância reproduz a interseção pedida", () => {
    const d = distanceForOverlap(3, 2, 4);
    expect(circleOverlap(3, 2, d)).toBeCloseTo(4, 6);
  });

  it("2 conjuntos: áreas e interseção exatas", () => {
    const [a, b] = layoutVenn([500, 300], () => 120);
    expect(Math.PI * a.r ** 2).toBeCloseTo(500);
    expect(Math.PI * b.r ** 2).toBeCloseTo(300);
    expect(circleOverlap(a.r, b.r, Math.hypot(a.x - b.x, a.y - b.y))).toBeCloseTo(120, 4);
  });

  it("3 conjuntos: cada par respeita sua interseção", () => {
    const pairs: Record<string, number> = { "0,1": 100, "0,2": 60, "1,2": 40 };
    const cs = layoutVenn([400, 300, 200], (i, j) => pairs[`${i},${j}`]);
    for (const [key, v] of Object.entries(pairs)) {
      const [i, j] = key.split(",").map(Number);
      expect(circleOverlap(cs[i].r, cs[j].r, Math.hypot(cs[i].x - cs[j].x, cs[i].y - cs[j].y))).toBeCloseTo(v, 3);
    }
  });

  it("acha ponto de rótulo para cada região visível", () => {
    const cs = layoutVenn([400, 300], () => 100);
    expect([...regionLabelPoints(cs).keys()].sort()).toEqual([1, 2, 3]);
  });
});
