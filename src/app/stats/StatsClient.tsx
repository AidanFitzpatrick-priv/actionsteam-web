"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveSync } from "@/hooks/useLiveSync";

type Table = { headers: string[]; rows: (string | number)[][] };

type MonthOption = {
  id: string;
  name: string;
  slug: string;
  year: number | null;
  isActive: boolean;
};

type MonthInfo = {
  name: string;
  slug: string;
  year: number | null;
  isActive: boolean;
};

function monthLabel(m: MonthOption): string {
  const year = m.year ? ` ${m.year}` : "";
  const active = m.isActive ? " (active)" : "";
  return `${m.name}${year}${active}`;
}

function monthTitle(month: MonthInfo): string {
  return month.year ? `${month.name} ${month.year}` : month.name;
}

export function StatsClient() {
  const [tables, setTables] = useState<Record<string, Table> | null>(null);
  const [month, setMonth] = useState<MonthInfo | null>(null);
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [selfUserId, setSelfUserId] = useState<string | undefined>();

  useEffect(() => {
    fetch("/api/months")
      .then(r => r.json())
      .then(json => {
        if (json.months) {
          setMonths(json.months);
          const active = json.months.find((m: MonthOption) => m.isActive);
          setSelectedSlug(prev => prev || active?.slug || json.months[0]?.slug || "");
        }
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedSlug) params.set("month", selectedSlug);
    const res = await fetch(`/api/stats?${params}`);
    const data = await res.json();
    if (res.ok) {
      setTables(data.tables ?? {});
      setMonth(data.month ?? null);
      if (data.month?.slug && !selectedSlug) {
        setSelectedSlug(data.month.slug);
      }
    }
  }, [selectedSlug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => { if (d.user?.id) setSelfUserId(d.user.id); })
      .catch(() => {});
  }, []);

  useLiveSync({
    selfUserId,
    acceptOwnEventTypes: ["stats.updated"],
    onEvent: ev => {
      if (ev.type === "stats.updated" || ev.type.startsWith("tracker.")) load();
    }
  });

  if (!tables) return <p className="muted">Loading stats…</p>;

  const keys = ["winrate", "avgMembers", "statusPct", "mostPlayed", "gangAttendance", "monthlyStaffScores"] as const;

  return (
    <div>
      <h1>Action Stats</h1>
      {months.length > 0 && (
        <div className="field" style={{ maxWidth: 280, marginTop: 12 }}>
          <label htmlFor="stats-month">Month</label>
          <select
            id="stats-month"
            className="select"
            value={selectedSlug}
            onChange={e => setSelectedSlug(e.target.value)}
          >
            {months.map(m => (
              <option key={m.slug} value={m.slug}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="muted">
        {month ? (
          <>
            Stats for <strong>{monthTitle(month)}</strong>
            {!month.isActive && " (not the active month)"}.
          </>
        ) : (
          "No active month."
        )}{" "}
        Gang attendance Total only counts rows with Status set. Updates live when the tracker changes.
      </p>
      <div className="grid-2" style={{ marginTop: 24 }}>
        {keys.map(key => {
          const t = tables[key];
          if (!t || t.rows.length === 0) return null;
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
