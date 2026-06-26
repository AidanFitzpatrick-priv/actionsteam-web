"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLiveSync } from "@/hooks/useLiveSync";

type Tab = "types" | "gangs" | "staff";
type ActionTypeKind = "action" | "br";

const TAB_LABELS: Record<Tab, string> = {
  types: "Action types",
  gangs: "Gangs",
  staff: "Staff"
};

export function AdminDataClient() {
  const [tab, setTab] = useState<Tab>("types");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [typeKind, setTypeKind] = useState<ActionTypeKind>("action");
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/data?entity=${tab}`);
    const data = await res.json();
    if (res.ok) setItems(data.items);
  }, [tab]);

  useEffect(() => {
    load();
    setEditingId(null);
    setName("");
    setExtra("");
    setTypeKind("action");
  }, [load, tab]);

  useLiveSync({
    admin: true,
    onEvent: ev => {
      if (ev.type === "admin.updated") load();
    }
  });

  function startEdit(item: Record<string, unknown>) {
    setEditingId(String(item.id));
    setName(String(item.name));
    if (tab === "staff") setExtra(String(item.rank ?? ""));
    else if (tab === "types") {
      setExtra(String(item.colourHex ?? "#ffffff"));
      setTypeKind((item.kind as ActionTypeKind) ?? "action");
    } else setExtra(item.org2Eligible ? "true" : "false");
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setExtra("");
    setTypeKind("action");
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      entity: tab,
      action: "upsert",
      name: name.trim()
    };
    if (editingId) body.id = editingId;
    if (tab === "staff") body.rank = extra.trim() || null;
    if (tab === "types") {
      body.colourHex = extra.trim() || "#ffffff";
      body.kind = typeKind;
    }
    if (tab === "gangs") body.org2Eligible = extra !== "false";

    const res = await fetch("/api/admin/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Save failed");
      return;
    }

    cancelEdit();
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Remove this entry? It will no longer appear in dropdowns.")) return;
    await fetch("/api/admin/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: tab, action: "delete", id })
    });
    if (editingId === id) cancelEdit();
    await load();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["types", "gangs", "staff"] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            className={tab === t ? "btn" : "btn btn-secondary"}
            onClick={() => setTab(t)}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={save} className="grid-2">
          <div className="field">
            <label htmlFor="data-name">{tab === "types" ? "Action type name" : "Name"}</label>
            <input
              id="data-name"
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="data-extra">
              {tab === "staff"
                ? "Rank"
                : tab === "types"
                  ? "Colour"
                  : "ORG2 eligible (true/false)"}
            </label>
            {tab === "types" ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  id="data-extra"
                  className="input"
                  value={extra}
                  onChange={e => setExtra(e.target.value)}
                  placeholder="#fce5cd"
                  required
                />
                <span
                  aria-hidden
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 4,
                    border: "1px solid var(--border)",
                    background: extra.trim() || "#ffffff",
                    flexShrink: 0
                  }}
                />
              </div>
            ) : (
              <input
                id="data-extra"
                className="input"
                value={extra}
                onChange={e => setExtra(e.target.value)}
                placeholder={tab === "gangs" ? "true" : ""}
              />
            )}
          </div>
          {tab === "types" && (
            <div className="field">
              <label htmlFor="data-kind">Kind</label>
              <select
                id="data-kind"
                className="input"
                value={typeKind}
                onChange={e => setTypeKind(e.target.value as ActionTypeKind)}
              >
                <option value="action">Action (schedule + action tracker)</option>
                <option value="br">BR (BR tracker only)</option>
              </select>
            </div>
          )}
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button type="submit" className="btn">
              {editingId ? "Save changes" : "Add"}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Details</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={String(item.id)}>
                <td>{String(item.name)}</td>
                <td className="muted">
                  {tab === "staff" && String(item.rank ?? "—")}
                  {tab === "types" && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span
                        aria-hidden
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 3,
                          border: "1px solid var(--border)",
                          background: String(item.colourHex)
                        }}
                      />
                      {String(item.colourHex)}
                      {" · "}
                      {item.kind === "br" ? "BR" : "Action"}
                    </span>
                  )}
                  {tab === "gangs" && (item.org2Eligible ? "ORG2 ✓" : "ORG2 ✗")}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginRight: 8 }}
                    onClick={() => startEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => remove(String(item.id))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
