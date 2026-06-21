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

  async function patch(slotId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/months/${slug}/schedule`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId, ...patch })
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

  if (!dropdowns) return <p className="muted">Loading schedule…</p>;

  return (
    <div>
      <h1>{monthName} — Actions Schedule</h1>
      <p className="muted">Type + ORG syncs to tracker. Colours from action types.</p>
      {toast && <p className="success">{toast}</p>}

      <div style={{ margin: "16px 0", display: "flex", gap: 8 }}>
        {[0, 1, 2, 3, 4].map(w => (
          <button key={w} type="button" className={w === week ? "btn" : "btn btn-secondary"} onClick={() => setWeek(w)}>
            Week {w + 1}
          </button>
        ))}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              {DAY_NAMES.map(d => <th key={d}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }).map((_, rowIdx) => (
              <tr key={rowIdx}>
                {byDay.map((daySlots, dayIndex) => {
                  const slot = daySlots.find(s => s.rowIndex === rowIdx);
                  if (!slot) return <td key={dayIndex} />;
                  return (
                    <td key={dayIndex} style={{ background: slot.colour, verticalAlign: "top", minWidth: 140 }}>
                      <input className="input" placeholder="Time" defaultValue={slot.timeText ?? ""} style={{ marginBottom: 4 }}
                        onBlur={e => patch(slot.id, { timeText: e.target.value || null })} />
                      <select className="select" value={slot.typeName ?? ""} style={{ marginBottom: 4 }}
                        onChange={e => patch(slot.id, { typeName: e.target.value || null })}>
                        <option value="">Type</option>
                        {dropdowns.types.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                      </select>
                      <input className="input" placeholder="DD/MM/YYYY" defaultValue={slot.dateBooked ? formatDateUK(new Date(slot.dateBooked)) : ""} style={{ marginBottom: 4 }}
                        onBlur={e => patch(slot.id, { dateBooked: e.target.value || null })} />
                      <input className="input" placeholder="Booked by" defaultValue={slot.bookedBy ?? ""} style={{ marginBottom: 4 }}
                        onBlur={e => patch(slot.id, { bookedBy: e.target.value || null })} />
                      <select className="select" value={slot.orgName ?? ""}
                        onChange={e => patch(slot.id, { orgName: e.target.value || null })}>
                        <option value="">ORG</option>
                        {dropdowns.org2.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
