"use client";

import { useState } from "react";

export function AdminToolsClient() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState("");

  async function run(action: "recalculate" | "import_schedule" | "import_june_sheet") {
    setMsg("");
    setLoading(action);
    const res = await fetch("/api/admin/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    setLoading("");
    if (!res.ok) {
      setMsg(data.error ?? "Failed");
      return;
    }
    if (action === "import_june_sheet" && data.result) {
      const r = data.result;
      setMsg(
        `Imported June schedule: ${r.updated} slots updated, ${r.synced} tracker rows synced, ${r.reference.typesCount} types, ${r.reference.gangsCount} gangs.`
      );
      return;
    }
    setMsg("Done.");
  }

  return (
    <div className="card">
      <h2>Admin tools</h2>
      <p className="muted">Force recalc, sync schedule→tracker, or import June sheet export into the site.</p>
      <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
        <button type="button" className="btn" disabled={!!loading} onClick={() => run("import_june_sheet")}>
          {loading === "import_june_sheet" ? "Importing…" : "Import June schedule (from sheet)"}
        </button>
        <button type="button" className="btn btn-secondary" disabled={!!loading} onClick={() => run("recalculate")}>
          Force recalculate
        </button>
        <button type="button" className="btn btn-secondary" disabled={!!loading} onClick={() => run("import_schedule")}>
          Sync schedule → tracker
        </button>
      </div>
      {msg && <p className={msg.startsWith("Imported") ? "success" : "error"} style={{ marginTop: 12 }}>{msg}</p>}
    </div>
  );
}
