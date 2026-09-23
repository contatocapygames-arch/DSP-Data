import type { Map as SvgMap } from "svg-maps__common";

export interface Point {
  x: number;
  y: number;
}

export interface RegionInfo {
  id: string;
  name: string;
  /** Posição do nome da região no mapa (coordenadas do viewBox). */
  label: Point;
}

export interface StateInfo {
  /** Código do estado sem o prefixo do país (SP, CMX...). Igual ao id do mapa em maiúsculas. */
  code: string;
  name: string;
  region: string;
  population: number;
  /** Ponto interno do estado para o rótulo. */
  label: Point;
  /** Estados pequenos: rótulo fora do mapa, ligado por uma linha. */
  outside?: Point & { anchor: "start" | "end" };
}

export interface CountryDef {
  /** ISO 3166-1 alfa-2. */
  id: string;
  name: string;
  currency: string;
  /** Símbolo curto usado nos valores compactos. */
  currencySymbol: string;
  map: SvgMap;
  /** Largura do desenho, incluindo a área dos rótulos externos. */
  width: number;
  height: number;
  states: StateInfo[];
  regions: RegionInfo[];
  /** Texto de fonte para população, regiões e mapa (rodapé). */
  sources: string;
  /** Nomes alternativos dos estados (sem acento, maiúsculos) para o código. */
  aliases?: Record<string, string>;
}
