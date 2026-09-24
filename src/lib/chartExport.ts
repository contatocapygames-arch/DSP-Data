import { buildXlsx, type Table } from "./xlsx";

/** Tudo que um gráfico precisa entregar para ser baixado. */
export interface ChartExport {
  /** SVG completo, já no tema claro. */
  svg: () => SvgImage;
  /** Dados do gráfico para o Excel. */
  table: () => Table;
}

export interface SvgImage {
  markup: string;
  width: number;
  height: number;
}

export interface LegendItem {
  label: string;
  color: string;
}

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

export const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Executa `fn` com o site no tema claro (sem pintar a tela no meio), para os arquivos saírem sempre
 * com fundo branco, independente do tema de quem baixa.
 */
export function withLightTheme<T>(fn: () => T): T {
  const root = document.documentElement;
  const prev = root.getAttribute("data-theme");
  root.setAttribute("data-theme", "light");
  try {
    return fn();
  } finally {
    if (prev === null) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", prev);
  }
}

/** Lê tokens de cor do CSS (chame dentro de withLightTheme). */
export function token(name: string): string {
  return normalizeColor(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
}

/** Converte "color(srgb r g b / a)" (resultado de color-mix) em rgb(), que editores de SVG entendem. */
export function normalizeColor(v: string): string {
  const m = v.match(/^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.e-]+))?\)$/);
  if (!m) return v;
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => Math.round(Math.min(1, Math.max(0, Number(x))) * 255));
  return m[4] !== undefined && Number(m[4]) < 1 ? `rgba(${r}, ${g}, ${b}, ${Number(m[4])})` : `rgb(${r}, ${g}, ${b})`;
}

const STYLE_PROPS = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "opacity",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "visibility",
] as const;

/**
 * Copia um <svg> da página com os estilos calculados escritos em cada elemento
 * (o arquivo não depende do CSS do site). Devolve o conteúdo interno e as dimensões.
 */
export function serializeSvg(el: SVGSVGElement): SvgImage {
  const vb = el.viewBox.baseVal;
  const width = vb && vb.width ? vb.width : el.width.baseVal.value;
  const height = vb && vb.height ? vb.height : el.height.baseVal.value;
  const clone = el.cloneNode(true) as SVGSVGElement;
  const src = [el, ...el.querySelectorAll("*")];
  const dst = [clone, ...clone.querySelectorAll("*")];
  src.forEach((node, i) => {
    const cs = getComputedStyle(node);
    const target = dst[i] as SVGElement;
    target.removeAttribute("class");
    const style = STYLE_PROPS.map((p) => {
      const v = cs.getPropertyValue(p);
      return v ? `${p}:${normalizeColor(v)}` : "";
    })
      .filter(Boolean)
      .join(";");
    target.setAttribute("style", `${style};font-family:${FONT}`);
  });
  const inner = [...clone.childNodes].map((n) => new XMLSerializer().serializeToString(n)).join("");
  const offset = vb && vb.width ? `translate(${-vb.x} ${-vb.y})` : "";
  return { markup: `<g transform="${offset}">${inner}</g>`, width, height };
}

/**
 * Monta o arquivo final: fundo branco, título em cima, legenda embaixo (opcional) e o gráfico no meio.
 * `body` é o conteúdo do gráfico em coordenadas 0..width x 0..height.
 */
/** Largura aproximada de um texto (para layout do SVG gerado). */
const textW = (s: string, size = 12) => s.length * size * 0.56;

