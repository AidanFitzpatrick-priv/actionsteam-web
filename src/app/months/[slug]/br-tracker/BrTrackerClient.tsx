"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDateUKShort } from "@/lib/dates";
import { useLiveSync, useEditingIds, liveFetchOpts } from "@/hooks/useLiveSync";

type Row = {
  id: string;
  actionDate: string | null;
  typeName: string | null;
  status: string[];
  attended: string[];
  firstPlace: string | null;
  secondPlace: string | null;
  thirdPlace: string | null;
  winnerComped: boolean;
  colour: string;
};

type Dropdowns = {
  accountUsers: string[];
  types: { name: string; colourHex: string }[];
  statusOptions: string[];
};

function attendedOptionsForRow(accountUsers: string[], attended: string[]): string[] {
  const seen = new Map<string, string>();
  for (const name of accountUsers) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    seen.set(trimmed.toLowerCase(), trimmed);
  }
  for (const name of attended) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    seen.set(trimmed.toLowerCase(), trimmed);
  }
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}

function AttendedCheckboxDropdown({
  rowId,
  attended,
  accountUsers,
  onPatch
}: {
  rowId: string;
  attended: string[];
  accountUsers: string[];
  onPatch: (id: string, patch: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const options = attendedOptionsForRow(accountUsers, attended);

  const selectedKeys = useMemo(
    () => new Set(attended.map(name => name.toLowerCase())),
    [attended]
  );

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuMaxHeight = 220;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp = spaceBelow < 140 && rect.top > spaceBelow;

    setMenuStyle({
      position: "fixed",
      left: rect.left,
      width: Math.max(rect.width, 160),
      zIndex: 1000,
      ...(openUp
        ? { bottom: window.innerHeight - rect.top + 4, maxHeight: Math.min(menuMaxHeight, rect.top - 8) }
        : { top: rect.bottom + 4, maxHeight: Math.min(menuMaxHeight, spaceBelow) })
    });
  }, [open]);

  const summary =
    attended.length === 0
      ? "—"
      : attended.length <= 2
        ? attended.join(", ")
        : `${attended.length} selected`;

  function toggle(name: string) {
    const key = name.toLowerCase();
    const next = selectedKeys.has(key)
      ? attended.filter(n => n.toLowerCase() !== key)
      : [...attended, name];
    onPatch(rowId, { attended: next });
  }

  return (
    <div className="attended-dropdown" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="attended-dropdown-trigger"
        aria-label="Attended"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <span className={`attended-dropdown-label${attended.length ? "" : " is-empty"}`}>
          {summary}
        </span>
        <span className="attended-dropdown-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="attended-dropdown-menu" style={menuStyle} role="listbox" aria-multiselectable>
          {options.length === 0 ? (
            <p className="attended-dropdown-empty muted">No accounts yet</p>
          ) : (
            options.map(name => {
              const checked = selectedKeys.has(name.toLowerCase());
              return (
                <label key={name} className="attended-dropdown-option">
                  <input type="checkbox" checked={checked} onChange={() => toggle(name)} />
                  <span>{name}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function rowHasData(row: Row): boolean {
  return Boolean(
    row.actionDate ||
      row.typeName?.trim() ||
      row.status.length ||
      row.attended.length ||
      row.firstPlace?.trim() ||
      row.secondPlace?.trim() ||
      row.thirdPlace?.trim()
  );
}

export function BrTrackerClient({
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
  const [adding, setAdding] = useState(false);
  const { ref: editingIds } = useEditingIds();
  const [selfUserId, setSelfUserId] = useState<string | undefined>();

  const load = useCallback(async () => {
    const res = await fetch(`/api/months/${slug}/br-tracker`, liveFetchOpts);
    const data = await res.json();
    if (res.ok) {
      setRows(data.rows);
      setDropdowns(data.dropdowns);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d.user?.id) setSelfUserId(d.user.id);
      })
      .catch(() => {});
  }, []);

  const mergeRemoteRows = useCallback(
    (incoming: Row[]) => {
      setRows(prev => {
        const editing = editingIds.current;
        if (editing.size === 0) return incoming;
        return incoming.map(newRow => {
          if (editing.has(newRow.id)) {
            return prev.find(r => r.id === newRow.id) ?? newRow;
          }
          return newRow;
        });
      });
    },
    [editingIds]
  );

  const refreshFromServer = useCallback(async () => {
    const res = await fetch(`/api/months/${slug}/br-tracker`, liveFetchOpts);
    const data = await res.json();
    if (!res.ok) return;
    if (editingIds.current.size === 0) {
      setRows(data.rows);
    } else {
      mergeRemoteRows(data.rows);
    }
  }, [slug, mergeRemoteRows, editingIds]);

  useLiveSync({
    monthSlug: slug,
    selfUserId,
    onEvent: ev => {
      if (
        ev.type === "br_tracker.updated" ||
        ev.type === "br_tracker.added" ||
        ev.type === "br_tracker.deleted"
      ) {
        void refreshFromServer();
      }
    }
  });

  function markEditing(rowId: string) {
    editingIds.current.add(rowId);
  }

  function markDoneEditing(rowId: string) {
    setTimeout(() => editingIds.current.delete(rowId), 300);
  }

  async function updateRow(rowId: string, patch: Record<string, unknown>) {
    const res = await fetch(`/api/months/${slug}/br-tracker`, {
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
    }
  }

  async function addRow() {
    setAdding(true);
    const res = await fetch(`/api/months/${slug}/br-tracker`, {
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
    const res = await fetch(`/api/months/${slug}/br-tracker`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", rowId })
    });
    if (res.ok) {
      setRows(prev => prev.filter(r => r.id !== rowId));
    }
  }

  if (!dropdowns) return <p className="muted">Loading BR tracker…</p>;

  const titleYear = monthYear ? ` ${monthYear}` : "";

  return (
    <div className="tracker-page">
      <div className="tracker-page-header">
        <h1>
          {monthName}
          {titleYear} — Battle Royale Tracker
        </h1>
        <p className="muted">Log City, Cayo, and Sandy BRs. Place fields are winner ID text, not account picks.</p>
      </div>

      <div className="tracker-toolbar">
        <button type="button" className="btn tracker-add-btn" disabled={adding} onClick={addRow}>
          {adding ? "Adding…" : "Add row"}
        </button>
        <span className="muted tracker-row-count">
          {rows.filter(rowHasData).length} BR{rows.filter(rowHasData).length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="tracker-grid-wrap">
        <table
          className="table tracker-grid br-tracker-grid"
          style={{ ["--tracker-rows" as string]: Math.max(rows.length, 1) }}
        >
          <thead>
            <tr>
              <th className="tracker-col-date">Date</th>
              <th className="tracker-col-type">Type</th>
              <th className="tracker-col-status">Status</th>
              <th className="tracker-col-attended">Attended</th>
              <th className="br-tracker-col-place">1st place</th>
              <th className="br-tracker-col-place">2nd place</th>
              <th className="br-tracker-col-place">3rd place</th>
              <th className="tracker-col-comped">Winner comped</th>
              <th className="tracker-col-actions" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="tracker-empty-hint muted">
                  No rows yet — press Add row to log a BR.
                </td>
              </tr>
            ) : (
              rows.map(row => {
                const filled = rowHasData(row);

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
                        onFocus={() => markEditing(row.id)}
                        onBlur={e => {
                          updateRow(row.id, { actionDate: e.target.value || null });
                          markDoneEditing(row.id);
                        }}
                      />
                    </td>
                    <td
                      className="tracker-col-type tracker-type-cell"
                      style={row.typeName ? { background: row.colour } : undefined}
                    >
                      <select
                        className="select-compact tracker-field"
                        value={row.typeName ?? ""}
                        aria-label="BR type"
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
                    <td className="tracker-col-attended">
                      <AttendedCheckboxDropdown
                        rowId={row.id}
                        attended={row.attended}
                        accountUsers={dropdowns.accountUsers}
                        onPatch={updateRow}
                      />
                    </td>
                    <td className="br-tracker-col-place">
                      <input
                        className="input-compact tracker-field"
                        aria-label="1st place IDs"
                        placeholder="IDs"
                        maxLength={500}
                        defaultValue={row.firstPlace ?? ""}
                        onFocus={() => markEditing(row.id)}
                        onBlur={e => {
                          updateRow(row.id, { firstPlace: e.target.value.trim() || null });
                          markDoneEditing(row.id);
                        }}
                      />
                    </td>
                    <td className="br-tracker-col-place">
                      <input
                        className="input-compact tracker-field"
                        aria-label="2nd place IDs"
                        placeholder="IDs"
                        maxLength={500}
                        defaultValue={row.secondPlace ?? ""}
                        onFocus={() => markEditing(row.id)}
                        onBlur={e => {
                          updateRow(row.id, { secondPlace: e.target.value.trim() || null });
                          markDoneEditing(row.id);
                        }}
                      />
                    </td>
                    <td className="br-tracker-col-place">
                      <input
                        className="input-compact tracker-field"
                        aria-label="3rd place IDs"
                        placeholder="IDs"
                        maxLength={500}
                        defaultValue={row.thirdPlace ?? ""}
                        onFocus={() => markEditing(row.id)}
                        onBlur={e => {
                          updateRow(row.id, { thirdPlace: e.target.value.trim() || null });
                          markDoneEditing(row.id);
                        }}
                      />
                    </td>
                    <td className="tracker-col-comped">
                      <label className="tracker-comped-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(row.winnerComped)}
                          aria-label="Winner comped"
                          onChange={e => updateRow(row.id, { winnerComped: e.target.checked })}
                        />
                        <span className="tracker-comped-label">
                          {row.winnerComped ? "Comped" : "—"}
                        </span>
                      </label>
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
