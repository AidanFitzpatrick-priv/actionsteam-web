"use client";

import { useEffect, useRef } from "react";
import type { LiveEventRecord } from "@/lib/live-events";

type Options = {
  /** Poll interval ms (default 1500). */
  intervalMs?: number;
  monthSlug?: string;
  admin?: boolean;
  invites?: boolean;
  /** Skip events from this user (avoid echo after own PATCH). */
  selfUserId?: string;
  onEvent: (event: LiveEventRecord) => void;
};

const FETCH_OPTS: RequestInit = { cache: "no-store", credentials: "same-origin" };

/**
 * Polls /api/live/events for cross-user updates (~1–2s latency).
 * Works on Railway multi-instance (events stored in Postgres).
 */
export function useLiveSync({
  intervalMs = 1500,
  monthSlug,
  admin,
  invites,
  selfUserId,
  onEvent
}: Options) {
  /** Start 30s in the past so we don't miss events during page load. */
  const sinceRef = useRef(new Date(Date.now() - 30_000).toISOString());
  const seenIds = useRef(new Set<string>());
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
        const res = await fetch(`/api/live/events?${params}`, FETCH_OPTS);
        const data = await res.json();
        if (!res.ok || cancelled || !Array.isArray(data.events)) return;

        let latestCreatedAt = sinceRef.current;

        for (const ev of data.events as LiveEventRecord[]) {
          if (seenIds.current.has(ev.id)) continue;
          seenIds.current.add(ev.id);
          if (ev.createdAt > latestCreatedAt) latestCreatedAt = ev.createdAt;

          if (selfUserId && ev.actorId === selfUserId) continue;
          onEventRef.current(ev);
        }

        if (data.events.length) {
          // 2s overlap so boundary timestamps don't drop events
          sinceRef.current = new Date(new Date(latestCreatedAt).getTime() - 2000).toISOString();
        }

        if (seenIds.current.size > 500) {
          seenIds.current = new Set(
            (data.events as LiveEventRecord[]).slice(-100).map(e => e.id)
          );
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

export { FETCH_OPTS as liveFetchOpts };
