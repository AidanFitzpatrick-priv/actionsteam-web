"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const OPEN_PATHS = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

export function PasswordResetGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (OPEN_PATHS.has(pathname)) return;
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(data => {
        if (data.user?.mustResetPassword) {
          router.replace("/reset-password");
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  return children;
}
