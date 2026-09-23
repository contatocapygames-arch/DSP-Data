import mexicoMap from "@svg-maps/mexico";
import type { CountryDef, StateInfo } from "./types";

// Rótulos externos: estados do centro à direita, no Golfo; Aguascalientes e Colima à esquerda, no Pacífico.
const gulf = (y: number) => ({ x: 610, y, anchor: "start" as const });
const pacific = (x: number, y: number) => ({ x, y, anchor: "end" as const });

// População: INEGI, Censo 2020. Regiões: as quatro regiões econômicas do Banco de México.
// Rótulos: ponto interno de cada estado no viewBox do mapa (793 x 498).
const STATES: StateInfo[] = [
  { code: "AGU", name: "Aguascalientes", region: "CN", population: 1425607, label: { x: 400.3, y: 301.5 }, outside: pacific(300, 318) },
  { code: "BCN", name: "Baja California", region: "NO", population: 3769020, label: { x: 63.5, y: 23.6 } },
  { code: "BCS", name: "Baja California Sur", region: "CN", population: 798447, label: { x: 127.5, y: 155.2 } },
  { code: "CAM", name: "Campeche", region: "SU", population: 928363, label: { x: 709, y: 386 } },
  { code: "CHP", name: "Chiapas", region: "SU", population: 5543828, label: { x: 637.6, y: 446.7 } },
  { code: "CHH", name: "Chihuahua", region: "NO", population: 3741869, label: { x: 299.9, y: 115.8 } },
  { code: "COA", name: "Coahuila", region: "NO", population: 3146771, label: { x: 404.5, y: 138.1 } },
  { code: "COL", name: "Colima", region: "CN", population: 731391, label: { x: 362.6, y: 377.7 }, outside: pacific(330, 410) },
  { code: "DUR", name: "Durango", region: "CN", population: 1832650, label: { x: 333.3, y: 214.6 } },
  { code: "GUA", name: "Guanajuato", region: "CE", population: 6166934, label: { x: 428.9, y: 331.2 } },
  { code: "GRO", name: "Guerrero", region: "SU", population: 3540685, label: { x: 467.9, y: 413 } },
  { code: "HID", name: "Hidalgo", region: "CE", population: 3082841, label: { x: 484.3, y: 338.6 }, outside: gulf(258) },
  { code: "JAL", name: "Jalisco", region: "CN", population: 8348151, label: { x: 355.5, y: 352.6 } },
  { code: "CMX", name: "Ciudad de México", region: "CE", population: 9209944, label: { x: 482, y: 375 }, outside: gulf(298) },
  { code: "MEX", name: "Estado de México", region: "CE", population: 16992418, label: { x: 465.7, y: 370.9 }, outside: gulf(278) },
  { code: "MIC", name: "Michoacán", region: "CN", population: 4748846, label: { x: 424.1, y: 373 } },
  { code: "MOR", name: "Morelos", region: "CE", population: 1971520, label: { x: 484, y: 387.4 }, outside: gulf(338) },
  { code: "NAY", name: "Nayarit", region: "CN", population: 1235456, label: { x: 333.5, y: 299.7 } },
  { code: "NLE", name: "Nuevo León", region: "NO", population: 5784442, label: { x: 466.5, y: 202.2 } },
  { code: "OAX", name: "Oaxaca", region: "SU", population: 4132148, label: { x: 539.1, y: 432.1 } },
  { code: "PUE", name: "Puebla", region: "CE", population: 6583278, label: { x: 510.9, y: 389 } },
  { code: "QUE", name: "Querétaro", region: "CE", population: 2368467, label: { x: 455.7, y: 338.5 }, outside: gulf(238) },
  { code: "ROO", name: "Quintana Roo", region: "SU", population: 1857985, label: { x: 751.8, y: 368.1 } },
  { code: "SLP", name: "San Luis Potosí", region: "CN", population: 2822255, label: { x: 445.6, y: 289.9 } },
  { code: "SIN", name: "Sinaloa", region: "CN", population: 3026943, label: { x: 250.5, y: 192.7 } },
  { code: "SON", name: "Sonora", region: "NO", population: 2944840, label: { x: 201.1, y: 89.6 } },
  { code: "TAB", name: "Tabasco", region: "SU", population: 2402598, label: { x: 643.6, y: 406.2 } },
  { code: "TAM", name: "Tamaulipas", region: "NO", population: 3527735, label: { x: 491.7, y: 266.1 } },
  { code: "TLA", name: "Tlaxcala", region: "CE", population: 1342977, label: { x: 506.3, y: 369.2 }, outside: gulf(318) },
  { code: "VER", name: "Veracruz", region: "SU", population: 8062579, label: { x: 577.4, y: 401.4 } },
  { code: "YUC", name: "Yucatán", region: "SU", population: 2320898, label: { x: 728.8, y: 337.7 } },
  { code: "ZAC", name: "Zacatecas", region: "CN", population: 1622138, label: { x: 380.2, y: 272.1 } },
];

export const MEXICO: CountryDef = {
  id: "MX",
  name: "México",
  currency: "MXN",
  currencySymbol: "MX$",
  map: mexicoMap,
  width: 793,
  height: 498,
  states: STATES,
  regions: [
    { id: "NO", name: "Norte", label: { x: 330, y: 130 } },
    { id: "CN", name: "Centro Norte", label: { x: 370, y: 250 } },
    { id: "CE", name: "Centro", label: { x: 472, y: 356 } },
    { id: "SU", name: "Sur", label: { x: 640, y: 425 } },
  ],
  sources:
    "População: INEGI, Censo 2020. Regiões: regiões econômicas do Banco de México. Mapa: @svg-maps/mexico (Victor Cazanave, CC BY 4.0).",
  // Código antigo da capital (Distrito Federal) e nomes comuns.
  aliases: { DIF: "CMX", "MEXICO CITY": "CMX", CDMX: "CMX", "DISTRITO FEDERAL": "CMX", MEXICO: "MEX", "EDO. DE MEXICO": "MEX" },
};
