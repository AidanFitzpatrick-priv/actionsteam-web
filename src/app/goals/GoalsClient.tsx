"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveSync } from "@/hooks/useLiveSync";

export function GoalsClient({ kind }: { kind: "actions" | "bookings" }) {
  const [data, setData] = useState<{
    weekDates: string[];
    scores: Array<{ staffName: string; points: number[]; total: number }>;
  } | null>(null);
  const [selfUserId, setSelfUserId] = useState<string | undefined>();

  const load = useCallback(async () => {
    const res = await fetch(`/api/goals?kind=${kind}`);
    const json = await res.json();
    if (res.ok) setData(json);
  }, [kind]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => { if (d.user?.id) setSelfUserId(d.user.id); })
      .catch(() => {});
  }, []);

  useLiveSync({
    selfUserId,
    onEvent: ev => {
      if (ev.type === "goals.updated") load();
    }
  });

  if (!data) return <p className="muted">Loading…</p>;

  const dayLabels = data.weekDates.length === 7
    ? data.weekDates
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      <h1>{kind === "actions" ? "Action" : "Booking"} goal scores</h1>
      <p className="muted">Weekly Mon–Sun points. You see your row and everyone below your rank. Updates live.</p>
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
