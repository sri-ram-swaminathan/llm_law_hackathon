import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CircleDashed, Loader2, Plus, X } from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { FIXTURES, http } from "@/api/client";
import type { components } from "@/api/types";
import { Button } from "@/components/button";
import { Card, CardHeader, Skeleton } from "@/components/card";
import { Notice } from "@/features/fixplan";
import { cn } from "@/lib/utils";

type ProductOut = components["schemas"]["ProductOut"];
type Profile = components["schemas"]["RegulatoryProfile"];

/* ---------------- data (fixtures keep state in memory) ---------------- */

let fixtureProduct: ProductOut = {
  product: { id: "wealthpilot", organization_id: "fintechproto", name: "Wealthpilot", description: "AI investment insights for French retail investors" },
  profile: {
    jurisdictions: ["EU", "FR"],
    industry: "Fintech: investment advice",
    activities: ["Personalised investment recommendations", "Portfolio tracking", "Onboarding with risk profiling"],
    customer_types: ["Retail investors (consumers)"],
    data_categories: ["Identity and contact data", "Financial situation and goals", "Portfolio holdings", "Account credentials"],
    ai_uses: ["LLM-generated investment recommendations", "AI-generated market summaries"],
    stage: "pre-launch",
    confirmed_at: null,
  },
};

const getProduct = async (): Promise<ProductOut> => {
  if (FIXTURES) { await new Promise((r) => setTimeout(r, 60)); return fixtureProduct; }
  return http<ProductOut>("/api/product");
};
const putProfile = async (p: Profile): Promise<ProductOut> => {
  if (FIXTURES) {
    await new Promise((r) => setTimeout(r, 300));
    fixtureProduct = { ...fixtureProduct, profile: { ...p, confirmed_at: new Date().toISOString() } };
    return fixtureProduct;
  }
  const res = await http<ProductOut | Profile>("/api/product/profile", { method: "PUT", body: JSON.stringify(p) });
  return "profile" in res ? res : { ...(await getProduct()), profile: res };
};

const STAGES = ["pre-launch", "operating", "scaling"];
const stageLabel = (s: string) => s.replace(/^./, (c) => c.toUpperCase());
const fmtStamp = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};
const same = (a: Profile, b: Profile) => JSON.stringify({ ...a, confirmed_at: null }) === JSON.stringify({ ...b, confirmed_at: null });

/* ---------------- page ---------------- */

