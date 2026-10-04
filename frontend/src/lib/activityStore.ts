import { useSyncExternalStore } from "react";

/** Activity panel state. T09 renders the panel from this store; the Run button calls openActivity(runId). */
type State = { open: boolean; runId: string | null };
let state: State = { open: false, runId: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const activityStore = {
  get: () => state,
  subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
};
export function openActivity(runId: string | null) {
  state = { open: true, runId };
  emit();
}
export function closeActivity() {
  state = { ...state, open: false };
  emit();
}
export const useActivity = () => useSyncExternalStore(activityStore.subscribe, activityStore.get);
