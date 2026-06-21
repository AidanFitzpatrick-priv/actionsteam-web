"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateUK } from "@/lib/dates";

type Row = {
  id: string;
  actionDate: string | null;
  typeName: string | null;
  status: string[];
  org1Name: string | null;
  org2Name: string | null;
  hostedBy: string | null;
  attended: string[];
  actionWinner: string | null;
  org1Attended: string | null;
  org2Attended: string | null;
};

type Dropdowns = {
  staff: string[];
  types: { name: string; colourHex: string }[];
  org1: string[];
  org2: string[];
  winners: string[];
  statusOptions: string[];
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TrackerClient({ slug, monthName }: { slug: string; monthName: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [dropdowns, setDropdowns] = useState<Dropdowns | null>(null);
  const [toast, setToast] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/months/${slug}/tracker`);
    const data = await res.json();
    if (res.ok) {
      setRows(data.rows);
      setDropdowns(data.dropdowns);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function updateRow(rowId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/months/${slug}/tracker`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", rowId, ...patch })
    });
    const data = await res.json();
    if (res.ok) {
      setRows(prev => prev.map(r => (r.id === rowId ? data.row : r)));
      if (data.toast) showToast(data.toast);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetch("/api/stats").catch(() => {});
      }, 2500);
    }
  }

  if (!dropdowns) return <p className="muted">Loading tracker…</p>;

  return (
    <div>
      <h1>{monthName} — Actions Tracker</h1>
      <p className="muted">Winner = ORG 1, ORG 2, or N/A. N/A sets headcounts to N/A.</p>
      {toast && <p className="success">{toast}</p>}

      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Status</th>
              <th>ORG 1</th>
              <th>ORG 2</th>
              <th>Hosted by</th>
              <th>Attended</th>
              <th>Winner</th>
              <th>ORG 1 #</th>
              <th>ORG 2 #</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td>
                  <input
                    className="input"
                    style={{ minWidth: 110 }}
                    defaultValue={row.actionDate ? formatDateUK(new Date(row.actionDate)) : ""}
                    onBlur={e => updateRow(row.id, { actionDate: e.target.value || null })}
                  />
                </td>
                <td>
                  <select className="select" value={row.typeName ?? ""} onChange={e => updateRow(row.id, { typeName: e.target.value || null })}>
                    <option value="">—</option>
                    {dropdowns.types.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    className="select"
                    value={row.status[0] ?? ""}
                    onChange={e => updateRow(row.id, { status: e.target.value ? [e.target.value] : [] })}
                  >
                    <option value="">—</option>
                    {dropdowns.statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <select className="select" value={row.org1Name ?? ""} onChange={e => updateRow(row.id, { org1Name: e.target.value || null })}>
                    <option value="">—</option>
                    {dropdowns.org1.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td>
                  <select className="select" value={row.org2Name ?? ""} onChange={e => updateRow(row.id, { org2Name: e.target.value || null })}>
                    <option value="">—</option>
                    {dropdowns.org2.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td>
                  <input className="input" defaultValue={row.hostedBy ?? ""} onBlur={e => updateRow(row.id, { hostedBy: e.target.value || null })} />
                </td>
                <td>
                  <input className="input" defaultValue={row.attended.join(", ")} onBlur={e => updateRow(row.id, { attended: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
                </td>
                <td>
                  <select className="select" value={row.actionWinner ?? ""} onChange={e => updateRow(row.id, { actionWinner: e.target.value || null })}>
                    <option value="">—</option>
                    {dropdowns.winners.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </td>
                <td><input className="input" style={{ width: 64 }} defaultValue={row.org1Attended ?? ""} onBlur={e => updateRow(row.id, { org1Attended: e.target.value || null })} /></td>
                <td><input className="input" style={{ width: 64 }} defaultValue={row.org2Attended ?? ""} onBlur={e => updateRow(row.id, { org2Attended: e.target.value || null })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" className="btn" style={{ marginTop: 16 }} onClick={async () => {
        await fetch(`/api/months/${slug}/tracker`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add" }) });
        await load();
      }}>Add row</button>
    </div>
  );
}
