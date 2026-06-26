"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (!data.user) {
          router.replace("/login");
          return;
        }
        if (!data.user.mustResetPassword) {
          router.replace("/");
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, passwordConfirm })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not update password");
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (loading) return <p className="muted container">Loading…</p>;

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h1>Set a new password</h1>
        <p className="muted">Your account requires a new password before you can continue.</p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label htmlFor="passwordConfirm">Confirm password</label>
            <input
              id="passwordConfirm"
              className="input"
              type="password"
              value={passwordConfirm}
              onChange={e => setPasswordConfirm(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
            />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" style={{ width: "100%" }}>
            Save password
          </button>
        </form>
      </div>
    </div>
  );
}
