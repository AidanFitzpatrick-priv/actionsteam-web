"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateUKShort } from "@/lib/dates";

const DAY_NAMES_FULL = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
];

type Slot = {
  id: string;
  weekIndex: number;
  dayIndex: number;
  rowIndex: number;
  timeText: string | null;
  typeName: string | null;
  actionDayDate: string | null;
  dateBooked: string | null;
  bookedBy: string | null;
  orgName: string | null;
  colour: string;
};

type CalendarDay = {
  dayIndex: number;
  date: string;
};

type CalendarWeek = {
  weekIndex: number;
  days: CalendarDay[];
};

type Calendar = {
  year: number;
  monthName: string;
  weeks: CalendarWeek[];
};

type Dropdowns = {
  types: { name: string; colourHex: string }[];
  org2: string[];
  staff: string[];
};

function slotIsFilled(slot: Slot): boolean {
  return Boolean(slot.typeName?.trim() || slot.orgName?.trim() || slot.bookedBy?.trim());
}

function ScheduleSlotCell({
  slot,
  dropdowns,
  onPatch
}: {
  slot: Slot;
  dropdowns: Dropdowns;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
}) {
  const filled = slotIsFilled(slot);

  return (
    <td
      className={`schedule-slot-cell${filled ? " is-filled" : " is-empty"}`}
      style={filled ? { background: slot.colour } : undefined}
    >
      <select
        className="select-compact schedule-field"
        value={slot.typeName ?? ""}
        aria-label="Action type"
        title="Action type"
        onChange={e => onPatch(slot.id, { typeName: e.target.value || null })}
      >
        <option value="">—</option>
        {dropdowns.types.map(t => (
          <option key={t.name} value={t.name}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="schedule-slot-meta">
        <input
          className="input-compact schedule-field"
          aria-label="Booked by"
          placeholder="By"
          defaultValue={slot.bookedBy ?? ""}
          onBlur={e => onPatch(slot.id, { bookedBy: e.target.value || null })}
        />
        <select
          className="select-compact schedule-field"
          value={slot.orgName ?? ""}
          aria-label="Organisation"
          title="Organisation"
          onChange={e => onPatch(slot.id, { orgName: e.target.value || null })}
        >
          <option value="">—</option>
          {dropdowns.org2.map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    </td>
  );
}

export function ScheduleClient({ slug, monthName }: { slug: string; monthName: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [dropdowns, setDropdowns] = useState<Dropdowns | null>(null);
  const [toast, setToast] = useState("");
  const [week, setWeek] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/months/${slug}/schedule`);
    const data = await res.json();
    if (res.ok) {
      setSlots(data.slots);
      setCalendar(data.calendar);
      setDropdowns(data.dropdowns);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!calendar?.weeks.length) return;
    if (!calendar.weeks.some(w => w.weekIndex === week)) {
      setWeek(calendar.weeks[0]?.weekIndex ?? 0);
    }
  }, [calendar, week]);

  async function patch(slotId: string, patchData: Record<string, unknown>) {
    const res = await fetch(`/api/months/${slug}/schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId, ...patchData })
    });
    const data = await res.json();
    if (res.ok) {
      setSlots(prev => prev.map(s => (s.id === slotId ? { ...s, ...data.slot } : s)));
      if (data.message) {
        setToast(data.message);
        setTimeout(() => setToast(""), 3000);
      }
    }
  }

  const weekSlots = slots.filter(s => s.weekIndex === week);
  const currentWeekDays = useMemo(() => {
    return calendar?.weeks.find(w => w.weekIndex === week)?.days ?? [];
  }, [calendar, week]);

  const activeRowIndices = useMemo(() => {
    const indices = new Set<number>();
    weekSlots.forEach(s => {
      if (s.timeText?.trim() || slotIsFilled(s)) indices.add(s.rowIndex);
    });
    if (indices.size === 0) return Array.from({ length: 12 }, (_, i) => i);
    return Array.from(indices).sort((a, b) => a - b);
  }, [weekSlots]);

  const timeColumnLabels = useMemo(() => {
    return activeRowIndices.map(rowIdx => {
      const withTime = weekSlots.find(s => s.rowIndex === rowIdx && s.timeText?.trim());
      return withTime?.timeText?.trim() ?? "";
    });
  }, [weekSlots, activeRowIndices]);

  if (!dropdowns || !calendar) return <p className="muted">Loading schedule…</p>;

  return (
    <div className="schedule-page">
      <div className="schedule-page-header">
        <h1>
          {calendar.monthName} {calendar.year} — Actions Schedule
        </h1>
        <p className="muted">
          Week {week + 1}. Action dates on the left; times in column headers. Type + ORG syncs to
          tracker.
        </p>
        {toast && <p className="success">{toast}</p>}
      </div>

      <div className="schedule-week-tabs">
        {calendar.weeks.map(w => (
          <button
            key={w.weekIndex}
            type="button"
            className={
              w.weekIndex === week ? "btn schedule-week-btn" : "btn btn-secondary schedule-week-btn"
            }
            onClick={() => setWeek(w.weekIndex)}
          >
            W{w.weekIndex + 1}
          </button>
        ))}
      </div>

      <div className="schedule-grid-wrap">
        <table className="table schedule-grid">
          <thead>
            <tr>
              <th className="schedule-day-col">Day</th>
              {timeColumnLabels.map((label, colIdx) => (
                <th key={activeRowIndices[colIdx]} className="schedule-time-col">
                  {label || "—"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentWeekDays.map(day => {
              const daySlots = weekSlots
                .filter(s => s.dayIndex === day.dayIndex)
                .sort((a, b) => a.rowIndex - b.rowIndex);
              const actionDate = formatDateUKShort(new Date(day.date));

              return (
                <tr key={day.dayIndex}>
                  <th scope="row" className="schedule-day-col">
                    <span className="schedule-day-name">{DAY_NAMES_FULL[day.dayIndex]}</span>
                    <span className="schedule-day-date">{actionDate}</span>
                  </th>
                  {activeRowIndices.map(rowIdx => {
                    const slot = daySlots.find(s => s.rowIndex === rowIdx);
                    if (!slot) return <td key={rowIdx} className="schedule-slot-cell is-empty" />;
                    return (
                      <ScheduleSlotCell
                        key={slot.id}
                        slot={slot}
                        dropdowns={dropdowns}
                        onPatch={patch}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
