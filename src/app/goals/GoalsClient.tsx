"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import type { UserRole } from "@prisma/client";
import { GOAL_TRACKER_ROLE_GROUPS } from "@/lib/rbac";
import { goalMet } from "@/lib/goals";
import { useLiveSync } from "@/hooks/useLiveSync";

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Mon–Sun headers: show date when in month, otherwise weekday label. */
function weekColumnLabels(weekDates: string[]): { label: string; hasDate: boolean }[] {
  if (weekDates.length !== 7) {
    return WEEKDAY_SHORT.map(label => ({ label, hasDate: false }));
  }
  return weekDates.map((d, i) => {
    const trimmed = d.trim();
    return trimmed
      ? { label: trimmed, hasDate: true }
      : { label: WEEKDAY_SHORT[i], hasDate: false };
  });
}

type MonthOption = {
  id: string;
  name: string;
  slug: string;
  year: number | null;
  isActive: boolean;
};

type ScoreRow = {
  staffName: string;
  role: UserRole;
  points: number[];
  total: number;
};

function monthLabel(m: MonthOption): string {
  const year = m.year ? ` ${m.year}` : "";
  const active = m.isActive ? " (active)" : "";
  return `${m.name}${year}${active}`;
}

export function GoalsClient({ monthPicker = false }: { monthPicker?: boolean }) {
  const [data, setData] = useState<{
    weekDates: string[];
    scores: ScoreRow[];
    month?: { name: string; slug: string; isActive: boolean } | null;
  } | null>(null);
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [selfUserId, setSelfUserId] = useState<string | undefined>();

  useEffect(() => {
    if (!monthPicker) return;
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
  }, [monthPicker]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ kind: "actions" });
    if (monthPicker && selectedSlug) params.set("month", selectedSlug);
    const res = await fetch(`/api/goals?${params}`);
    const json = await res.json();
    if (res.ok) {
      setData(json);
      if (monthPicker && json.month?.slug && !selectedSlug) {
        setSelectedSlug(json.month.slug);
      }
    }
  }, [monthPicker, selectedSlug]);

  useEffect(() => {
    if (monthPicker && !selectedSlug) return;
    load();
  }, [load, monthPicker, selectedSlug]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => { if (d.user?.id) setSelfUserId(d.user.id); })
      .catch(() => {});
  }, []);

  useLiveSync({
    selfUserId,
    acceptOwnEventTypes: ["goals.updated"],
    onEvent: ev => {
      if (ev.type === "goals.updated") load();
    }
  });

  const groupedScores = useMemo(() => {
    if (!data) return [];
    return GOAL_TRACKER_ROLE_GROUPS.map(g => ({
      label: g.label,
      rows: data.scores.filter(s => s.role === g.role)
    })).filter(g => g.rows.length > 0);
  }, [data]);

  if (!data) return <p className="muted">Loading…</p>;

  const dayColumns = weekColumnLabels(data.weekDates);
  const colCount = dayColumns.length + 3;

  return (
    <div>
      <h1>Action goal scores</h1>
      {monthPicker && months.length > 0 && (
        <div className="field" style={{ maxWidth: 280, marginTop: 12 }}>
          <label htmlFor="goals-month">Month</label>
          <select
            id="goals-month"
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
        Weekly Mon–Sun points. You see your row and everyone below your rank. Updates live.
        {monthPicker && data.month && !data.month.isActive && (
          <> Viewing <strong>{data.month.name}</strong> (not the active month).</>
        )}
      </p>
      <div className="card" style={{ marginTop: 16, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Staff</th>
              {dayColumns.map((col, i) => (
                <th
                  key={i}
                  className={col.hasDate ? undefined : "goal-day-outside-month"}
                  title={col.hasDate ? undefined : "Outside this month"}
                >
                  {col.label}
                </th>
              ))}
              <th>Total</th>
              <th>Goal</th>
            </tr>
          </thead>
          <tbody>
            {groupedScores.map(group => (
              <Fragment key={group.label}>
                <tr className="goal-group-heading">
                  <td colSpan={colCount}>{group.label}</td>
                </tr>
                {group.rows.map(s => (
                  <tr key={s.staffName}>
                    <td>{s.staffName}</td>
                    {s.points.map((p, i) => (
                      <td
                        key={i}
                        className={dayColumns[i]?.hasDate ? undefined : "goal-day-outside-month"}
                      >
                        {p}
                      </td>
                    ))}
                    <td><strong>{s.total}</strong></td>
                    <td
                      className={goalMet(s.total) ? "goal-met" : "goal-not-met"}
                      aria-label={goalMet(s.total) ? "Goal met" : "Goal not met"}
                    >
                      {goalMet(s.total) ? "✓" : "✗"}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
