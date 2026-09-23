import brazilMap from "@svg-maps/brazil";
import type { CountryDef, StateInfo } from "./types";

const OUT = 628;
const out = (y: number) => ({ x: OUT, y, anchor: "start" as const });

// População: IBGE, Censo 2022. Rótulos: ponto interno de cada estado no viewBox do mapa (613 x 639).
const STATES: StateInfo[] = [
  { code: "AC", name: "Acre", region: "N", population: 830018, label: { x: 38.6, y: 220.2 } },
  { code: "AL", name: "Alagoas", region: "NE", population: 3127683, label: { x: 585.8, y: 234.5 }, outside: out(238) },
  { code: "AP", name: "Amapá", region: "N", population: 733759, label: { x: 346.2, y: 63 } },
  { code: "AM", name: "Amazonas", region: "N", population: 3941613, label: { x: 130.4, y: 154 } },
  { code: "BA", name: "Bahia", region: "NE", population: 14141626, label: { x: 504.5, y: 272.3 } },
  { code: "CE", name: "Ceará", region: "NE", population: 8794957, label: { x: 539.1, y: 159.6 } },
  { code: "DF", name: "Distrito Federal", region: "CO", population: 2817381, label: { x: 406.8, y: 329.4 }, outside: out(318) },
  { code: "ES", name: "Espírito Santo", region: "SE", population: 3833712, label: { x: 525.8, y: 375.4 }, outside: out(372) },
  { code: "GO", name: "Goiás", region: "CO", population: 7056495, label: { x: 370.2, y: 350 } },
  { code: "MA", name: "Maranhão", region: "NE", population: 6776699, label: { x: 448.5, y: 161.3 } },
  { code: "MT", name: "Mato Grosso", region: "CO", population: 3658649, label: { x: 288.4, y: 292.7 } },
  { code: "MS", name: "Mato Grosso do Sul", region: "CO", population: 2757013, label: { x: 304, y: 405.9 } },
  { code: "MG", name: "Minas Gerais", region: "SE", population: 20539989, label: { x: 463.5, y: 376.2 } },
  { code: "PA", name: "Pará", region: "N", population: 8120131, label: { x: 328.7, y: 164.8 } },
  { code: "PB", name: "Paraíba", region: "NE", population: 3974687, label: { x: 593.7, y: 192.1 }, outside: out(188) },
  { code: "PR", name: "Paraná", region: "S", population: 11444380, label: { x: 343.7, y: 474.1 } },
  { code: "PE", name: "Pernambuco", region: "NE", population: 9058931, label: { x: 533.5, y: 206.7 }, outside: out(213) },
  { code: "PI", name: "Piauí", region: "NE", population: 3271199, label: { x: 501.4, y: 197 } },
  { code: "RJ", name: "Rio de Janeiro", region: "SE", population: 16055174, label: { x: 489.6, y: 439 }, outside: out(440) },
  { code: "RN", name: "Rio Grande do Norte", region: "NE", population: 3302729, label: { x: 581.1, y: 171.6 }, outside: out(163) },
  { code: "RS", name: "Rio Grande do Sul", region: "S", population: 10882965, label: { x: 317.9, y: 562.8 } },
  { code: "RO", name: "Rondônia", region: "N", population: 1581196, label: { x: 166.7, y: 245.5 } },
  { code: "RR", name: "Roraima", region: "N", population: 636707, label: { x: 193.3, y: 41.9 } },
  { code: "SC", name: "Santa Catarina", region: "S", population: 7610361, label: { x: 377.6, y: 521.3 } },
  { code: "SP", name: "São Paulo", region: "SE", population: 44411238, label: { x: 395.9, y: 429.3 } },
  { code: "SE", name: "Sergipe", region: "NE", population: 2210004, label: { x: 572.7, y: 244.5 }, outside: out(263) },
  { code: "TO", name: "Tocantins", region: "N", population: 1511460, label: { x: 399.6, y: 252 } },
];

export const BRAZIL: CountryDef = {
  id: "BR",
  name: "Brasil",
  currency: "BRL",
  currencySymbol: "R$",
  map: brazilMap,
  width: 690,
  height: 639,
  states: STATES,
  regions: [
    { id: "N", name: "Norte", label: { x: 245, y: 150 } },
    { id: "NE", name: "Nordeste", label: { x: 500, y: 215 } },
    { id: "CO", name: "Centro-Oeste", label: { x: 318, y: 335 } },
    { id: "SE", name: "Sudeste", label: { x: 462, y: 405 } },
    { id: "S", name: "Sul", label: { x: 345, y: 525 } },
  ],
  sources: "População: IBGE, Censo 2022. Mapa: @svg-maps/brazil (Victor Cazanave, CC BY 4.0).",
};
