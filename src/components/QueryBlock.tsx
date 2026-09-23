import { useState } from "react";

export function QueryBlock({ query }: { query: string }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(query);
    } catch {
      // Fallback para contextos sem Clipboard API (http, iframes).
      const ta = document.createElement("textarea");
      ta.value = query;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`query-block ${open ? "open" : ""}`}>
      <div className="query-toolbar">
        <span className="query-lang">SQL · AMC</span>
        <div className="query-actions">
          <button type="button" className="btn ghost" onClick={() => setOpen((o) => !o)}>
            {open ? "Recolher" : "Expandir"}
          </button>
          <button type="button" className="btn" onClick={copy}>
            {copied ? "Copiada ✓" : "Copiar query"}
          </button>
        </div>
      </div>
      <pre>
        <code>{query}</code>
      </pre>
    </div>
  );
}
