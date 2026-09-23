import { BRAZIL } from "./brazil";
import { MEXICO } from "./mexico";
import type { CountryDef, StateInfo } from "./types";

export type { CountryDef, RegionInfo, StateInfo } from "./types";
export { BRAZIL, MEXICO };

/** Países suportados, na ordem das abas. */
export const COUNTRIES: CountryDef[] = [BRAZIL, MEXICO];
export const COUNTRY_BY_ID = new Map(COUNTRIES.map((c) => [c.id, c]));

export const countryPopulation = (c: CountryDef) => c.states.reduce((s, x) => s + x.population, 0);
export const stateOf = (c: CountryDef, code: string): StateInfo | undefined => c.states.find((s) => s.code === code);
export const regionName = (c: CountryDef, id: string) => c.regions.find((r) => r.id === id)?.name ?? id;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

function lookup(c: CountryDef, key: string): string | undefined {
  if (c.states.some((s) => s.code === key)) return key;
  const alias = c.aliases?.[key];
  if (alias) return alias;
  return c.states.find((s) => norm(s.name) === key)?.code;
}

/**
 * Identifica país e estado a partir do iso_state_province_code do AMC ("BR-SP", "MX-CMX").
 * Sem prefixo, 2 letras é Brasil e 3 letras é México; nomes por extenso também são aceitos.
 */
export function resolveState(raw: string): { country: CountryDef; code: string } | undefined {
  const c = norm(raw);
  if (!c) return undefined;
  const pref = c.match(/^([A-Z]{2})[-_ ](.+)$/);
  if (pref) {
    const country = COUNTRY_BY_ID.get(pref[1]);
    const code = country && lookup(country, pref[2]);
    return country && code ? { country, code } : undefined;
  }
  if (/^[A-Z]{2}$/.test(c)) {
    const code = lookup(BRAZIL, c);
    return code ? { country: BRAZIL, code } : undefined;
  }
  if (/^[A-Z]{3}$/.test(c)) {
    const code = lookup(MEXICO, c);
    return code ? { country: MEXICO, code } : undefined;
  }
  for (const country of COUNTRIES) {
    const code = lookup(country, c);
    if (code) return { country, code };
  }
  return undefined;
}
