import { useQueryClient } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { KeyRound } from "lucide-react";
import { authStore, needsToken, setToken } from "@/api/client";
import { Button } from "@/components/button";
import { Dialog } from "@/components/popover-menu";

/** Deploy-token prompt (stored in localStorage). Shown before anything fetches, and again after a 401. Never in fixtures mode. */
export function TokenPrompt() {
  useSyncExternalStore(authStore.subscribe, authStore.version);
  const qc = useQueryClient();
  const [v, setV] = useState("");
  const open = needsToken();
  return (
    <Dialog.Root open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" />
        <Dialog.Content onInteractOutside={(e) => e.preventDefault()} className="fixed left-1/2 top-1/3 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border bg-surface p-5 shadow-overlay">
          <Dialog.Title className="flex items-center gap-2 text-lg"><KeyRound className="h-4 w-4 text-accent" /> Deploy token</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-text-2">Enter the token for this CCOmmit deployment. It is stored in this browser only.</Dialog.Description>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!v.trim()) return;
              setToken(v.trim());
              setV("");
              qc.resetQueries();
            }}
          >
            <input autoFocus type="password" value={v} onChange={(e) => setV(e.target.value)} placeholder="Token" aria-label="Deploy token"
              className="h-9 min-w-0 flex-1 rounded-md border bg-surface-2 px-3 font-mono text-code outline-none focus:border-accent" />
            <Button type="submit" variant="primary" size="md">Continue</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
