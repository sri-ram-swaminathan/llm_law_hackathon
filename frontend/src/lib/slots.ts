import { createElement, useSyncExternalStore, Fragment, type ComponentType, type ReactNode } from "react";
import type { FindingView, ReleaseOut } from "@/api/client";

/**
 * Named slots seam (frozen by T27). A feature registers components from its own `index.ts(x)`
 * `register()` export (auto-discovered by app/registerFeatures.ts — no app edit needed); the shell
 * and pages render `<Slot name=… props=… />`. Several registrations render in `order`.
 *
 * Slot                 rendered by                         props                                   owner
 * check.actions        compliance check, below the verdict { findingId, releaseId }                T31 (counsel decision bar)
 * annotation.actions   document/code margin note           { findingId, releaseId, compact: true } T31
 * release.banner       under the release header            { releaseId, version, productId }       T31 (counsel banner), T32 (fallback)
 * release.runStrip     under the tabs, every release tab   { releaseId, version, productId }       T32
 * home.demo            workspace home product card         { productId }                           T32 (Start demo sheet)
 * summary.liveOverlay  Summary, while a run is in flight   { releaseId, runId }                    T32
 */
export type SlotProps = {
  "check.actions": { findingId: string; releaseId: string };
  "annotation.actions": { findingId: string; releaseId: string; compact?: boolean };
  "release.banner": { releaseId: string; version: string; productId: string; release: ReleaseOut };
  "release.runStrip": { releaseId: string; version: string; productId: string; release: ReleaseOut };
  "home.demo": { productId: string };
  "summary.liveOverlay": { releaseId: string; runId: string | null };
  /** @deprecated legacy finding page (T09); removed with features/finding. */
  "finding.tab.produced": { finding: FindingView };
  /** @deprecated legacy finding page (T09). */
  "finding.panel.review": { finding: FindingView };
  /** @deprecated legacy overview (T09/T17). */
  "overview.whatChanged": { releaseId: string; readiness: import("@/api/client").Readiness };
  /** @deprecated replaced by the Mode switch in the top bar; never rendered. */
  "header.persona": Record<string, never>;
};
export type SlotName = keyof SlotProps;

type Entry = { id: string; component: ComponentType<any>; order: number };
const registry = new Map<SlotName, Entry[]>();
const listeners = new Set<() => void>();
let version = 0;

export function registerSlot<N extends SlotName>(name: N, component: ComponentType<SlotProps[N]> | ComponentType<any>, opts: { id?: string; order?: number } = {}) {
  const id = opts.id ?? component.displayName ?? component.name ?? String(registry.get(name)?.length ?? 0);
  const list = (registry.get(name) ?? []).filter((e) => e.id !== id);
  list.push({ id, component, order: opts.order ?? 0 });
  list.sort((a, b) => a.order - b.order);
  registry.set(name, list);
  version++;
  listeners.forEach((l) => l());
}

export function getSlot(name: SlotName): ComponentType<any>[] {
  return (registry.get(name) ?? []).map((e) => e.component);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** True when something is registered under `name` (e.g. to reserve layout space). */
export const useHasSlot = (name: SlotName) => {
  useSyncExternalStore(subscribe, () => version);
  return getSlot(name).length > 0;
};

/** Renders every component registered under `name`; renders `fallback` when none. */
export function Slot<N extends SlotName>({ name, props, fallback = null }: { name: N; props?: SlotProps[N]; fallback?: ReactNode }) {
  useSyncExternalStore(subscribe, () => version);
  const items = getSlot(name);
  if (!items.length) return createElement(Fragment, null, fallback);
  return createElement(Fragment, null, ...items.map((C, i) => createElement(C, { key: i, ...(props ?? {}) })));
}
