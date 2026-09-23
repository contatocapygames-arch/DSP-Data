// Tipos que o pacote @svg-maps/brazil referencia mas não publica.
declare module "svg-maps__common" {
  export interface Location {
    id: string;
    name: string;
    path: string;
  }
  export interface Map {
    label: string;
    viewBox: string;
    locations: Location[];
  }
}
