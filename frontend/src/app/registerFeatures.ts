/**
 * Every feature folder may export `register()` from its `index.ts(x)` to contribute slot components.
 * Discovered by glob, so adding or deleting a feature folder never requires editing `src/app/**`.
 */
const modules = import.meta.glob<{ register?: () => void }>("../features/*/index.{ts,tsx}", { eager: true });

let done = false;
export function registerFeatures() {
  if (done) return;
  done = true;
  for (const m of Object.values(modules)) if (typeof m.register === "function") m.register();
}
