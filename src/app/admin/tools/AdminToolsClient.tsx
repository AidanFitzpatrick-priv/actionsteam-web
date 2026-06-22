"use client";

import { useState } from "react";

export function AdminToolsClient() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function runRecalculate() {
    setMsg("");
    setLoading(true);
    const res = await fetch("/api/admin/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "recalculate" })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMsg(data.error ?? "Failed");
      return;
    }
    setMsg("Done.");
  }

  return (
    <div className="card">
      <h2>Admin tools</h2>
      <p className="muted">Force recalculate action and booking goal scores for the active month.</p>
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <button type="button" className="btn" disabled={loading} onClick={runRecalculate}>
          {loading ? "Recalculating…" : "Force recalculate"}
        </button>
      </div>
      {msg && <p className={msg === "Done." ? "success" : "error"} style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