export function ProfilePage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["product"], queryFn: getProduct });
  const [draft, setDraft] = useState<Profile | null>(null);
  useEffect(() => { if (q.data && !draft) setDraft(q.data.profile); }, [q.data, draft]);

  const save = useMutation({
    mutationFn: (p: Profile) => putProfile(p),
    onSuccess: (out) => { qc.setQueryData(["product"], out); setDraft(out.profile); },
  });

  const saved = q.data?.profile;
  const dirty = !!(draft && saved && !same(draft, saved));
  const confirmed = !!saved?.confirmed_at;
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6" data-testid="profile-page">
      <div className="mb-5">
        <h1 className="text-xl">Regulatory profile</h1>
        <p className="mt-1 text-sm text-text-2">
          What you are launching. The CCO decides which requirements apply from this profile, so check it before you rely on a result.
        </p>
      </div>

      {q.isLoading && <div className="space-y-3" aria-busy="true"><Skeleton className="h-16" /><Skeleton className="h-72" /></div>}
      {q.isError && <Notice title="The profile could not be loaded" body="Check that the backend is running, then try again." action={<Button onClick={() => q.refetch()}>Retry</Button>} />}

      {q.data && draft && (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(draft); }} data-testid="profile-form">
          <Card>
            <CardHeader
              title={q.data.product.name}
              right={
                confirmed && !dirty ? (
                  <span data-testid="confirmed-at" className="inline-flex items-center gap-1.5 text-xs text-satisfied-fg">
                    <BadgeCheck className="h-4 w-4" aria-hidden /> Confirmed {fmtStamp(saved!.confirmed_at!)}
                  </span>
                ) : (
                  <span data-testid="unconfirmed" className="inline-flex items-center gap-1.5 text-xs text-text-2">
                    <CircleDashed className="h-4 w-4" aria-hidden /> {confirmed ? "Changed since last confirmation" : "Not confirmed yet"}
                  </span>
                )
              }
            />
            <div className="space-y-5 px-4 py-4">
              {q.data.product.description && <p className="text-sm text-text-2">{q.data.product.description}</p>}

              <Field label="Industry" htmlFor="industry">
                <input id="industry" value={draft.industry} onChange={(e) => set("industry", e.target.value)}
                  className="h-9 w-full rounded-md border bg-surface px-3 text-sm outline-none focus:border-accent" />
              </Field>

              <Field label="Stage" htmlFor="stage">
                <div id="stage" role="radiogroup" aria-label="Stage" className="inline-flex h-9 items-center rounded-md border bg-surface-2 p-0.5">
                  {[...new Set([...STAGES, draft.stage].filter(Boolean))].map((s) => {
                    const on = draft.stage === s;
                    return (
                      <button key={s} type="button" role="radio" aria-checked={on} onClick={() => set("stage", s)}
                        className={cn("h-8 rounded-[6px] px-3 text-sm transition-colors duration-fast", on ? "border bg-surface text-text shadow-sm" : "text-text-2 hover:text-text")}>
                        {stageLabel(s)}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <TagField id="jurisdictions" label="Jurisdictions" values={draft.jurisdictions} onChange={(v) => set("jurisdictions", v)} placeholder="Add a jurisdiction, e.g. FR" />
              <TagField id="activities" label="Activities" values={draft.activities} onChange={(v) => set("activities", v)} placeholder="Add an activity" />
              <TagField id="customer_types" label="Customer types" values={draft.customer_types} onChange={(v) => set("customer_types", v)} placeholder="Add a customer type" />
              <TagField id="data_categories" label="Data categories" values={draft.data_categories} onChange={(v) => set("data_categories", v)} placeholder="Add a data category" />
              <TagField id="ai_uses" label="AI uses" values={draft.ai_uses} onChange={(v) => set("ai_uses", v)} placeholder="Add an AI use" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-xs text-text-3" aria-live="polite">
                {save.isError ? <span className="text-blocker-fg" role="alert">The profile could not be saved. Try again.</span>
                  : save.isSuccess && !dirty ? "Saved." : "Confirming records who confirmed what you are launching, and when."}
              </p>
              <div className="flex items-center gap-2">
                {dirty && <Button type="button" variant="ghost" size="md" onClick={() => { setDraft(saved!); save.reset(); }}>Reset</Button>}
                <Button type="submit" variant="primary" size="md" disabled={save.isPending || (confirmed && !dirty)} data-testid="confirm-profile">
                  {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Confirming</> : confirmed && !dirty ? "Confirmed" : confirmed ? "Confirm changes" : "Confirm profile"}
                </Button>
              </div>
            </div>
          </Card>
        </form>
      )}
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs uppercase tracking-[0.04em] text-text-2">{label}</label>
      {children}
    </div>
  );
}

function TagField({ id, label, values, onChange, placeholder }: {
  id: string; label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim();
    if (t && !values.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...values, t]);
    setText("");
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
    else if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
  };
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-surface px-2 py-1.5 focus-within:border-accent" data-testid={`field-${id}`}>
        {values.map((v) => (
          <span key={v} className="inline-flex h-6 items-center gap-1 rounded-full border bg-surface-2 pl-2.5 pr-1 text-sm">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}
              className="grid h-4 w-4 place-items-center rounded-full text-text-3 hover:bg-border hover:text-text"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <input id={id} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={key} onBlur={add} placeholder={values.length ? "" : placeholder}
          aria-label={`Add to ${label}`} className="h-6 min-w-[8rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-text-3" />
        {text.trim() && <button type="button" onClick={add} aria-label={`Add ${text.trim()}`} className="grid h-5 w-5 place-items-center rounded-full text-accent hover:bg-accent-soft"><Plus className="h-3.5 w-3.5" /></button>}
      </div>
    </Field>
  );
}

export function register(): void {
  // The profile is a routed page; it contributes nothing to named slots.
}
