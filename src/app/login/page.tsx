"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Login failed");
      return;
    }
    router.push(data.mustResetPassword ? "/reset-password" : "/");
    router.refresh();
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h1>Log in</h1>
        <p className="muted">Use your email or username.</p>
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="identifier">Email or username</label>
            <input id="identifier" className="input" value={identifier} onChange={e => setIdentifier(e.target.value)} required autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" style={{ width: "100%" }}>Log in</button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          <Link href="/forgot-password">Forgot password?</Link>
        </p>
        <p className="muted" style={{ marginTop: 8 }}>
          Need an account? Ask a Sub Lead or above for an invite link.
        </p>
      </div>
    </div>
  );
}
