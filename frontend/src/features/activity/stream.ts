import { useEffect, useRef, useState } from "react";
import { API_URL, FIXTURES, getToken, type AgentEvent } from "@/api/client";
import { gapMs } from "./model";

/** Parse SSE text chunks into AgentEvents (`data:` lines; frames separated by a blank line). */
export function createSseParser(onEvent: (e: AgentEvent) => void) {
  let buf = "";
  return (chunk: string) => {
    buf += chunk;
    let i: number;
    while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i).replace(/^\r?\n\r?\n/, "");
      const data = frame.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
      if (!data) continue;
      try {
        const j = JSON.parse(data);
        onEvent((j && !j.type && j.data ? j.data : j) as AgentEvent);
      } catch { /* ignore malformed frame */ }
    }
  };
}

export type RunStream = {
  events: AgentEvent[];
  streaming: boolean;
  restart: () => void;
};

let fixtureEvents: Promise<AgentEvent[]> | null = null;
const loadFixtureEvents = () =>
  (fixtureEvents ??= import("@fixtures/events-0.9.0.json").then((m) => (m.default ?? m) as unknown as AgentEvent[]));

/**
 * Streams a run's events. Fixtures mode replays the recorded stream locally at its recorded pace
 * (divided by `speed`); API mode reads SSE through fetch so the Authorization header can be sent.
 * `instant` delivers everything at once (used for the static "How this was produced" tab).
 */
export function useRunStream(opts: { runId: string | null; enabled: boolean; speed: number; requirementId?: string; instant?: boolean }): RunStream {
  const { runId, enabled, requirementId, instant } = opts;
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [nonce, setNonce] = useState(0);
  const speedRef = useRef(opts.speed);
  speedRef.current = opts.speed;

  useEffect(() => {
    if (!enabled) return;
    setEvents([]);
    let cancelled = false;
    const ctl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const push = (batch: AgentEvent[]) => setEvents((cur) => [...cur, ...batch]);
    setStreaming(true);

    if (FIXTURES || !runId) {
      loadFixtureEvents().then((all) => {
        if (cancelled) return;
        const list = requirementId ? all.filter((e) => e.requirement_id === requirementId) : all;
        if (instant) { setEvents(list); setStreaming(false); return; }
        let i = 0;
        const step = () => {
          if (cancelled) return;
          if (i >= list.length) { setStreaming(false); return; }
          const cur = list[i++];
          push([cur]);
          if (i >= list.length) { setStreaming(false); return; }
          timer = setTimeout(step, gapMs(cur, list[i], speedRef.current));
        };
        step();
      });
    } else {
      (async () => {
        let after = 0;
        // Reconnect once on speed-independent drops; the stream closes by itself after run_end.
        for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
          try {
            const q = new URLSearchParams({ after_seq: String(after), replay: "1", speed: String(instant ? 1000 : speedRef.current) });
            if (requirementId) q.set("requirement_id", requirementId);
            const token = getToken();
            const res = await fetch(`${API_URL}/api/runs/${runId}/events?${q}`, {
              signal: ctl.signal,
              headers: { Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
            if (!res.ok || !res.body) throw new Error(String(res.status));
            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let ended = false;
            const parse = createSseParser((e) => {
              if (e.seq <= after) return;
              after = e.seq;
              if (e.type === "run_end") ended = true;
              push([e]);
            });
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              parse(dec.decode(value, { stream: true }));
            }
            if (ended || cancelled) break;
          } catch {
            if (cancelled) break;
            await new Promise((r) => setTimeout(r, 800));
          }
        }
        if (!cancelled) setStreaming(false);
      })();
    }
    return () => { cancelled = true; ctl.abort(); if (timer) clearTimeout(timer); };
  }, [runId, enabled, requirementId, instant, nonce]);

  return { events, streaming, restart: () => setNonce((n) => n + 1) };
}