export function composeSvg(title: string, body: SvgImage, legend: LegendItem[] = [], subtitle?: string): SvgImage {
  const pad = 24;
  const titleH = subtitle ? 58 : 40;
  const width = Math.ceil(Math.max(body.width + pad * 2, 480));

  // Legenda em linhas que quebram na largura da imagem.
  const lines: { item: LegendItem; x: number; line: number }[] = [];
  let x = pad;
  let line = 0;
  for (const item of legend) {
    const w = 18 + textW(item.label) + 22;
    if (x > pad && x + w > width - pad) {
      x = pad;
      line++;
    }
    lines.push({ item, x, line });
    x += w;
  }
  const legendH = legend.length ? (line + 1) * 22 + 10 : 0;
  const height = Math.ceil(pad + titleH + body.height + legendH + pad);
  const bg = token("--surface") || "#ffffff";
  const ink = token("--text-primary") || "#0b0b0b";
  const muted = token("--text-secondary") || "#52514e";
  const legendTop = pad + titleH + body.height + 14;
  const legendMarkup = lines
    .map(
      ({ item, x: lx, line: ln }) =>
        `<rect x="${lx}" y="${legendTop + ln * 22}" width="12" height="12" rx="3" fill="${item.color}"/><text x="${lx + 18}" y="${
          legendTop + ln * 22 + 10
        }" font-size="12" fill="${muted}">${escapeXml(item.label)}</text>`,
    )
    .join("");
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family='${FONT}'>
<rect width="100%" height="100%" fill="${bg}"/>
<text x="${pad}" y="${pad + 18}" font-size="18" font-weight="650" fill="${ink}">${escapeXml(title)}</text>
${subtitle ? `<text x="${pad}" y="${pad + 40}" font-size="12" fill="${muted}">${escapeXml(subtitle)}</text>` : ""}
<g transform="translate(${pad + Math.max(0, (width - pad * 2 - body.width) / 2)} ${pad + titleH})">${body.markup}</g>
${legendMarkup}
</svg>`;
  return { markup, width, height };
}

export interface BarRow {
  label: string;
  /** Um ou mais valores; empilhados ou agrupados. */
  values: { value: number; color: string; valueLabel?: string }[];
  valueLabel?: string;
}

/** Barras horizontais em SVG puro (versão para download dos gráficos de barras em HTML). */
export function barsSvg(rows: BarRow[], layout: "stacked" | "grouped"): SvgImage {
  const labelW = Math.min(260, Math.max(80, ...rows.map((r) => textW(r.label))) + 12);
  const barW = 420;
  const valueW =
    Math.max(60, ...rows.flatMap((r) => [r.valueLabel ?? "", ...r.values.map((v) => v.valueLabel ?? "")].map((s) => textW(s)))) + 10;
  const groupN = layout === "grouped" ? Math.max(1, ...rows.map((r) => r.values.length)) : 1;
  const barH = layout === "grouped" ? 10 : 18;
  const rowH = layout === "grouped" ? groupN * (barH + 3) + 10 : 28;
  const fin = (v: number) => (Number.isFinite(v) ? Math.max(v, 0) : 0);
  const max =
    Math.max(
      0,
      ...rows.map((r) =>
        layout === "grouped" ? Math.max(0, ...r.values.map((v) => fin(v.value))) : r.values.reduce((s, v) => s + fin(v.value), 0),
      ),
    ) || 1;
  const ink = token("--text-primary");
  const muted = token("--text-secondary");
  const radius = 4;

  const bar = (x: number, y: number, w: number, h: number, color: string, roundEnd: boolean) =>
    roundEnd && w > radius
      ? `<path d="M${x},${y} H${x + w - radius} Q${x + w},${y} ${x + w},${y + radius} V${y + h - radius} Q${x + w},${y + h} ${x + w - radius},${y + h} H${x} Z" fill="${color}"/>`
      : `<rect x="${x}" y="${y}" width="${Math.max(w, 0)}" height="${h}" fill="${color}"/>`;

  const body = rows
    .map((r, i) => {
      const y0 = i * rowH;
      const label = `<text x="${labelW - 12}" y="${y0 + rowH / 2}" text-anchor="end" dominant-baseline="central" font-size="12" fill="${muted}">${escapeXml(r.label)}</text>`;
      if (layout === "grouped") {
        return (
          label +
          r.values
            .map((v, k) => {
              const y = y0 + 5 + k * (barH + 3);
              const w = (fin(v.value) / max) * barW;
              return (
                bar(labelW, y, Math.max(w, 2), barH, v.color, true) +
                `<text x="${labelW + w + 6}" y="${y + barH / 2}" dominant-baseline="central" font-size="11" fill="${ink}">${escapeXml(v.valueLabel ?? "")}</text>`
              );
            })
            .join("")
        );
      }
      let x = labelW;
      const y = y0 + (rowH - barH) / 2;
      const segs = r.values.filter((v) => fin(v.value) > 0);
      const parts = segs
        .map((v, k) => {
          const w = (fin(v.value) / max) * barW;
          const gap = k < segs.length - 1 ? 2 : 0;
          const out = bar(x, y, Math.max(w - gap, 1), barH, v.color, k === segs.length - 1);
          x += w;
          return out;
        })
        .join("");
      return (
        label +
        parts +
        `<text x="${x + 8}" y="${y + barH / 2}" dominant-baseline="central" font-size="12" fill="${ink}">${escapeXml(r.valueLabel ?? "")}</text>`
      );
    })
    .join("");
  return { markup: body, width: labelW + barW + valueW, height: rows.length * rowH };
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "grafico";

function save(blob: Blob, fileName: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function downloadSvg(name: string, img: SvgImage) {
  save(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${img.markup}`], { type: "image/svg+xml" }), `${slug(name)}.svg`);
}

/** Rasteriza o SVG em 2x (nítido em slides e telas retina). */
export async function downloadPng(name: string, img: SvgImage, scale = 2) {
  const url = URL.createObjectURL(new Blob([img.markup], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Não foi possível gerar a imagem."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(img.width * scale);
    canvas.height = Math.ceil(img.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0, img.width, img.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) save(blob, `${slug(name)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadXlsx(name: string, table: Table) {
  save(
    new Blob([buildXlsx(table, name) as Uint8Array<ArrayBuffer>], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${slug(name)}.xlsx`,
  );
}

function parseColor(c: string): [number, number, number] {
  const hex = c.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)) as [number, number, number];
  const rgb = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return [0, 0, 0];
}

/** Equivalente a color-mix(in srgb, a pct%, b), para cores que precisam ir para o arquivo. */
export function mixColor(a: string, b: string, pct: number): string {
  const [x, y] = [parseColor(a), parseColor(b)];
  const m = x.map((v, i) => Math.round((v * pct + y[i] * (100 - pct)) / 100));
  return `rgb(${m[0]}, ${m[1]}, ${m[2]})`;
}
