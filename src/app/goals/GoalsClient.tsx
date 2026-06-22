"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveSync } from "@/hooks/useLiveSync";

type MonthOption = {
  id: string;
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

export function GoalsClient({
  kind,
  monthPicker = false
}: {
  kind: "actions" | "bookings";
  monthPicker?: boolean;
}) {
  const [data, setData] = useState<{
    weekDates: string[];
    scores: Array<{ staffName: string; points: number[]; total: number }>;
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
    const params = new URLSearchParams({ kind });
    if (monthPicker && selectedSlug) params.set("month", selectedSlug);
    const res = await fetch(`/api/goals?${params}`);
    const json = await res.json();
    if (res.ok) {
      setData(json);
      if (monthPicker && json.month?.slug && !selectedSlug) {
        setSelectedSlug(json.month.slug);
      }
    }
  }, [kind, monthPicker, selectedSlug]);

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
