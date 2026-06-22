"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState, Suspense } from "react";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const inviteToken = params.get("invite") ?? "";

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [cityId, setCityId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  const [validating, setValidating] = useState(!!inviteToken);

  useEffect(() => {
    if (!inviteToken) {
      setValidating(false);
      setError("Sign-up requires an invite link from your team.");
      return;
    }
    fetch(`/api/invites/validate?token=${encodeURIComponent(inviteToken)}`)
      .then(r => r.json())
      .then(data => {
        if (data.valid) setInvitedBy(data.invitedBy);
        else setError(data.reason ?? "Invalid invite");
      })
      .finally(() => setValidating(false));
  }, [inviteToken]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteToken, email, username, cityId, password, passwordConfirm })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Sign up failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h1>Create account</h1>
        {validating && <p className="muted">Checking invite…</p>}
        {invitedBy && <p className="muted">Invited by <strong>{invitedBy}</strong></p>}
        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="cityId">City ID</label>
            <input id="cityId" className="input" value={cityId} onChange={e => setCityId(e.target.value)} required maxLength={64} />
          </div>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" className="input" value={username} onChange={e => setUsername(e.target.value)} required pattern="[a-zA-Z0-9_\-]+" />
          </div>
          <div className="field">
            <label htmlFor="password">Password (min 10 characters)</label>
            <input id="password" className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={10} />
          </div>
          <div className="field">
            <label htmlFor="passwordConfirm">Confirm password</label>
            <input id="passwordConfirm" className="input" type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} required />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" style={{ width: "100%" }} disabled={!inviteToken || validating}>
            Sign up
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          Already have an account? <a href="/login">Log in</a>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="container"><p className="muted">Loading…</p></div>}>
      <SignupForm />
    </Suspense>
  );
}
