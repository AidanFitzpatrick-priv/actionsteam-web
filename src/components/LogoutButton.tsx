"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button type="button" className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 13 }} onClick={logout}>
      Log out
    </button>
  );
}
