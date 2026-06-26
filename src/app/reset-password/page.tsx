"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const isEmailReset = Boolean(token);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  useEffect(() => {
    if (isEmailReset) {
      fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
        .then(r => r.json())
        .then(data => setTokenValid(Boolean(data.valid)))
        .finally(() => setLoading(false));
      return;
    }

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
  }, [isEmailReset, token, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isEmailReset ? { token } : {}),
        password,
        passwordConfirm
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not update password");
      return;
    }
    router.push(isEmailReset ? "/login" : "/");
    router.refresh();
  }

  if (loading) return <p className="muted container">Loading…</p>;

  if (isEmailReset && !tokenValid) {
    return (
      <div className="container" style={{ maxWidth: 420 }}>
        <div className="card">
          <h1>Reset link expired</h1>
          <p className="muted">This password reset link is invalid or has expired.</p>
          <p style={{ marginTop: 16 }}>
            <Link href="/forgot-password">Request a new link</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h1>Set a new password</h1>
        <p className="muted">
          {isEmailReset
            ? "Choose a new password for your account."
            : "Your account requires a new password before you can continue."}
        </p>
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
        {isEmailReset && (
          <p className="muted" style={{ marginTop: 16 }}>
            <Link href="/login">Back to log in</Link>
          </p>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="muted container">Loading…</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
