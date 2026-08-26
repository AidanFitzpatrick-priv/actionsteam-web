"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { UserRole } from "@prisma/client";
import { GOAL_TRACKER_ROLE_GROUPS } from "@/lib/rbac";
import { useLiveSync } from "@/hooks/useLiveSync";

type ResultKind = "positive" | "negative";

type ActionLogRow = {
  id: string;
  createdAt: string;
  orgName: string;
  actionText: string;
  result: ResultKind;
  positiveNumber: number | null;
  negativeReason: string | null;
  proofUrl: string;
  staffName: string;
  cityId: string | null;
  canDelete: boolean;
};

type DailyGoal = {
  date: string;
  rows: { staffName: string; role: UserRole; met: boolean }[];
  metCount: number;
  total: number;
};

function formatLogTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(new Date(iso))
    .replace(",", "");
}

export function ActionLogClient() {
  const [orgOptions, setOrgOptions] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActionLogRow[]>([]);
  const [isAuxPlus, setIsAuxPlus] = useState(false);
  const [viewerId, setViewerId] = useState<string>();
  const [dailyGoal, setDailyGoal] = useState<DailyGoal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [orgName, setOrgName] = useState("");
  const [actionText, setActionText] = useState("");
  const [result, setResult] = useState<ResultKind>("positive");
  const [positiveNumber, setPositiveNumber] = useState("");
  const [negativeReason, setNegativeReason] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/action-logs", { cache: "no-store", credentials: "same-origin" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Failed to load logs");
      return;
    }
    setOrgOptions(json.orgOptions ?? []);
    setLogs(json.logs ?? []);
    setIsAuxPlus(Boolean(json.isAuxPlus));
    setViewerId(json.viewerId);
    setDailyGoal(json.dailyGoal ?? null);
    setLoaded(true);
    setError("");
  }, []);

  useEffect(() => {
    load().catch(() => setError("Failed to load logs"));
  }, [load]);

  useLiveSync({
    selfUserId: viewerId,
    acceptOwnEventTypes: ["action_log.created", "action_log.deleted", "admin.updated"],
    onEvent: ev => {
      if (ev.type === "action_log.created" || ev.type === "action_log.deleted" || ev.type === "admin.updated") {
        load().catch(() => {});
      }
    }
  });

  const groupedDailyGoal = useMemo(() => {
    if (!dailyGoal) return [];
    return GOAL_TRACKER_ROLE_GROUPS.map(g => ({
      label: g.label,
      rows: dailyGoal.rows.filter(r => r.role === g.role)
    })).filter(g => g.rows.length > 0);
  }, [dailyGoal]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setToast("");
    setSubmitting(true);
    try {
      const payload = {
        orgName,
        actionText,
        result,
        proofUrl,
        positiveNumber: result === "positive" ? Number(positiveNumber) : null,
        negativeReason: result === "negative" ? negativeReason : null
      };
      const res = await fetch("/api/action-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not submit log");
        return;
      }
      setOrgName("");
      setActionText("");
      setResult("positive");
      setPositiveNumber("");
      setNegativeReason("");
      setProofUrl("");
      setToast("Log submitted");
      await load();
    } catch {
      setError("Could not submit log");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this log?")) return;
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/action-logs/${id}`, {
        method: "DELETE",
        credentials: "same-origin"
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not delete log");
        return;
      }
      setLogs(prev => prev.filter(l => l.id !== id));
      await load();
    } catch {
      setError("Could not delete log");
    } finally {
      setDeletingId(null);
    }
  }

  if (!loaded && !error) return <p className="muted">Loading…</p>;

  return (
    <div>
      <h1>Action log</h1>
      {toast && <p className="success">{toast}</p>}
      {error && <p className="error">{error}</p>}

      <div className={isAuxPlus ? "action-log-layout" : "action-log-form-narrow"}>
        <div className="card">
          <h2>Log an action</h2>
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="action-log-org">Organisation</label>
              <select
                id="action-log-org"
                className="select"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                required
              >
                <option value="">—</option>
                {orgOptions.map(o => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="action-log-action">Action</label>
              <input
                id="action-log-action"
                className="input"
                value={actionText}
                onChange={e => setActionText(e.target.value)}
                maxLength={500}
                required
              />
            </div>
            <div className="field">
              <span className="action-log-label">Result</span>
              <div className="action-log-result-toggle" role="group" aria-label="Result">
                <button
                  type="button"
                  className={`btn-toggle${result === "positive" ? " is-positive" : ""}`}
                  aria-pressed={result === "positive"}
                  onClick={() => {
                    setResult("positive");
                    setNegativeReason("");
                  }}
                >
                  Positive
                </button>
                <button
                  type="button"
                  className={`btn-toggle${result === "negative" ? " is-negative" : ""}`}
                  aria-pressed={result === "negative"}
                  onClick={() => {
                    setResult("negative");
                    setPositiveNumber("");
                  }}
                >
                  Negative
                </button>
              </div>
            </div>
            {result === "positive" ? (
              <div className="field">
                <label htmlFor="action-log-number">If positive what was the numbers</label>
                <input
                  id="action-log-number"
                  className="input"
                  type="number"
                  step="any"
                  value={positiveNumber}
                  onChange={e => setPositiveNumber(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="field">
                <label htmlFor="action-log-why">If negative, why</label>
                <textarea
                  id="action-log-why"
                  className="input"
                  rows={3}
                  value={negativeReason}
                  onChange={e => setNegativeReason(e.target.value)}
                  maxLength={1000}
                  required
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="action-log-proof">Proof</label>
              <input
                id="action-log-proof"
                className="input"
                type="url"
                placeholder="https://"
                value={proofUrl}
                onChange={e => setProofUrl(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? "Submitting…" : "Submit log"}
            </button>
          </form>
        </div>

        {isAuxPlus && dailyGoal && (
          <div className="card">
            <div className="action-log-goal-head">
              <h2>Daily goal</h2>
              <span className="action-log-badge">aux+ only</span>
            </div>
            <p className="muted">1 log per person per day</p>
            <table className="table action-log-goal-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Today</th>
                </tr>
              </thead>
              <tbody>
                {groupedDailyGoal.map(group => (
                  <Fragment key={group.label}>
                    <tr className="goal-group-heading">
                      <td colSpan={2}>{group.label}</td>
                    </tr>
                    {group.rows.map(row => (
                      <tr key={row.staffName}>
                        <td>{row.staffName}</td>
                        <td>
                          {row.met ? "1/1" : "0/1"}{" "}
                          <span className={row.met ? "pill-met" : "pill-missing"}>
                            {row.met ? "Met" : "Missing"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <p className="muted action-log-goal-foot">
              Goal: 1 per day · {dailyGoal.metCount} of {dailyGoal.total} met today
            </p>
          </div>
        )}
      </div>

      <div className="card action-log-list-card">
        <h2>{isAuxPlus ? "All logs" : "Your logs"}</h2>
        {isAuxPlus && <p className="muted">You can see every submission (aux+).</p>}
        <div className="action-log-table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Staff</th>
                <th>ID</th>
                <th>Organisation</th>
                <th>Action</th>
                <th>Result</th>
                <th>Numbers / why</th>
                <th>Proof</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="muted">
                    No logs yet.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id}>
                    <td>{formatLogTime(log.createdAt)}</td>
                    <td>{log.staffName}</td>
                    <td>{log.cityId || "—"}</td>
                    <td>{log.orgName}</td>
                    <td>{log.actionText}</td>
                    <td>
                      <span className={log.result === "positive" ? "pill-positive" : "pill-negative"}>
                        {log.result === "positive" ? "Positive" : "Negative"}
                      </span>
                    </td>
                    <td>
                      {log.result === "positive"
                        ? log.positiveNumber
                        : log.negativeReason}
                    </td>
                    <td>
                      <a href={log.proofUrl} target="_blank" rel="noopener noreferrer">
                        Open
                      </a>
                    </td>
                    <td>
                      {log.canDelete && (
                        <button
                          type="button"
                          className="btn btn-danger btn-compact"
                          disabled={deletingId === log.id}
                          onClick={() => onDelete(log.id)}
                        >
                          {deletingId === log.id ? "Deleting…" : "Delete"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
