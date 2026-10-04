import { useSyncExternalStore } from "react";

/**
 * Founder | Counsel mode seam (DESIGN §4.10). One store; persisted in localStorage and mirrored to
 * `?mode=counsel` by the shell (app/Shell.tsx), so a shared link opens in review. A `?mode=` in the
 * first URL wins over localStorage. Applying the mode sets `body[data-mode]`, which draws the teal frame.
 * Founder mode never renders decision UI: gate it with `useMode() === "counsel"`.
 */
export type Mode = "founder" | "counsel";
const KEY = "cco.mode";

const fromUrl = (): Mode | null => {
  try {
    const m = new URLSearchParams(window.location.search).get("mode");
    return m === "counsel" || m === "founder" ? m : null;
  } catch { return null; }
};
const fromStorage = (): Mode => {
  try { return localStorage.getItem(KEY) === "counsel" ? "counsel" : "founder"; } catch { return "founder"; }
};

let current: Mode = typeof window === "undefined" ? "founder" : fromUrl() ?? fromStorage();
const listeners = new Set<() => void>();

const apply = (m: Mode) => {
  if (typeof document !== "undefined") document.body.dataset.mode = m;
};
apply(current);

export const getMode = () => current;
export function setMode(m: Mode) {
  if (m === current) return;
  current = m;
  try { localStorage.setItem(KEY, m); } catch { /* ignore */ }
  apply(m);
  listeners.forEach((l) => l());
}
export const toggleMode = () => setMode(current === "counsel" ? "founder" : "counsel");
const subscribe = (l: () => void) => (listeners.add(l), () => { listeners.delete(l); });
export const useMode = (): Mode => useSyncExternalStore(subscribe, getMode, () => "founder");
