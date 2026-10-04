import { useSyncExternalStore } from "react";

/**
 * Theme: System (follows `prefers-color-scheme`, no attribute) | Light | Dark (`html[data-theme]`).
 * index.html applies the stored choice before first paint; this store keeps it in sync afterwards.
 */
export type Theme = "system" | "light" | "dark";
const KEY = "cco.theme";

const read = (): Theme => {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch { return "system"; }
};
let current: Theme = typeof window === "undefined" ? "system" : read();
const listeners = new Set<() => void>();

const apply = (t: Theme) => {
  if (typeof document === "undefined") return;
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
};
apply(current);

export function setTheme(t: Theme) {
  current = t;
  try { t === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, t); } catch { /* ignore */ }
  apply(t);
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => (listeners.add(l), () => { listeners.delete(l); });
export const useTheme = (): Theme => useSyncExternalStore(subscribe, () => current, () => "system");

/** The theme actually rendered (resolves "system"). */
export function resolvedTheme(t: Theme = current): "light" | "dark" {
  if (t !== "system") return t;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
