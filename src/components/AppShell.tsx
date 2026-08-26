"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { LogoutButton } from "@/components/LogoutButton";
import { fileToAvatarDataUrl } from "@/lib/avatar-client";

export type AppShellLink = { href: string; label: string; match?: "exact" | "prefix" };

export function AppShell({
  username,
  roleLabel,
  avatarUpdatedAt,
  links,
  children
}: {
  username: string;
  roleLabel: string;
  avatarUpdatedAt?: string | null;
  links: AppShellLink[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const crumb = pathname.replace(/^\//, "") || "home";
  const initials = username.slice(0, 2).toUpperCase();
  const photoSrc = preview ?? (avatarUpdatedAt ? `/api/me/avatar?v=${encodeURIComponent(avatarUpdatedAt)}` : null);

  function isActive(link: AppShellLink) {
    if (link.match === "prefix") {
      return pathname === link.href || pathname.startsWith(`${link.href}/`);
    }
    return pathname === link.href;
  }

  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setPhotoError("");
    try {
      const image = await fileToAvatarDataUrl(file);
      const res = await fetch("/api/me/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not update photo");
      setPreview(image);
      router.refresh();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not update photo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="shell">
      <aside className={`sidebar${open ? " open" : ""}`}>
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-mark">AT</span>
          <div>
            <strong>Actions</strong>
            <small>Tracker</small>
          </div>
        </Link>
        <nav>
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={isActive(link) ? "active" : undefined}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-user">
          <button
            type="button"
            className="sidebar-account"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Change photo"
            aria-label={`Change photo for ${username}`}
          >
            <span className="avatar-wrap" aria-hidden>
              <span className={`avatar${photoSrc ? " has-photo" : ""}`}>
                {photoSrc ? <img src={photoSrc} alt="" /> : initials}
              </span>
              <span className="avatar-edit">{uploading ? "…" : "Edit"}</span>
            </span>
            <div>
              <strong>{username}</strong>
              <small>{roleLabel}</small>
            </div>
          </button>
          <LogoutButton />
          {photoError && <p className="sidebar-photo-error">{photoError}</p>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onPickPhoto}
        />
      </aside>
      <div className="main">
        <header className="topbar">
          <button type="button" className="menu-btn" onClick={() => setOpen(v => !v)} aria-label="Menu">
            ☰
          </button>
          <div className="crumb">{crumb}</div>
          <div className="topbar-user">
            {username} · {roleLabel}
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
      {open && <button type="button" className="backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />}
    </div>
  );
}
