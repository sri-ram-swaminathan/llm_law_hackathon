import { setMode, useMode, type Mode } from "@/lib/mode";

/**
 * @deprecated The persona toggle became the Founder | Counsel Mode switch in the top bar (lib/mode.ts).
 * Kept as a thin alias so older imports keep working; contributes nothing to slots.
 */
export type Persona = Mode;
export const usePersona = useMode;
export const setPersona = (p: Persona) => setMode(p);

export function register(): void {
  // The Mode switch lives in app/TopBar.tsx.
}
