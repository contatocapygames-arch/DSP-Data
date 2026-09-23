# DSP-Data · AMC Reports

Site para analisar resultados de queries do Amazon Marketing Cloud (AMC). Cada report tem uma página com:

1. a query SQL pronta para copiar e rodar no AMC;
2. um upload do CSV exportado;
3. um dashboard com gráficos, insights e tabelas calculados a partir do CSV.

O CSV é processado inteiramente no navegador; nenhum dado sai da máquina de quem usa.

## Reports disponíveis

| Report | Tabela AMC | O que mostra |
|---|---|---|
| Overlap entre anunciantes | `dsp_impressions` | Alcance exclusivo x compartilhado por anunciante, usuários por nº de anunciantes vistos, matriz de sobreposição entre pares (% e usuários, com Jaccard), gráfico UpSet das combinações exatas, tabela de combinações e de campanhas. |

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

## Adicionando um report novo

1. Crie `src/reports/<nome>/` com:
   - `query.ts`: a query do AMC;
   - `analyze.ts`: leitura das colunas do CSV (`parseCsv`, `columnIndex`, `parseArrayCell`) e os cálculos;
   - `Dashboard.tsx`: os gráficos (reaproveite `BarList`, `Heatmap`, `UpSet`, `StatTiles`, `DataTable`);
   - `index.tsx`: um `ReportDefinition` ligando tudo.
2. Registre em `src/reports/registry.ts`.
3. Opcional: coloque um CSV de exemplo em `public/samples/<id>.csv` para o botão "Ver com dados de exemplo".
