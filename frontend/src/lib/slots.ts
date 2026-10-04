import { createElement, useSyncExternalStore, Fragment, type ComponentType, type ReactNode } from "react";

/**
 * Named slots: feature folders register components from their own index.tsx;
 * shell pages render <Slot name=... props=... />. Later tasks never edit src/app/**.
 */
export type SlotName =
  | "finding.tab.produced" // "How this was produced" tab body (T09) — props: { finding: FindingView }
  | "finding.panel.review" // inline review panel (T09) — props: { finding: FindingView }
  | "overview.whatChanged" // "What changed" panel override (T09/T17) — props: { releaseId: string }
  | "header.persona"; // persona toggle (T09) — props: {}

type Entry = { id: string; component: ComponentType<any>; order: number };
const registry = new Map<SlotName, Entry[]>();
const listeners = new Set<() => void>();
let version = 0;

export function registerSlot(name: SlotName, component: ComponentType<any>, opts: { id?: string; order?: number } = {}) {
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

/** Renders every component registered under `name`; renders `fallback` when none. */
export function Slot({ name, props = {}, fallback = null }: { name: SlotName; props?: Record<string, unknown>; fallback?: ReactNode }) {
  useSyncExternalStore(subscribe, () => version);
  const items = getSlot(name);
  if (!items.length) return createElement(Fragment, null, fallback);
  return createElement(Fragment, null, ...items.map((C, i) => createElement(C, { key: i, ...props })));
}
