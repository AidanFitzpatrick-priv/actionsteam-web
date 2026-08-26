"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLiveSync } from "@/hooks/useLiveSync";

type Tab = "types" | "gangs";
type ActionTypeKind = "action" | "br";

const TAB_LABELS: Record<Tab, string> = {
  types: "Types",
  gangs: "Gangs"
};

export function AdminDataClient() {
  const [tab, setTab] = useState<Tab>("types");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState("");
  const [colour, setColour] = useState("#fce5cd");
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
    setColour("#fce5cd");
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
    if (tab === "types") {
      setColour(String(item.colourHex ?? "#ffffff"));
      setTypeKind((item.kind as ActionTypeKind) ?? "action");
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setColour("#fce5cd");
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
    if (tab === "types") {
      body.colourHex = colour.trim() || "#ffffff";
      body.kind = typeKind;
    }

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
        {(["types", "gangs"] as Tab[]).map(t => (
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
        <form onSubmit={save} className={tab === "types" ? "grid-2" : undefined}>
          <div className="field">
            <label htmlFor="data-name">{tab === "types" ? "Type name" : "Gang name"}</label>
            <input
              id="data-name"
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>
          {tab === "types" && (
            <>
              <div className="field">
                <label htmlFor="data-colour">Colour</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    id="data-colour"
                    className="input"
                    value={colour}
                    onChange={e => setColour(e.target.value)}
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
                      background: colour.trim() || "#ffffff",
                      flexShrink: 0
                    }}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="data-kind">Kind</label>
                <select
                  id="data-kind"
                  className="input"
                  value={typeKind}
                  onChange={e => setTypeKind(e.target.value as ActionTypeKind)}
                >
                  <option value="action">Action</option>
                  <option value="br">BR</option>
                </select>
              </div>
            </>
          )}
          <div style={{ gridColumn: tab === "types" ? "1 / -1" : undefined, display: "flex", gap: 8, marginTop: tab === "gangs" ? 12 : 0 }}>
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
              {tab === "types" && <th>Kind</th>}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={String(item.id)}>
                <td>
                  {tab === "types" ? (
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
                      {String(item.name)}
                    </span>
                  ) : (
                    String(item.name)
                  )}
                </td>
                {tab === "types" && (
                  <td className="muted">{item.kind === "br" ? "BR" : "Action"}</td>
                )}
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
