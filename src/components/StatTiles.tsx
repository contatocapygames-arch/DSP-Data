export interface Stat {
  label: string;
  value: string;
  note?: string;
}

export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <div className="stat-tiles">
      {stats.map((s) => (
        <div className="stat-tile" key={s.label}>
          <span className="stat-label">{s.label}</span>
          <span className="stat-value">{s.value}</span>
          {s.note && <span className="stat-note">{s.note}</span>}
        </div>
      ))}
    </div>
  );
}
