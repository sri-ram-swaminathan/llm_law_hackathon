import { Gavel, Rocket } from "lucide-react";
import { useSyncExternalStore } from "react";
import { registerSlot } from "@/lib/slots";
import { cn } from "@/lib/utils";

export type Persona = "founder" | "counsel";
const KEY = "cco.persona";

const read = (): Persona => {
  try { return localStorage.getItem(KEY) === "counsel" ? "counsel" : "founder"; } catch { return "founder"; }
};
let current: Persona = read();
const listeners = new Set<() => void>();

export function setPersona(p: Persona) {
  current = p;
  try { localStorage.setItem(KEY, p); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
export const usePersona = (): Persona =>
  useSyncExternalStore((l) => (listeners.add(l), () => listeners.delete(l)), () => current, () => "founder");

const OPTIONS: { v: Persona; label: string; Icon: typeof Gavel }[] = [
  { v: "founder", label: "Founder", Icon: Rocket },
  { v: "counsel", label: "Counsel", Icon: Gavel },
];

export function PersonaToggle() {
  const p = usePersona();
  return (
    <div role="radiogroup" aria-label="Persona" className="flex rounded-md border bg-surface p-0.5" data-testid="persona-toggle">
      {OPTIONS.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={p === v}
          data-testid={`persona-${v}`}
          onClick={() => setPersona(v)}
          className={cn(
            "inline-flex h-6 items-center gap-1.5 rounded px-2 text-xs transition-colors duration-fast",
            p === v ? "bg-accent-soft text-accent" : "text-text-2 hover:text-text",
          )}
        >
          <Icon className="h-3 w-3" aria-hidden />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function register(): void {
  registerSlot("header.persona", PersonaToggle, { id: "persona" });
}
