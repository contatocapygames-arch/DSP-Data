import { useRef, useState, type DragEvent } from "react";

interface Props {
  onFile: (text: string, fileName: string) => void;
  sampleUrl?: string;
}

export function CsvUpload({ onFile, sampleUrl }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) {
      setError("Envie o arquivo .csv exportado do AMC.");
      return;
    }
    onFile(await file.text(), file.name);
  };

  const loadSample = async () => {
    if (!sampleUrl) return;
    const res = await fetch(sampleUrl);
    onFile(await res.text(), "exemplo.csv");
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void read(e.dataTransfer.files[0]);
  };

  return (
    <div>
      <div
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
      >
        <strong>Arraste o CSV aqui</strong>
        <span>ou clique para escolher o arquivo</span>
        <input
          ref={input}
          type="file"
          accept=".csv,.txt,.tsv,text/csv"
          hidden
          onChange={(e) => {
            void read(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      <p className="hint">
        O arquivo é processado só no seu navegador; nada é enviado para servidor.
        {sampleUrl && (
          <>
            {" "}
            <button type="button" className="link" onClick={loadSample}>
              Ver com dados de exemplo
            </button>
          </>
        )}
      </p>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
