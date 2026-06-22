"use client";

import { useEffect, useRef } from "react";
import type { LiveEventRecord } from "@/lib/live-events";

type Options = {
  /** Poll interval ms (default 2000). */
  intervalMs?: number;
  monthSlug?: string;
  admin?: boolean;
  invites?: boolean;
  /** Skip events from this user (avoid echo after own PATCH). */
  selfUserId?: string;
  onEvent: (event: LiveEventRecord) => void;
};

/**
 * Polls /api/live/events for cross-user updates (~1–2s latency).
 * Works on Railway multi-instance (events stored in Postgres).
 */
export function useLiveSync({
  intervalMs = 2000,
  monthSlug,
  admin,
  invites,
  selfUserId,
  onEvent
}: Options) {
  const sinceRef = useRef(new Date().toISOString());
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      const params = new URLSearchParams({ since: sinceRef.current });
      if (monthSlug) params.set("monthSlug", monthSlug);
      if (admin) params.set("admin", "1");
      if (invites) params.set("invites", "1");

      try {
        const res = await fetch(`/api/live/events?${params}`);
        const data = await res.json();
        if (!res.ok || cancelled || !Array.isArray(data.events)) return;

        for (const ev of data.events as LiveEventRecord[]) {
          if (selfUserId && ev.actorId === selfUserId) continue;
          onEventRef.current(ev);
        }
        if (data.events.length) {
          sinceRef.current = (data.events as LiveEventRecord[])[data.events.length - 1].createdAt;
        }
      } catch {
        // ignore network blips
      }
    }

    poll();
    const timer = setInterval(poll, intervalMs);

    function onVisible() {
      if (document.visibilityState === "visible") poll();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs, monthSlug, admin, invites, selfUserId]);
}

/** Track row/slot ids currently being edited — skip remote merge for these. */
export function useEditingIds() {
  const ref = useRef(new Set<string>());
  return {
    ref,
    markEditing(id: string) {
      ref.current.add(id);
    },
    markDone(id: string) {
      ref.current.delete(id);
    }
  };
}
