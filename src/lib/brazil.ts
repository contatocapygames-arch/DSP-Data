/** Metadados das 27 UFs: região, população (IBGE, Censo 2022) e ponto para rótulo no mapa. */

export type RegionId = "N" | "NE" | "CO" | "SE" | "S";

export const REGIONS: { id: RegionId; name: string; label: { x: number; y: number } }[] = [
  { id: "N", name: "Norte", label: { x: 245, y: 150 } },
  { id: "NE", name: "Nordeste", label: { x: 500, y: 215 } },
  { id: "CO", name: "Centro-Oeste", label: { x: 318, y: 335 } },
  { id: "SE", name: "Sudeste", label: { x: 462, y: 405 } },
  { id: "S", name: "Sul", label: { x: 345, y: 525 } },
];

export interface UfInfo {
  uf: string;
  name: string;
  region: RegionId;
  population: number;
  /** Ponto interno do estado no viewBox do mapa (613 x 639). */
  label: { x: number; y: number };
  /** Estados pequenos têm o rótulo fora do mapa, ligado por uma linha, nesta altura. */
  outside?: number;
}

export const UFS: UfInfo[] = [
  { uf: "AC", name: "Acre", region: "N", population: 830018, label: { x: 38.6, y: 220.2 } },
  { uf: "AL", name: "Alagoas", region: "NE", population: 3127683, label: { x: 585.8, y: 234.5 }, outside: 238 },
  { uf: "AP", name: "Amapá", region: "N", population: 733759, label: { x: 346.2, y: 63 } },
  { uf: "AM", name: "Amazonas", region: "N", population: 3941613, label: { x: 130.4, y: 154 } },
  { uf: "BA", name: "Bahia", region: "NE", population: 14141626, label: { x: 504.5, y: 272.3 } },
  { uf: "CE", name: "Ceará", region: "NE", population: 8794957, label: { x: 539.1, y: 159.6 } },
  { uf: "DF", name: "Distrito Federal", region: "CO", population: 2817381, label: { x: 406.8, y: 329.4 }, outside: 318 },
  { uf: "ES", name: "Espírito Santo", region: "SE", population: 3833712, label: { x: 525.8, y: 375.4 }, outside: 372 },
  { uf: "GO", name: "Goiás", region: "CO", population: 7056495, label: { x: 370.2, y: 350 } },
  { uf: "MA", name: "Maranhão", region: "NE", population: 6776699, label: { x: 448.5, y: 161.3 } },
  { uf: "MT", name: "Mato Grosso", region: "CO", population: 3658649, label: { x: 288.4, y: 292.7 } },
  { uf: "MS", name: "Mato Grosso do Sul", region: "CO", population: 2757013, label: { x: 304, y: 405.9 } },
  { uf: "MG", name: "Minas Gerais", region: "SE", population: 20539989, label: { x: 463.5, y: 376.2 } },
  { uf: "PA", name: "Pará", region: "N", population: 8120131, label: { x: 328.7, y: 164.8 } },
  { uf: "PB", name: "Paraíba", region: "NE", population: 3974687, label: { x: 593.7, y: 192.1 }, outside: 188 },
  { uf: "PR", name: "Paraná", region: "S", population: 11444380, label: { x: 343.7, y: 474.1 } },
  { uf: "PE", name: "Pernambuco", region: "NE", population: 9058931, label: { x: 533.5, y: 206.7 }, outside: 213 },
  { uf: "PI", name: "Piauí", region: "NE", population: 3271199, label: { x: 501.4, y: 197 } },
  { uf: "RJ", name: "Rio de Janeiro", region: "SE", population: 16055174, label: { x: 489.6, y: 439 }, outside: 440 },
  { uf: "RN", name: "Rio Grande do Norte", region: "NE", population: 3302729, label: { x: 581.1, y: 171.6 }, outside: 163 },
  { uf: "RS", name: "Rio Grande do Sul", region: "S", population: 10882965, label: { x: 317.9, y: 562.8 } },
  { uf: "RO", name: "Rondônia", region: "N", population: 1581196, label: { x: 166.7, y: 245.5 } },
  { uf: "RR", name: "Roraima", region: "N", population: 636707, label: { x: 193.3, y: 41.9 } },
  { uf: "SC", name: "Santa Catarina", region: "S", population: 7610361, label: { x: 377.6, y: 521.3 } },
  { uf: "SP", name: "São Paulo", region: "SE", population: 44411238, label: { x: 395.9, y: 429.3 } },
  { uf: "SE", name: "Sergipe", region: "NE", population: 2210004, label: { x: 572.7, y: 244.5 }, outside: 263 },
  { uf: "TO", name: "Tocantins", region: "N", population: 1511460, label: { x: 399.6, y: 252 } },
];

export const UF_BY_CODE = new Map(UFS.map((u) => [u.uf, u]));
export const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]));
export const BRAZIL_POPULATION = UFS.reduce((s, u) => s + u.population, 0);

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();
const BY_NAME = new Map(UFS.map((u) => [norm(u.name), u.uf]));

/** Converte "BR-SP", "SP", "br-sp" ou "São Paulo" na sigla da UF; undefined se não for estado brasileiro. */
export function toUf(code: string): string | undefined {
  const c = norm(code);
  const m = c.match(/^(?:BR[-_ ])?([A-Z]{2})$/);
  if (m && UF_BY_CODE.has(m[1])) return m[1];
  return BY_NAME.get(c);
}
