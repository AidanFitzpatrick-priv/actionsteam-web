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

type Overview = {
  total: number;
  withStatus: number;
  completed: number;
  pdNoShow: number;
  gangNoShow: number;
  pending: number;
  undated: number;
  completionPct: number;
  lastMonthTotal: number | null;
};

type StatsPayload = {
  tables: Record<string, Table>;
  month: MonthInfo | null;
  canViewTeam?: boolean;
  overview: Overview | null;
};

function monthLabel(m: MonthOption): string {
  const year = m.year ? ` ${m.year}` : "";
  const active = m.isActive ? " (active)" : "";
  return `${m.name}${year}${active}`;
}

function pct(n: number): string {
  const rounded = Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 1 : 0);
  return `${rounded}%`;
}

function StatusBars({ overview }: { overview: Overview }) {
  const items = [
    { label: "Completed", value: overview.completed, color: "var(--olive)" },
    { label: "Gang / org 1 no-show", value: overview.gangNoShow, color: "#fb7185" },
    { label: "PD / org 2 no-show", value: overview.pdNoShow, color: "#f0b429" }
  ];
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return <p className="muted">No finished actions for this month yet.</p>;
  }
  return (
    <div className="stat-bars">
      {items.map(item => (
        <div key={item.label} className="stat-bar-row">
          <div className="stat-bar-meta">
            <span>{item.label}</span>
            <strong>
              {item.value}
              {total ? ` · ${Math.round((item.value / total) * 100)}%` : ""}
            </strong>
          </div>
          <div className="stat-bar-track">
            <div
              className="stat-bar-fill"
              style={{
                width: `${(item.value / total) * 100}%`,
                background: item.color
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableCard({
  title,
  hint,
  table,
  empty
}: {
  title: string;
  hint?: string;
  table?: Table;
  empty: string;
}) {
  const rows = table?.rows ?? [];
  return (
    <article className="card stats-table-card">
      <h3>{title}</h3>
      {hint && <p className="stat-card-hint">{hint}</p>}
      {rows.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <div className="stats-table-wrap">
          <table className="table">
            <thead>
              <tr>{table!.headers.map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

function PairCard({
  title,
  hint,
  left,
  right
}: {
  title: string;
  hint?: string;
  left: { label: string; value: string; sub?: string };
  right: { label: string; value: string; sub?: string };
}) {
  return (
    <article className="card stats-table-card">
      <h3>{title}</h3>
      {hint && <p className="stat-card-hint">{hint}</p>}
      <div className="stat-split">
        <div>
          <p className="stat-card-label">{left.label}</p>
          <p className="stat-card-value">{left.value}</p>
          {left.sub && <p className="stat-card-sub">{left.sub}</p>}
        </div>
        <div>
          <p className="stat-card-label">{right.label}</p>
          <p className="stat-card-value">{right.value}</p>
          {right.sub && <p className="stat-card-sub">{right.sub}</p>}
        </div>
      </div>
    </article>
  );
}

export function StatsClient() {
  const [payload, setPayload] = useState<StatsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    let res: Response;
    try {
      res = await fetch(`/api/stats?${params}`);
    } catch {
      setError("Could not load stats.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setError(null);
      setPayload({
        tables: data.tables ?? {},
        month: data.month ?? null,
        canViewTeam: data.canViewTeam,
        overview: data.overview ?? null
      });
      if (data.month?.slug && !selectedSlug) {
        setSelectedSlug(data.month.slug);
      }
    } else {
      setError(typeof data.error === "string" ? data.error : "Could not load stats.");
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
    acceptOwnEventTypes: ["stats.updated", "admin.updated"],
    onEvent: ev => {
      if (ev.type === "stats.updated" || ev.type.startsWith("tracker.") || ev.type === "admin.updated") load();
    }
  });

  if (error && !payload) return <p className="error">{error}</p>;
  if (!payload) return <p className="muted">Loading stats…</p>;

  const { tables, month, overview } = payload;
  const canViewTeam = payload.canViewTeam === true;
  const winrate = tables.winrate;
  const avgMembers = tables.avgMembers;
  const org1 = winrate?.rows[0];
  const org2 = winrate?.rows[1];
  const pdAvg = avgMembers?.rows[0];
  const gangAvg = avgMembers?.rows[1];

  return (
    <div className="stats-page">
      <p className="eyebrow">This month</p>
      <h1>Action stats</h1>
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

      {overview && (
        <div className="stats-kpis">
          <article className="stat-card">
            <p className="stat-card-label">Actions logged</p>
            <p className="stat-card-value">{overview.total}</p>
            <p className="stat-card-sub">
              {overview.completed} completed
              {overview.lastMonthTotal != null ? ` · ${overview.lastMonthTotal} last month` : ""}
              {overview.undated > 0 ? ` · ${overview.undated} undated` : ""}
            </p>
          </article>
          <article className="stat-card">
            <p className="stat-card-label">Finished cleanly</p>
            <p className="stat-card-value">{pct(overview.completionPct)}</p>
            <p className="stat-card-sub">{overview.completed} completed</p>
          </article>
        </div>
      )}

      {overview && (
        <div className="stats-hero">
          <article className="goal-card goal-card-compact stats-status-card">
            <h3>How they finished</h3>
            <p className="stat-card-hint">Completed vs no-shows.</p>
            <StatusBars overview={overview} />
          </article>
        </div>
      )}

      <div className="stats-grid">
        <PairCard
          title="Win rate"
          hint="Of actions with a winner recorded."
          left={{
            label: "Org 1",
            value: org1 ? pct(Number(org1[2]) || 0) : "—",
            sub: org1 ? `${org1[1]} wins` : undefined
          }}
          right={{
            label: "Org 2 / PD",
            value: org2 ? pct(Number(org2[2]) || 0) : "—",
            sub: org2 ? `${org2[1]} wins` : undefined
          }}
        />
        <PairCard
          title="Average turnout"
          hint="Headcount when it was filled in."
          left={{
            label: "PD + Army",
            value: pdAvg ? String(pdAvg[1]) : "—",
            sub: "avg members"
          }}
          right={{
            label: "Gangs",
            value: gangAvg ? String(gangAvg[1]) : "—",
            sub: "avg members"
          }}
        />
        <TableCard
          title="Most played types"
          hint="What the month is actually running."
          table={tables.mostPlayed}
          empty="No action types recorded yet."
        />
        <TableCard
          title="Gang attendance"
          hint="Attended vs total for the month."
          table={tables.gangAttendance}
          empty="No gang attendance to show yet."
        />
      </div>

      {canViewTeam && (tables.monthlyStaffScores?.rows.length ?? 0) > 0 && (
        <TableCard
          title="Monthly staff scores"
          hint="Host +2, attend +1, for the selected month. Aux+ only."
          table={tables.monthlyStaffScores}
          empty="No staff scores for this month."
        />
      )}
    </div>
  );
}
