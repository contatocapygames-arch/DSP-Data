/** Geometria de diagramas de Venn proporcionais à área (2 ou 3 conjuntos). */

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** Área da interseção de dois círculos com raios r1, r2 e centros a distância d. */
export function circleOverlap(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const a = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
  const b = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
  const c = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
  return a + b - c;
}

/** Distância entre centros que produz a área de interseção pedida (busca binária; a área cai com d). */
export function distanceForOverlap(r1: number, r2: number, overlap: number): number {
  const min = Math.abs(r1 - r2);
  const max = r1 + r2;
  if (overlap <= 0) return max;
  if (overlap >= Math.PI * Math.min(r1, r2) ** 2) return min;
  let lo = min;
  let hi = max;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (circleOverlap(r1, r2, mid) > overlap) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Posiciona 2 ou 3 círculos com área = tamanho do conjunto.
 * Com 2 é exato; com 3 cada par respeita a própria interseção, mas as áreas das regiões são aproximadas
 * (três círculos não conseguem representar qualquer combinação de sobreposições).
 */
export function layoutVenn(sizes: number[], pairOverlap: (i: number, j: number) => number): Circle[] {
  const r = sizes.map((s) => Math.sqrt(Math.max(s, 0) / Math.PI));
  if (sizes.length === 1) return [{ x: 0, y: 0, r: r[0] }];

  const dAB = distanceForOverlap(r[0], r[1], pairOverlap(0, 1));
  const circles: Circle[] = [
    { x: 0, y: 0, r: r[0] },
    { x: dAB, y: 0, r: r[1] },
  ];
  if (sizes.length === 2) return circles;

  const dAC = distanceForOverlap(r[0], r[2], pairOverlap(0, 2));
  const dBC = distanceForOverlap(r[1], r[2], pairOverlap(1, 2));
  if (dAB < 1e-9) {
    circles.push({ x: dAC, y: 0, r: r[2] });
    return circles;
  }
  // Lei dos cossenos; quando as três distâncias não formam triângulo, o C fica na reta AB.
  const x = (dAB * dAB + dAC * dAC - dBC * dBC) / (2 * dAB);
  const y = Math.sqrt(Math.max(0, dAC * dAC - x * x));
  circles.push({ x, y, r: r[2] });
  return circles;
}

/** Bitmask dos círculos que contêm o ponto (bit i = círculo i). */
export function regionMask(circles: Circle[], x: number, y: number): number {
  let mask = 0;
  circles.forEach((c, i) => {
    if ((x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r) mask |= 1 << i;
  });
  return mask;
}

/**
 * Ponto de cada região mais distante das bordas (bom lugar para o rótulo), por amostragem em grade.
 * Regiões pequenas demais para aparecer na grade ficam de fora.
 */
export function regionLabelPoints(circles: Circle[], steps = 90): Map<number, { x: number; y: number; clearance: number }> {
  const minX = Math.min(...circles.map((c) => c.x - c.r));
  const maxX = Math.max(...circles.map((c) => c.x + c.r));
  const minY = Math.min(...circles.map((c) => c.y - c.r));
  const maxY = Math.max(...circles.map((c) => c.y + c.r));
  const best = new Map<number, { x: number; y: number; clearance: number }>();
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const x = minX + ((maxX - minX) * i) / steps;
      const y = minY + ((maxY - minY) * j) / steps;
      const mask = regionMask(circles, x, y);
      if (mask === 0) continue;
      const clearance = Math.min(...circles.map((c) => Math.abs(Math.hypot(x - c.x, y - c.y) - c.r)));
      const cur = best.get(mask);
      if (!cur || clearance > cur.clearance) best.set(mask, { x, y, clearance });
    }
  }
  return best;
}
