/** Caminho como sequência de chips; os pontos do grupo do filtro ficam destacados. */
export function PathChips({ steps, matched, ordered = true }: { steps: string[]; matched: Set<string>; ordered?: boolean }) {
  return (
    <span className="path-chips" title={steps.join(ordered ? " → " : " + ")}>
      {steps.map((s, i) => (
        <span key={i} className="path-step">
          {i > 0 && <span className="path-sep">{ordered ? "→" : "+"}</span>}
          <span className={`touch-chip small ${matched.has(s) ? "in" : ""}`}>{s}</span>
        </span>
      ))}
    </span>
  );
}
