# DSP-Data · AMC Reports

Site para analisar resultados de queries do Amazon Marketing Cloud (AMC). Cada report tem uma página com:

1. a query SQL pronta para copiar e rodar no AMC;
2. um upload do CSV exportado;
3. um dashboard com gráficos, insights e tabelas calculados a partir do CSV.

O CSV é processado inteiramente no navegador; nenhum dado sai da máquina de quem usa.

## Reports disponíveis

| Report | Tabela AMC | O que mostra |
|---|---|---|
| Overlap entre anunciantes | `dsp_impressions` | Alcance exclusivo x compartilhado por anunciante, usuários por nº de anunciantes vistos, matriz de sobreposição entre pares (% e usuários, com Jaccard), diagrama de Venn com até 3 anunciantes à escolha, gráfico UpSet das combinações exatas, tabela de combinações e de campanhas. |
| Path to Conversion | Template "Path to Conversion by Campaign Groups" | Filtro de texto que separa um grupo de pontos de contato (ex.: contém "DSP") e gera a planilha Full funnel / Só grupo / Sem grupo / Todos os outros sem grupo / demais permutações (download em CSV para Excel), taxa de compra com e sem cada ponto, primeiro e último toque, tamanho do caminho, sequência entre pontos, tabela de permutações e uma aba dedicada a NTB (aquisição de novos clientes). |
| Vendas por estado | `amazon_attributed_events_by_conversion_time` | Uma aba por país com dados no CSV (Brasil e México). Mapa por estado ou região (R$, pedidos, NTB, ticket, % do total, vendas por mil habitantes, índice vs população), ranking, tabela por região, concentração das vendas, índice vs população (IBGE, Censo 2022 / INEGI, Censo 2020), ticket médio e % NTB por estado, anunciantes x região e tabela completa. |

## Rodando localmente

```bash
npm install
npm run dev      # servidor de desenvolvimento
npm test         # testes (vitest)
npm run build    # build de produção em dist/
```

## Deploy

O workflow `.github/workflows/deploy-pages.yml` publica no GitHub Pages a cada push em `main`
(é preciso habilitar Pages com a fonte "GitHub Actions" nas configurações do repositório).

## Padrão dos gráficos

Todo gráfico do site tem o menu **Baixar** com três formatos:

- **PNG** em 2x, para slides;
- **SVG** vetorial, editável no PowerPoint, Illustrator ou Figma;
- **Excel (.xlsx)** com os números por trás do gráfico.

Os arquivos saem sempre no tema claro, com o título do gráfico e a legenda, mesmo que a pessoa esteja usando o site no modo escuro.

Isso vale para todos os reports, inclusive os novos: os componentes de gráfico (`BarList`, `IndexBars`, `Heatmap`, `UpSet`, `Venn`,
`CountryMap`) exigem a prop `exportAs` (título do arquivo) e não compilam sem ela. Um gráfico novo que não use esses componentes deve
usar `ExportMenu` com um `ChartExport` (`src/lib/chartExport.ts`).

## Adicionando um report novo

1. Crie `src/reports/<nome>/` com:
   - `query.ts`: a query do AMC (ou `instructions` no `ReportDefinition`, quando o report vem de um template do AMC);
   - `analyze.ts`: leitura das colunas do CSV (`parseCsv`, `columnIndex`, `parseArrayCell`) e os cálculos;
   - `Dashboard.tsx`: os gráficos (reaproveite `BarList`, `Heatmap`, `UpSet`, `StatTiles`, `DataTable`);
   - `index.tsx`: um `ReportDefinition` ligando tudo.
2. Registre em `src/reports/registry.ts`.
3. Opcional: coloque um CSV de exemplo em `public/samples/<id>.csv` para o botão "Ver com dados de exemplo".
