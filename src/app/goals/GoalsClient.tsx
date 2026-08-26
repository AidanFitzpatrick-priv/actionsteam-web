"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserRole } from "@prisma/client";
import { WEEKLY_ACTION_GOAL, goalMet, teamGoalScores } from "@/lib/goals";
import { useLiveSync } from "@/hooks/useLiveSync";
import {
  CHART_COLORS,
  GoalBarChart,
  GoalLineChart,
  GoalRing,
  WeekBars,
  dayLabel
} from "./GoalVisuals";

type WeekColumn = { dayIndex: number; date: string };

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
  isSelf?: boolean;
};

type GoalsPayload = {
  weekColumns: WeekColumn[];
  scores: ScoreRow[];
  selfScore?: ScoreRow;
  month?: { name: string; slug: string; isActive: boolean; year?: number | null } | null;
  goal?: number;
  canViewTeam?: boolean;
  selfName?: string;
};

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthLabel(m: MonthOption): string {
  const year = m.year ? ` ${m.year}` : "";
  const active = m.isActive ? " (active)" : "";
  return `${m.name}${year}${active}`;
}

export function GoalsClient({ monthPicker = false }: { monthPicker?: boolean }) {
  const [data, setData] = useState<GoalsPayload | null>(null);
  const [months, setMonths] = useState<MonthOption[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [selfUserId, setSelfUserId] = useState<string | undefined>();
  const [focusName, setFocusName] = useState("");

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
      .then(d => {
        if (d.user?.id) setSelfUserId(d.user.id);
      })
      .catch(() => {});
  }, []);

  useLiveSync({
    selfUserId,
    acceptOwnEventTypes: ["goals.updated"],
    onEvent: ev => {
      if (ev.type === "goals.updated") load();
    }
  });

  const goal = data?.goal ?? WEEKLY_ACTION_GOAL;
  const selfRow = useMemo(() => {
    if (!data) return null;
    return (
      data.selfScore ??
      data.scores.find(s => s.isSelf) ?? {
        staffName: data.selfName ?? "You",
        role: "member" as UserRole,
        points: data.weekColumns.map(() => 0),
        total: 0,
        isSelf: true
      }
    );
  }, [data]);

  const remaining = selfRow ? Math.max(0, goal - selfRow.total) : goal;

  if (!data || !selfRow) return <p className="muted">Loading…</p>;

  const teamScores = teamGoalScores(data.scores);
  const labels = data.weekColumns.map(c => dayLabel(c.dayIndex, c.date));
  const shortLabels = data.weekColumns.map(c => DAYS_SHORT[c.dayIndex] ?? c.date);
  const teamDaily = data.weekColumns.map((_, i) =>
    teamScores.reduce((sum, row) => sum + (row.points[i] ?? 0), 0)
  );
  const focusRow = focusName ? teamScores.find(s => s.staffName === focusName) : null;
  const lineSeries = focusRow
    ? [{ name: focusRow.staffName, color: CHART_COLORS[0], values: focusRow.points }]
    : [{ name: "Whole team", color: CHART_COLORS[0], values: teamDaily }];
  const hitCount = teamScores.filter(s => goalMet(s.total)).length;

  return (
    <div className="goals-page">
      <p className="eyebrow">This week</p>
      <h1>Action goals</h1>
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

      <article className="goal-card">
        <GoalRing total={selfRow.total} goal={goal} />
        <p className="goal-note">
          {remaining === 0
            ? "Weekly goal hit. Keep attending if you want the extra actions."
            : `You need ${remaining} more action${remaining === 1 ? "" : "s"} this week to hit ${goal}.`}
        </p>
        <p className="muted">One point for each action you host or attend this schedule week.</p>
        <WeekBars labels={shortLabels} values={selfRow.points} />
      </article>

      {data.canViewTeam && (
        <section className="goal-team">
          <p className="eyebrow">Aux+ only</p>
          <h2>Team tracking</h2>
          <p className="lede">
            {hitCount} of {teamScores.length} people have hit {goal} actions this week.
          </p>

          <div className="goal-team-hero">
            <article className="goal-card goal-card-compact">
              <h3>People at goal</h3>
              <GoalRing
                total={hitCount}
                goal={Math.max(teamScores.length, 1)}
                size={180}
                label="Hit 10 this week"
              />
            </article>
          </div>

          <div className="page-toolbar">
            <label htmlFor="goal-focus">
              Graph
              <select
                id="goal-focus"
                className="select"
                value={focusName}
                onChange={e => setFocusName(e.target.value)}
              >
                <option value="">Whole team</option>
                {teamScores.map(s => (
                  <option key={s.staffName} value={s.staffName}>
                    {s.staffName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <article className="card chart-panel">
            <h3>{focusRow ? `${focusRow.staffName} — daily` : "Team daily total"}</h3>
            <div className="chart">
              <GoalLineChart labels={labels} series={lineSeries} />
            </div>
          </article>

          <article className="card chart-panel">
            <h3>Weekly total vs {goal}</h3>
            <div className="chart">
              <GoalBarChart
                items={teamScores.map((s, i) => ({
                  name: s.staffName,
                  value: s.total,
                  color: CHART_COLORS[i % CHART_COLORS.length]
                }))}
                goal={goal}
              />
            </div>
          </article>

          <div className="goal-ring-grid">
            {teamScores.map(s => (
              <button
                type="button"
                key={s.staffName}
                className={`goal-mini${focusName === s.staffName ? " is-active" : ""}`}
                onClick={() => setFocusName(s.staffName === focusName ? "" : s.staffName)}
              >
                <GoalRing total={s.total} goal={goal} size={140} label={s.staffName} />
                <strong>{s.staffName}</strong>
                <span className={goalMet(s.total) ? "goal-met" : "goal-not-met"}>
                  {goalMet(s.total) ? "Goal hit" : `${s.total} / ${goal}`}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
