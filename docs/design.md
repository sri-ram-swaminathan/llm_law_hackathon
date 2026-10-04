# CCOmmit design tokens

Direction: **Linear/Stripe restraint, one accent.** Neutral surfaces, one indigo accent for interaction, and colour reserved for status meaning. If something is coloured, it tells the reader a gate or conclusion. Dense but calm; hairline borders instead of shadows; motion only where it explains a change (release switch, live activity, highlight to finding linking, drawers).

Tokens are CSS variables (Tailwind maps them in `tailwind.config` `theme.extend`). Light is the default; dark swaps the same roles.

## Palette

### Neutrals and accent

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FAFAFB` | `#0B0C0F` | page background |
| `--surface` | `#FFFFFF` | `#121318` | cards, panels |
| `--surface-2` | `#F4F5F7` | `#1A1C23` | table stripes, code blocks, hover |
| `--border` | `#E4E6EB` | `#262932` | hairlines (1px) |
| `--text` | `#14151A` | `#ECEDF1` | primary text |
| `--text-2` | `#5B5F6B` | `#A1A5B1` | secondary text, labels |
| `--text-3` | `#8A8E9A` | `#6F7380` | hints, timestamps |
| `--accent` | `#4F46E5` | `#818CF8` | links, focus ring, primary button, selected tab (the only brand colour) |
| `--accent-soft` | `#EEF0FF` | `#1E2140` | selected row, active chip background |

### Status colours (meaning only)

Each status has a foreground (`-fg`, text/icon), a soft background (`-bg`) and a border (`-bd`). Never use them decoratively.

| Status | Where | Light fg / bg | Dark fg / bg |
|---|---|---|---|
| `blocker` / `potential_violation` / NOT_READY | blockers, gate card, highlights | `#C2253A` / `#FDECEF` | `#F27085` / `#2A1318` |
| `high` | high-severity violation | `#C2570C` / `#FEF1E6` | `#F59A57` / `#2A1B0F` |
| `medium` | medium-severity violation | `#A16207` / `#FEF7DC` | `#E3B341` / `#262010` |
| `insufficient_evidence` | missing evidence | `#1D5FD1` / `#E9F1FD` | `#6EA8FE` / `#111E33` |
| `uncertain` / REVIEW_REQUIRED | needs counsel | `#7C4DCC` / `#F2ECFC` | `#B79CF2` / `#1D1530` |
| `satisfied` / READY | passes, Ready | `#117A4B` / `#E6F6EE` | `#4CC38A` / `#0E2219` |
| `not_applicable` | out of scope | `#6B7080` / `#EFF0F3` | `#9096A6` / `#1B1D24` |

Highlights in the evidence viewer use the finding's status `-bg` with a 2px `-fg` underline; the selected highlight gets the `--accent` focus ring.

Labels: "AI pre-assessment, not legal advice" is always visible on gate surfaces in `--text-2` on `--surface-2`. "Ready (AI)" uses the `satisfied` palette with a dashed border; counsel-reviewed READY uses a solid border.

## Type scale

Font: **Inter** (UI), **JetBrains Mono** (code, ids, quotes). Fallback: `system-ui, -apple-system, "Segoe UI", sans-serif` / `ui-monospace, "SF Mono", Menlo, monospace`. Tabular numerals for counts (`font-variant-numeric: tabular-nums`).

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `text-xs` | 12 / 16 | 500 | chips, timestamps, table headers (uppercase 0.04em) |
| `text-sm` | 13 / 20 | 400-500 | body in dense panes, tables, activity rows |
| `text-base` | 14 / 22 | 400-500 | default body |
| `text-lg` | 16 / 24 | 600 | card titles, finding titles |
| `text-xl` | 20 / 28 | 600 | page titles |
| `text-2xl` | 28 / 34 | 600 | gate headline (-0.01em) |
| `text-code` | 12.5 / 20 | 400 | code and quotes |

## Spacing, radii, elevation

- Spacing: 4px base. Steps `1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=48`. Page gutter 24px (16px under 640px). Pane gaps 0 with hairline dividers; card padding 16-20px.
- Radii: `--r-sm 4px` (chips, inputs), `--r-md 8px` (buttons, cards), `--r-lg 12px` (drawers, gate card). Pills use 9999px.
- Elevation: none in the layout. Overlays only (`drawer`, `popover`): `0 8px 24px rgba(16,18,27,.12)` light, `0 8px 24px rgba(0,0,0,.5)` dark, plus a 1px border.
- Focus: 2px `--accent` ring with 2px offset. Minimum hit target 32px.

## Motion

| Token | Value | Use |
|---|---|---|
| `--ease` | `cubic-bezier(.2,.7,.2,1)` | everything |
| `--dur-fast` | 120ms | hover, focus, chip toggles |
| `--dur-base` | 200ms | tab changes, row expand, highlight to finding scroll |
| `--dur-slow` | 320ms | drawers and slide-over panels, release switch crossfade |

- Release switch: gate card and counts crossfade (200ms) and counters tick to the new value; changed rows get a one-time 600ms `--accent-soft` flash.
- Live activity: new events slide in from 4px below with a 120ms fade; the running tool row shows a 1.2s opacity pulse; retries tint amber (`high` palette) and expand to show the validator errors.
- Respect `prefers-reduced-motion`: replace slides and pulses with instant changes.

## Layout rules

- Header 48px: release switcher, stage pill, **Run assessment** (the only filled accent button on a page), persona toggle.
- Finding workspace: three panes (document or code | finding | legal basis drawer), resizable, hairline dividers.
- Charts and coverage bars use the status palette only; no extra hues.
