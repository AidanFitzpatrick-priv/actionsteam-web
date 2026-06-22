"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateUK } from "@/lib/dates";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Slot = {
  id: string;
  weekIndex: number;
  dayIndex: number;
  rowIndex: number;
  timeText: string | null;
  typeName: string | null;
  dateBooked: string | null;
  bookedBy: string | null;
  orgName: string | null;
  colour: string;
};

type Dropdowns = {
  types: { name: string; colourHex: string }[];
  org2: string[];
  staff: string[];
};

function ScheduleSlotCell({
  slot,
  dropdowns,
  onPatch
}: {
  slot: Slot;
  dropdowns: Dropdowns;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
}) {
  return (
    <td style={{ background: slot.colour, verticalAlign: "top", minWidth: 128, padding: 8 }}>
      <input
        className="input"
        placeholder="Time"
        defaultValue={slot.timeText ?? ""}
        style={{ marginBottom: 4, fontSize: 13 }}
        onBlur={e => onPatch(slot.id, { timeText: e.target.value || null })}
      />
      <select
        className="select"
        value={slot.typeName ?? ""}
        style={{ marginBottom: 4, fontSize: 13 }}
        onChange={e => onPatch(slot.id, { typeName: e.target.value || null })}
      >
        <option value="">Type</option>
        {dropdowns.types.map(t => (
          <option key={t.name} value={t.name}>{t.name}</option>
        ))}
      </select>
      <input
        className="input"
        placeholder="DD/MM/YYYY"
        defaultValue={slot.dateBooked ? formatDateUK(new Date(slot.dateBooked)) : ""}
        style={{ marginBottom: 4, fontSize: 13 }}
        onBlur={e => onPatch(slot.id, { dateBooked: e.target.value || null })}
      />
      <input
        className="input"
        placeholder="Booked by"
        defaultValue={slot.bookedBy ?? ""}
        style={{ marginBottom: 4, fontSize: 13 }}
        onBlur={e => onPatch(slot.id, { bookedBy: e.target.value || null })}
      />
      <select
        className="select"
        value={slot.orgName ?? ""}
        style={{ fontSize: 13 }}
        onChange={e => onPatch(slot.id, { orgName: e.target.value || null })}
      >
        <option value="">ORG</option>
        {dropdowns.org2.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </td>
  );
}

export function ScheduleClient({ slug, monthName }: { slug: string; monthName: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dropdowns, setDropdowns] = useState<Dropdowns | null>(null);
  const [toast, setToast] = useState("");
  const [week, setWeek] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/months/${slug}/schedule`);
    const data = await res.json();
    if (res.ok) {
      setSlots(data.slots);
      setDropdowns(data.dropdowns);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

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
  const byDay = DAY_NAMES.map((_, dayIndex) =>
    weekSlots.filter(s => s.dayIndex === dayIndex).sort((a, b) => a.rowIndex - b.rowIndex)
  );

  const timeColumnLabels = Array.from({ length: 12 }, (_, rowIdx) => {
    const withTime = weekSlots.find(s => s.rowIndex === rowIdx && s.timeText?.trim());
    return withTime?.timeText?.trim() ?? "";
  });

  if (!dropdowns) return <p className="muted">Loading schedule…</p>;

  return (
    <div>
      <h1>{monthName} — Actions Schedule</h1>
      <p className="muted">Days down the side, times across the top. Type + ORG syncs to tracker.</p>
      {toast && <p className="success">{toast}</p>}

      <div style={{ margin: "16px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[0, 1, 2, 3, 4].map(w => (
          <button key={w} type="button" className={w === week ? "btn" : "btn btn-secondary"} onClick={() => setWeek(w)}>
            Week {w + 1}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table schedule-grid">
          <thead>
            <tr>
              <th className="schedule-day-col">Day</th>
              {timeColumnLabels.map((label, rowIdx) => (
                <th key={rowIdx} className="schedule-time-col">
                  {label || `#${rowIdx + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_NAMES.map((dayName, dayIndex) => {
              const daySlots = byDay[dayIndex];
              return (
                <tr key={dayName}>
                  <th scope="row" className="schedule-day-col">{dayName}</th>
                  {Array.from({ length: 12 }).map((_, rowIdx) => {
                    const slot = daySlots.find(s => s.rowIndex === rowIdx);
                    if (!slot) return <td key={rowIdx} />;
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
