import { motion, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router";
import { sortReleases, useReleases, versionLabel } from "@/lib/queries";
import { cn } from "@/lib/utils";

/** Segmented control; the pill glides between releases (layout animation) and the page below crossfades. */
export function ReleaseSwitcher({ current }: { current: string | undefined }) {
  const { data } = useReleases();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  const items = sortReleases(data ?? []);

  const go = (id: string) => {
    // keep the section; a specific finding/artifact does not exist across releases, so fall back to the list
    const section = pathname.match(/^\/r\/[^/]+\/([^/]+)/)?.[1] ?? "overview";
    nav(`/r/${id}/${section}`);
  };

  return (
    <div role="tablist" aria-label="Release" data-testid="release-switcher" className="relative inline-flex h-8 items-center rounded-md border bg-surface-2 p-0.5">
      {items.map(({ release: r }) => {
        const on = r.id === current;
        return (
          <button key={r.id} role="tab" aria-selected={on} onClick={() => go(r.id)} data-testid={`release-${r.version}`}
            className={cn("relative z-10 h-7 rounded-[6px] px-2.5 font-mono text-code transition-colors duration-fast", on ? "text-text" : "text-text-2 hover:text-text")}>
            {on && (
              <motion.span layoutId="release-pill" aria-hidden className="absolute inset-0 -z-10 rounded-[6px] border bg-surface shadow-sm"
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 38 }} />
            )}
            {versionLabel(r.version)}
            {r.source === "ci" && <span className="ml-1.5 align-middle text-[10px] uppercase tracking-wide text-text-3">ci</span>}
          </button>
        );
      })}
    </div>
  );
}
