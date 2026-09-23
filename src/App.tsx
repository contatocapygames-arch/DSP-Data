import { useEffect, useState } from "react";
import { CsvUpload } from "./components/CsvUpload";
import { QueryBlock } from "./components/QueryBlock";
import { parseCsv } from "./lib/csv";
import { findReport, REPORTS } from "./reports/registry";
import { ReportParseError, type ProcessedReport, type ReportDefinition } from "./reports/types";

/** Roteamento por hash (#/report/<id>) para funcionar no GitHub Pages sem config de servidor. */
function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash.replace(/^#\/?/, "");
}

export default function App() {
  const route = useHashRoute();
  const reportId = route.startsWith("report/") ? route.slice("report/".length) : null;
  const report = reportId ? findReport(reportId) : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand">
          <span className="brand-mark" aria-hidden />
          AMC Reports
        </a>
      </header>
      <main>{report ? <ReportPage key={report.id} report={report} /> : <Home notFound={!!reportId} />}</main>
    </div>
  );
}

function Home({ notFound }: { notFound: boolean }) {
  return (
    <>
      <section className="hero">
        <h1>Reports do Amazon Marketing Cloud</h1>
        <p>Escolha um report, rode a query no AMC, exporte o resultado em CSV e suba aqui para ver gráficos e análises.</p>
      </section>
      {notFound && <p className="error">Report não encontrado.</p>}
      <div className="report-grid">
        {REPORTS.map((r) => (
          <a key={r.id} href={`#/report/${r.id}`} className="report-card">
            <h2>{r.title}</h2>
            <p>{r.summary}</p>
            <span className="tags">
              {r.sources.map((s) => (
                <code key={s}>{s}</code>
              ))}
            </span>
          </a>
        ))}
      </div>
    </>
  );
}

function ReportPage({ report }: { report: ReportDefinition }) {
  const [result, setResult] = useState<{ fileName: string; processed: ProcessedReport } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = (text: string, fileName: string) => {
    try {
      setResult({ fileName, processed: report.process(parseCsv(text)) });
      setError(null);
    } catch (e) {
      setResult(null);
      setError(e instanceof ReportParseError ? e.message : `Não foi possível ler o arquivo: ${String(e)}`);
    }
  };

  return (
    <>
      <nav className="crumbs">
        <a href="#/">Reports</a> / <span>{report.title}</span>
      </nav>
      <section className="hero">
        <h1>{report.title}</h1>
        <p>{report.description}</p>
      </section>

      {!result && (
        <ol className="steps">
          <li>
            {report.query ? (
              <>
                <h2>Rode esta query no AMC</h2>
                <p>
                  Cole no editor de queries do AMC e defina o período na própria interface do AMC. Exporte o resultado como CSV sem renomear as
                  colunas.
                </p>
                <QueryBlock query={report.query} />
              </>
            ) : (
              <>
                <h2>Rode o template no AMC</h2>
                <p>{report.instructions}</p>
              </>
            )}
          </li>
          <li>
            <h2>Suba o CSV do resultado</h2>
            <p>
              Colunas esperadas:{" "}
              {report.expectedColumns.map((c, i) => (
                <span key={c}>
                  {i > 0 && ", "}
                  <code>{c}</code>
                </span>
              ))}
            </p>
            <CsvUpload onFile={onFile} sampleUrl={`samples/${report.id}.csv`} />
            {error && <p className="error">{error}</p>}
          </li>
        </ol>
      )}

      {result && (
        <>
          <div className="file-bar">
            <span>
              Arquivo: <strong>{result.fileName}</strong>
            </span>
            <span className="file-actions">
              {report.query && (
                <details>
                  <summary className="btn ghost">Ver query</summary>
                  <QueryBlock query={report.query} />
                </details>
              )}
              <button type="button" className="btn" onClick={() => setResult(null)}>
                Trocar arquivo
              </button>
            </span>
          </div>
          {result.processed.warnings.length > 0 && (
            <ul className="warnings">
              {result.processed.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          {result.processed.render()}
        </>
      )}
    </>
  );
}
