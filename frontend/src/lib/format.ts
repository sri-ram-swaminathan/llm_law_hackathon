/** Display formatting shared by every surface (dates read "4 Oct 15:20", durations "46 s" / "1 min 37 s"). */

const dt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const d = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

const parse = (iso: string | null | undefined) => {
  if (!iso) return null;
  const t = new Date(iso);
  return isNaN(+t) ? null : t;
};

/** "4 Oct 15:20" (local time); "" for a missing/invalid timestamp. */
export const fmtDateTime = (iso: string | null | undefined) => {
  const t = parse(iso);
  return t ? dt.format(t).replace(",", "") : "";
};
/** "4 Oct". */
export const fmtDate = (iso: string | null | undefined) => {
  const t = parse(iso);
  return t ? d.format(t) : "";
};
/** Seconds between two timestamps, or null. */
export const secondsBetween = (a: string | null | undefined, b: string | null | undefined) => {
  const x = parse(a), y = parse(b);
  return x && y ? Math.max(0, Math.round((+y - +x) / 1000)) : null;
};
/** "46 s" · "1 min 37 s". */
export const fmtSeconds = (s: number | null | undefined) => {
  if (s === null || s === undefined || !isFinite(s)) return "";
  const n = Math.round(s);
  return n < 60 ? `${n} s` : `${Math.floor(n / 60)} min${n % 60 ? ` ${n % 60} s` : ""}`;
};
/** "00:23" elapsed clock. */
export const fmtClock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
/** "2 min ago" style relative time. */
export function fmtRelative(iso: string | null | undefined, now = Date.now()) {
  const t = parse(iso);
  if (!t) return "";
  const s = Math.round((now - +t) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return fmtDate(iso);
}
/** "v0.9.0". */
export const versionLabel = (v: string) => (v.startsWith("v") ? v : `v${v}`);
/** "1 document" / "4 documents". */
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
