"use client";

import { useCallback, useEffect, useState } from "react";

type Table = { headers: string[]; rows: (string | number)[][] };

export function StatsClient() {
  const [tables, setTables] = useState<Record<string, Table> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/stats?all=1");
    const data = await res.json();
    if (res.ok) setTables(data.tables);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!tables) return <p className="muted">Loading stats…</p>;

  const keys = ["winrate", "avgMembers", "statusPct", "mostPlayed", "gangAttendance", "monthlyStaffScores"] as const;

  return (
    <div>
      <h1>Action Stats</h1>
      <p className="muted">Gang attendance Total only counts rows with Status set. Refreshes after tracker edits (~2.5s).</p>
      <div className="grid-2" style={{ marginTop: 24 }}>
        {keys.map(key => {
          const t = tables[key];
          if (!t) return null;
          return (
            <div className="card" key={key}>
              <table className="table">
                <thead>
                  <tr>{t.headers.map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {t.rows.map((row, i) => (
                    <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}
