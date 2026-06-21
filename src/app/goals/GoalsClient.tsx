"use client";

import { useCallback, useEffect, useState } from "react";

export function GoalsClient({ kind }: { kind: "actions" | "bookings" }) {
  const [data, setData] = useState<{
    weekDates: string[];
    scores: Array<{ staffName: string; points: number[]; total: number }>;
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/goals?kind=${kind}`);
    const json = await res.json();
    if (res.ok) setData(json);
  }, [kind]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <p className="muted">Loading…</p>;

  const dayLabels = data.weekDates.length === 7
    ? data.weekDates
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <h1>{kind === "actions" ? "Action" : "Booking"} goal scores</h1>
      <p className="muted">Weekly Mon–Sun points. Members see own row only.</p>
      <div className="card" style={{ marginTop: 16, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Staff</th>
              {dayLabels.map((d, i) => <th key={i}>{d}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.scores.map(s => (
              <tr key={s.staffName}>
                <td>{s.staffName}</td>
                {s.points.map((p, i) => <td key={i}>{p}</td>)}
                <td><strong>{s.total}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
