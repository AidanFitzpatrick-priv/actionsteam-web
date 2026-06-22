"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLiveSync } from "@/hooks/useLiveSync";

type Tab = "staff" | "types" | "gangs";

export function AdminDataClient() {
  const [tab, setTab] = useState<Tab>("staff");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/data?entity=${tab}`);
    const data = await res.json();
    if (res.ok) setItems(data.items);
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  useLiveSync({
    admin: true,
    onEvent: ev => {
      if (ev.type === "admin.updated") load();
    }
  });

  async function save(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { entity: tab, action: "upsert", name };
    if (tab === "staff") body.rank = extra || null;
    if (tab === "types") body.colourHex = extra || "#ffffff";
    if (tab === "gangs") body.org2Eligible = extra !== "false";

    await fetch("/api/admin/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    setName("");
    setExtra("");
    await load();
  }

  async function remove(id: string) {
    await fetch("/api/admin/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: tab, action: "delete", id })
    });
    await load();
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["staff", "types", "gangs"] as Tab[]).map(t => (
          <button key={t} type="button" className={tab === t ? "btn" : "btn btn-secondary"} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={save} className="grid-2">
          <div className="field">
            <label htmlFor="data-name">Name</label>
            <input id="data-name" className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="data-extra">{tab === "staff" ? "Rank" : tab === "types" ? "Colour hex" : "ORG2 eligible (true/false)"}</label>
            <input id="data-extra" className="input" value={extra} onChange={e => setExtra(e.target.value)} placeholder={tab === "types" ? "#fce5cd" : ""} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <button type="submit" className="btn">Add / update</button>
          </div>
        </form>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Name</th><th>Details</th><th /></tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={String(item.id)}>
                <td>{String(item.name)}</td>
                <td className="muted">
                  {tab === "staff" && String(item.rank ?? "—")}
                  {tab === "types" && String(item.colourHex)}
                  {tab === "gangs" && (item.org2Eligible ? "ORG2 ✓" : "ORG2 ✗")}
                </td>
                <td><button type="button" className="btn btn-danger" onClick={() => remove(String(item.id))}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
