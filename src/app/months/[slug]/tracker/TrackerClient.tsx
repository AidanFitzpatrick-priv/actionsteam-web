"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateUKShort } from "@/lib/dates";

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
  colour: string;
};

type Dropdowns = {
  accountUsers: string[];
  types: { name: string; colourHex: string }[];
  org1: string[];
  org2: string[];
  winners: string[];
  statusOptions: string[];
};

function hostedByOptionsForRow(accountUsers: string[], current: string | null): string[] {
  const trimmed = current?.trim();
  if (!trimmed) return accountUsers;
  if (accountUsers.some(u => u.toLowerCase() === trimmed.toLowerCase())) return accountUsers;
  return [...accountUsers, trimmed];
}

function rowHasData(row: Row): boolean {
  return Boolean(
    row.actionDate ||
      row.typeName?.trim() ||
      row.org1Name?.trim() ||
      row.org2Name?.trim() ||
      row.hostedBy?.trim() ||
      row.status.length ||
      row.attended.length ||
      row.actionWinner?.trim()
  );
}

export function TrackerClient({
  slug,
  monthName,
  monthYear
}: {
  slug: string;
  monthName: string;
  monthYear?: number | null;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [dropdowns, setDropdowns] = useState<Dropdowns | null>(null);
  const [toast, setToast] = useState("");
  const [adding, setAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/months/${slug}/tracker`);
    const data = await res.json();
    if (res.ok) {
      setRows(data.rows);
      setDropdowns(data.dropdowns);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

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
      setRows(prev =>
        prev.map(r =>
          r.id === rowId ? { ...r, ...data.row, colour: data.row.colour ?? r.colour } : r
        )
      );
      if (data.toast) showToast(data.toast);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetch("/api/stats").catch(() => {});
      }, 2500);
    }
  }

  async function addRow() {
    setAdding(true);
    const res = await fetch(`/api/months/${slug}/tracker`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add" })
    });
    const data = await res.json();
    setAdding(false);
    if (res.ok) {
      setRows(prev => [...prev, { ...data.row, colour: "#ffffff" }]);
    }
  }

  async function deleteRow(rowId: string) {
    const res = await fetch(`/api/months/${slug}/tracker`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", rowId })
    });
    if (res.ok) {
      setRows(prev => prev.filter(r => r.id !== rowId));
    }
  }

  if (!dropdowns) return <p className="muted">Loading tracker…</p>;

  const titleYear = monthYear ? ` ${monthYear}` : "";

  return (
    <div className="tracker-page">
      <div className="tracker-page-header">
        <h1>
          {monthName}
          {titleYear} — Actions Tracker
        </h1>
        <p className="muted">
          Add rows manually and fill in each action. Winner = ORG 1, ORG 2, or N/A (N/A sets
          headcounts to N/A).
        </p>
        {toast && <p className="success">{toast}</p>}
      </div>

      <div className="tracker-toolbar">
        <button type="button" className="btn tracker-add-btn" disabled={adding} onClick={addRow}>
          {adding ? "Adding…" : "Add row"}
        </button>
        <span className="muted tracker-row-count">
          {rows.filter(rowHasData).length} action{rows.filter(rowHasData).length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="tracker-grid-wrap">
        <table
          className="table tracker-grid"
          style={{ ["--tracker-rows" as string]: Math.max(rows.length, 1) }}
        >
          <thead>
            <tr>
              <th className="tracker-col-date">Date</th>
              <th className="tracker-col-type">Type</th>
              <th className="tracker-col-status">Status</th>
              <th className="tracker-col-org">ORG 1</th>
              <th className="tracker-col-org">ORG 2</th>
              <th className="tracker-col-person">Hosted by</th>
              <th className="tracker-col-attended">Attended</th>
              <th className="tracker-col-winner">Winner</th>
              <th className="tracker-col-count">ORG 1 #</th>
              <th className="tracker-col-count">ORG 2 #</th>
              <th className="tracker-col-actions" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} className="tracker-empty-hint muted">
                  No rows yet — press Add row to log an action.
                </td>
              </tr>
            ) : (
              rows.map(row => {
                const filled = rowHasData(row);
                const hostedOptions = hostedByOptionsForRow(dropdowns.accountUsers, row.hostedBy);

                return (
                  <tr key={row.id} className={filled ? "is-filled" : "is-empty"}>
                    <td className="tracker-col-date">
                      <input
                        className="input-compact tracker-field"
                        aria-label="Action date"
                        placeholder="DD/MM/YY"
                        defaultValue={
                          row.actionDate ? formatDateUKShort(new Date(row.actionDate)) : ""
                        }
                        onBlur={e => updateRow(row.id, { actionDate: e.target.value || null })}
                      />
                    </td>
                    <td
                      className="tracker-col-type tracker-type-cell"
                      style={row.typeName ? { background: row.colour } : undefined}
                    >
                      <select
                        className="select-compact tracker-field"
                        value={row.typeName ?? ""}
                        aria-label="Action type"
                        onChange={e => updateRow(row.id, { typeName: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {dropdowns.types.map(t => (
                          <option key={t.name} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="tracker-col-status">
                      <select
                        className="select-compact tracker-field"
                        value={row.status[0] ?? ""}
                        aria-label="Status"
                        onChange={e =>
                          updateRow(row.id, { status: e.target.value ? [e.target.value] : [] })
                        }
                      >
                        <option value="">—</option>
                        {dropdowns.statusOptions.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="tracker-col-org">
                      <select
                        className="select-compact tracker-field"
                        value={row.org1Name ?? ""}
                        aria-label="ORG 1"
                        onChange={e => updateRow(row.id, { org1Name: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {dropdowns.org1.map(o => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="tracker-col-org">
                      <select
                        className="select-compact tracker-field"
                        value={row.org2Name ?? ""}
                        aria-label="ORG 2"
                        onChange={e => updateRow(row.id, { org2Name: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {dropdowns.org2.map(o => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="tracker-col-person">
                      <select
                        className="select-compact tracker-field"
                        value={row.hostedBy ?? ""}
                        aria-label="Hosted by"
                        onChange={e => updateRow(row.id, { hostedBy: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {hostedOptions.map(name => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="tracker-col-attended">
                      <input
                        className="input-compact tracker-field"
                        aria-label="Attended"
                        placeholder="Names"
                        defaultValue={row.attended.join(", ")}
                        onBlur={e =>
                          updateRow(row.id, {
                            attended: e.target.value
                              .split(",")
                              .map(s => s.trim())
                              .filter(Boolean)
                          })
                        }
                      />
                    </td>
                    <td className="tracker-col-winner">
                      <select
                        className="select-compact tracker-field"
                        value={row.actionWinner ?? ""}
                        aria-label="Winner"
                        onChange={e => updateRow(row.id, { actionWinner: e.target.value || null })}
                      >
                        <option value="">—</option>
                        {dropdowns.winners.map(w => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="tracker-col-count">
                      <input
                        className="input-compact tracker-field"
                        aria-label="ORG 1 headcount"
                        defaultValue={row.org1Attended ?? ""}
                        onBlur={e => updateRow(row.id, { org1Attended: e.target.value || null })}
                      />
                    </td>
                    <td className="tracker-col-count">
                      <input
                        className="input-compact tracker-field"
                        aria-label="ORG 2 headcount"
                        defaultValue={row.org2Attended ?? ""}
                        onBlur={e => updateRow(row.id, { org2Attended: e.target.value || null })}
                      />
                    </td>
                    <td className="tracker-col-actions">
                      <button
                        type="button"
                        className="btn btn-secondary tracker-delete-btn"
                        title="Remove row"
                        onClick={() => deleteRow(row.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
