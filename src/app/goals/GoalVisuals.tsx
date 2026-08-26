"use client";

import { WEEKLY_ACTION_GOAL, goalMet } from "@/lib/goals";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const CHART_COLORS = [
  "#3dcea8",
  "#f0b429",
  "#7dd3fc",
  "#c4b5fd",
  "#fb7185",
  "#34d399",
  "#60a5fa",
  "#fbbf24"
];

export function dayLabel(dayIndex: number, date: string): string {
  const name = DAYS[dayIndex] ?? `D${dayIndex + 1}`;
  const short = date.replace(/\/\d{2}$/, "").replace(/\/\d{4}$/, "");
  return short ? `${name} ${short}` : name;
}

export function GoalRing({
  total,
  goal = WEEKLY_ACTION_GOAL,
  size = 220,
  label = "Actions this week"
}: {
  total: number;
  goal?: number;
  size?: number;
  label?: string;
}) {
  const pct = Math.min(100, Math.round((total / Math.max(goal, 1)) * 100));
  const inner = Math.round(size * 0.8);
  const met = goalMet(total);
  return (
    <div
      className="goal-ring"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(var(--olive) ${pct}%, #1a222c 0)`
      }}
      role="img"
      aria-label={`${total} of ${goal} actions this week`}
    >
      <div className="goal-ring-inner" style={{ width: inner, height: inner }}>
        <strong>
          {total} / {goal}
        </strong>
        <span>{met ? "Goal hit" : label}</span>
      </div>
    </div>
  );
}

export function WeekBars({
  labels,
  values
}: {
  labels: string[];
  values: number[];
}) {
  const max = Math.max(1, ...values);
  return (
    <div className="goal-week-bars" role="img" aria-label="Actions by day">
      {labels.map((label, i) => {
        const v = values[i] ?? 0;
        return (
          <div key={`${label}-${i}`} className="goal-week-bar">
            <span className="goal-week-bar-val">{v}</span>
            <div className="goal-week-bar-track">
              <div
                className="goal-week-bar-fill"
                style={{ height: `${(v / max) * 100}%` }}
              />
            </div>
            <span className="goal-week-bar-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function GoalLineChart({
  labels,
  series,
  height = 280
}: {
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
  height?: number;
}) {
  const width = 720;
  const pad = { l: 36, r: 16, t: 20, b: 36 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = Math.max(1, ...series.flatMap(s => s.values));
  const n = Math.max(labels.length - 1, 1);
  const x = (i: number) => pad.l + (i / n) * innerW;
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i));

  return (
    <svg className="goal-svg-chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <title>Daily actions</title>
      {ticks.map(t => (
        <g key={t}>
          <line
            x1={pad.l}
            x2={width - pad.r}
            y1={y(t)}
            y2={y(t)}
            className="goal-chart-grid"
          />
          <text x={pad.l - 8} y={y(t) + 4} className="goal-chart-axis" textAnchor="end">
            {t}
          </text>
        </g>
      ))}
      {series.map(s => {
        const d = s.values
          .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`)
          .join(" ");
        return (
          <g key={s.name}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill={s.color} />
            ))}
          </g>
        );
      })}
      {labels.map((label, i) => (
        <text key={label + i} x={x(i)} y={height - 10} className="goal-chart-axis" textAnchor="middle">
          {label}
        </text>
      ))}
    </svg>
  );
}

export function GoalBarChart({
  items,
  goal = WEEKLY_ACTION_GOAL,
  height = 330
}: {
  items: { name: string; value: number; color: string }[];
  goal?: number;
  height?: number;
}) {
  const width = Math.max(720, items.length * 56);
  const pad = { l: 36, r: 16, t: 20, b: 108 };
  const innerW = width - pad.l - pad.r;
  const innerH = height - pad.t - pad.b;
  const max = Math.max(goal, ...items.map(i => i.value), 1);
  const barW = Math.min(36, innerW / Math.max(items.length, 1) - 10);
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const goalY = y(goal);
  const labelY = pad.t + innerH + 14;

  return (
    <div className="goal-svg-scroll">
      <svg className="goal-svg-chart" viewBox={`0 0 ${width} ${height}`} role="img">
        <title>Weekly totals versus the 10-action goal</title>
        <line x1={pad.l} x2={width - pad.r} y1={goalY} y2={goalY} className="goal-chart-goal" />
        <text x={width - pad.r} y={goalY - 6} className="goal-chart-axis" textAnchor="end">
          Goal {goal}
        </text>
        {items.map((item, i) => {
          const cx = pad.l + ((i + 0.5) / items.length) * innerW;
          const top = y(item.value);
          const h = Math.max(2, pad.t + innerH - top);
          return (
            <g key={item.name}>
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={h}
                rx="4"
                fill={item.color}
              />
              <text x={cx} y={top - 6} className="goal-chart-axis" textAnchor="middle">
                {item.value}
              </text>
              <text
                x={cx}
                y={labelY}
                className="goal-chart-axis"
                textAnchor="end"
                transform={`rotate(-40 ${cx} ${labelY})`}
              >
                {item.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
