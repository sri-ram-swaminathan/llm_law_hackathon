import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronDown, ChevronLeft, Gavel, Monitor, Moon, Rocket, Sun } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useMatch, useNavigate } from "react-router";
import { Menu, Popover } from "@/components/popover-menu";
import { GateChip } from "@/components/tags";
import { Skeleton } from "@/components/card";
import { fmtDate, versionLabel } from "@/lib/format";
import { setMode, useMode, type Mode } from "@/lib/mode";
import { useProduct, useReadinessMany, useReleasesSorted } from "@/lib/queries";
import { ORG, paths, RELEASE_TABS, type ReleaseTab } from "@/lib/routes";
import { setTheme, useTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

function Wordmark() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold tracking-[-0.01em]" aria-label="CCOmmit home">
      <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)]">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <span className="hidden sm:inline">CCO<span className="text-text-2">mmit</span></span>
    </Link>
  );
}

const Sep = () => <span aria-hidden className="select-none px-0.5 text-text-3">/</span>;
const crumb = "truncate rounded-sm px-1.5 py-0.5 text-sm transition-colors duration-fast";

/** The only version picker: a popover of the semver timeline with gate chips. Keeps the current tab. */
function VersionPicker({ productId, version, compact }: { productId: string; version: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const releases = useReleasesSorted();
  const gates = useReadinessMany((releases.data ?? []).map((r) => r.release.id));
  const nav = useNavigate();
  const { pathname } = useLocation();
  const tab = (pathname.match(/\/v\/[^/]+\/([^/?]+)/)?.[1] ?? "summary") as ReleaseTab;
  const keep: ReleaseTab = RELEASE_TABS.includes(tab) ? tab : "summary";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        data-testid={compact ? "crumb-version-compact" : "crumb-version"}
        className={cn(crumb, "inline-flex items-center gap-1 font-mono text-code text-text hover:bg-surface-2 data-[state=open]:bg-surface-2", compact && "px-1")}
      >
        {versionLabel(version)}
        <ChevronDown className="h-3 w-3 text-text-3" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className="z-50 w-72 rounded-md border bg-surface p-1 shadow-overlay" data-testid="version-popover">
          <div className="px-2 pb-1 pt-1.5 text-xs text-text-3">Releases</div>
          {releases.isPending && <Skeleton className="m-1 h-8" />}
          {(releases.data ?? []).map((r, i) => {
            const g = gates[i]?.data;
            const on = r.release.version === version;
            return (
              <button
                key={r.release.id}
                type="button"
                data-testid={`version-option-${r.release.version}`}
                onClick={() => { setOpen(false); nav(paths.release(productId, r.release.version, keep)); }}
                className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors duration-fast hover:bg-surface-2", on && "bg-surface-2")}
              >
                <span className="w-4 shrink-0">{on && <Check className="h-3.5 w-3.5 text-accent" />}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-code text-text">{versionLabel(r.release.version)}</span>
                <span className="text-xs text-text-3">{fmtDate(r.release.created_at)}</span>
                {g ? <GateChip gate={g.gate} label={g.gate_label} /> : <span className="h-5 w-16" />}
              </button>
            );
          })}
          <div className="mt-1 border-t px-2 pb-1 pt-1.5">
            <Link to={paths.product(productId)} onClick={() => setOpen(false)} className="text-xs text-text-2 hover:text-text">All releases</Link>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** `Wealthpilot SAS / Wealthpilot / v0.9.0 ▾`; below `md` it collapses to `‹ Wealthpilot · v0.9.0 ▾`. */
function Breadcrumb() {
  const rel = useMatch("/p/:productId/v/:version/*");
  const prod = useMatch("/p/:productId/*");
  const product = useProduct();
  const productId = rel?.params.productId ?? prod?.params.productId;
  const version = rel?.params.version;
  const orgName = product.data?.organization?.name ?? ORG.name;
  const productName = product.data?.product.name ?? "Wealthpilot";
  const onProductHome = !!prod && !rel && /^\/p\/[^/]+\/?$/.test(prod.pathname);

  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumb" className="flex min-w-0 items-center">
      {/* full trail (md+) */}
      <ol className="hidden min-w-0 items-center md:flex">
        <li className="min-w-0">
          {productId
            ? <Link to={paths.home()} data-testid="crumb-org" className={cn(crumb, "text-text-2 hover:bg-surface-2 hover:text-text")}>{orgName}</Link>
            : <span data-testid="crumb-org" aria-current="page" className={cn(crumb, "font-medium text-text")}>{orgName}</span>}
        </li>
        {productId && (
          <li className="flex min-w-0 items-center">
            <Sep />
            {onProductHome
              ? <span data-testid="crumb-product" aria-current="page" className={cn(crumb, "font-medium text-text")}>{productName}</span>
              : <Link to={paths.product(productId)} data-testid="crumb-product" className={cn(crumb, "text-text-2 hover:bg-surface-2 hover:text-text")}>{productName}</Link>}
          </li>
        )}
        {productId && version && (
          <li className="flex items-center"><Sep /><VersionPicker productId={productId} version={version} /></li>
        )}
      </ol>
      {/* collapsed (< md) */}
      <div className="flex min-w-0 items-center gap-0.5 md:hidden" data-testid="breadcrumb-compact">
        {productId && (
          <Link
            to={version ? paths.product(productId) : paths.home()}
            className={cn(crumb, "inline-flex min-w-0 items-center gap-0.5 px-1 text-text-2 hover:text-text")}
            aria-label={`Back to ${version ? productName : orgName}`}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{version ? productName : orgName}</span>
          </Link>
        )}
        {productId && version && <><span aria-hidden className="text-text-3">·</span><VersionPicker productId={productId} version={version} compact /></>}
        {productId && !version && <><span aria-hidden className="text-text-3">·</span><span className={cn(crumb, "font-medium text-text")}>{productName}</span></>}
        {!productId && <span className={cn(crumb, "font-medium text-text")}>{orgName}</span>}
      </div>
    </nav>
  );
}

const MODES: { v: Mode; label: string; Icon: typeof Gavel }[] = [
  { v: "founder", label: "Founder", Icon: Rocket },
  { v: "counsel", label: "Counsel", Icon: Gavel },
];

/** Founder | Counsel segmented control. Counsel is the teal mode (DESIGN §4.10). */
export function ModeSwitch() {
  const mode = useMode();
  const reduce = useReducedMotion();
  return (
    <div role="radiogroup" aria-label="Mode" data-testid="mode-switch" className="relative flex h-8 items-center rounded-md border bg-surface-2 p-0.5">
      {MODES.map(({ v, label, Icon }) => {
        const on = mode === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={`mode-${v}`}
            title={v === "counsel" ? "Counsel mode: review findings and record decisions" : "Founder mode"}
            onClick={() => setMode(v)}
            className={cn(
              "relative z-10 inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2 text-xs font-medium transition-colors duration-fast",
              on ? (v === "counsel" ? "text-counsel-fg" : "text-text") : "text-text-2 hover:text-text",
            )}
          >
            {on && (
              <motion.span
                layoutId="mode-pill"
                aria-hidden
                className={cn("absolute inset-0 -z-10 rounded-[5px] border shadow-sm", v === "counsel" ? "border-counsel-bd bg-counsel-bg" : "bg-surface")}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

const THEMES: { v: Theme; label: string; Icon: typeof Sun }[] = [
  { v: "system", label: "System", Icon: Monitor },
  { v: "light", label: "Light", Icon: Sun },
  { v: "dark", label: "Dark", Icon: Moon },
];
export function ThemeToggle() {
  const theme = useTheme();
  const Cur = THEMES.find((t) => t.v === theme)!.Icon;
  return (
    <Menu.Root>
      <Menu.Trigger data-testid="theme-toggle" aria-label={`Theme: ${theme}`} className="grid h-8 w-8 place-items-center rounded-md text-text-2 transition-colors duration-fast hover:bg-surface-2 hover:text-text data-[state=open]:bg-surface-2">
        <Cur className="h-4 w-4" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={6} className="z-50 min-w-36 rounded-md border bg-surface p-1 shadow-overlay">
          {THEMES.map(({ v, label, Icon }) => (
            <Menu.Item key={v} data-testid={`theme-${v}`} onSelect={() => setTheme(v)} className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface-2">
              <Icon className="h-3.5 w-3.5 text-text-2" /> {label}
              {theme === v && <Check className="ml-auto h-3.5 w-3.5 text-accent" />}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function TopBar({ minimal }: { minimal?: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-surface/85 backdrop-blur supports-[backdrop-filter]:bg-surface/75">
      <div className="flex h-12 items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Wordmark />
        {!minimal && <span aria-hidden className="mx-0.5 hidden h-4 w-px rotate-12 bg-border sm:block" />}
        {!minimal && <div className="min-w-0 flex-1"><Breadcrumb /></div>}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!minimal && <ModeSwitch />}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
