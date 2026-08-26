"use client";

import { useCallback, useEffect, useState } from "react";
import { initials, type LeaderboardRow } from "@/lib/leaderboard";
import { useLiveSync } from "@/hooks/useLiveSync";

type PeriodKey = "week" | "month" | "allTime";

type Period = {
  label: string;
  rows: LeaderboardRow[];
};

type Payload = {
  week: Period;
  month: Period;
  allTime: Period;
};

const RANGES: { id: PeriodKey; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "allTime", label: "All time" }
];

export function LeaderboardClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [range, setRange] = useState<PeriodKey>("week");
  const [error, setError] = useState("");
  const [selfUserId, setSelfUserId] = useState<string | undefined>();

  const load = useCallback(async () => {
    const res = await fetch("/api/leaderboard");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Could not load leaderboard");
      return;
    }
    setError("");
    setData(json);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d.user?.id) setSelfUserId(d.user.id);
      })
      .catch(() => {});
  }, []);

  useLiveSync({
    selfUserId,
    acceptOwnEventTypes: ["goals.updated", "tracker.updated", "tracker.added", "tracker.deleted"],
    onEvent: ev => {
      if (
        ev.type === "goals.updated" ||
        ev.type === "tracker.updated" ||
        ev.type === "tracker.added" ||
        ev.type === "tracker.deleted"
      ) {
        load();
      }
    }
  });

  if (!data && !error) return <p className="muted">Loading…</p>;

  const period = data?.[range];
  const rows = period?.rows ?? [];
  const scored = rows.filter(r => r.count > 0);
  const top = scored.slice(0, 3);
  const podium = [top[1], top[0], top[2]].filter(Boolean);

  return (
    <section className="leaderboard-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Action leaderboard</p>
          <h1>Who has attended the most</h1>
        </div>
        <div className="range-toggle" role="tablist" aria-label="Leaderboard period">
          {RANGES.map(r => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={range === r.id}
              className={range === r.id ? "on" : ""}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      {podium.length > 0 && (
        <div className="podium">
          {podium.map(row => (
            <article key={row.name} className={`podium-card rank-${row.rank}`}>
              <span className="avatar lg" aria-hidden>
                {initials(row.name)}
              </span>
              <p>{row.name}</p>
              <strong className="points">{row.count}</strong>
              <span>#{row.rank}</span>
            </article>
          ))}
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  No action-takers to rank yet.
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.name}>
                  <td>{String(row.rank).padStart(2, "0")}</td>
                  <td>
                    <div className="op">
                      <span className="avatar" aria-hidden>
                        {initials(row.name)}
                      </span>
                      {row.name}
                    </div>
                  </td>
                  <td>{row.count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
