"use client";

import { useCallback, useEffect, useState } from "react";

export function AdminToolsClient() {
  const [msg, setMsg] = useState("");

  async function run(action: "recalculate" | "import_schedule") {
    setMsg("");
    const res = await fetch("/api/admin/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    setMsg(res.ok ? "Done." : (data.error ?? "Failed"));
  }

  return (
    <div className="card">
      <h2>Admin tools</h2>
      <p className="muted">Force recalc points + stats, or import schedule → tracker for active month.</p>
      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button type="button" className="btn" onClick={() => run("recalculate")}>Force recalculate</button>
        <button type="button" className="btn btn-secondary" onClick={() => run("import_schedule")}>Import schedule → tracker</button>
      </div>
      {msg && <p className="success" style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
