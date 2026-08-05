# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Contexto
**Generated:** 2026-08-05 10:52:32
**Updated:** 2026-08-05 (replaced with the style actually in the repo — see note below)
**Category:** Casual Puzzle Game

> The ui-ux-pro-max skill's original suggestion here was Claymorphism (soft,
> bubbly, 16–24px corners) with a green/amber palette and Google-hosted
> Baloo 2 / Comic Neue fonts. Neither was applied: the repo already has an
> explicit, deliberately chosen style ("Bolder & sharper" — sharp corners,
> deep shadows, electric violet), and a web-font import would break this
> page's core "works with no connection" requirement. This file documents
> the style actually shipping in `contexto.html`/`index.html` instead.

---

## Global Rules

### Color Palette (light theme)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Ground (page background) | `#F1F0F6` | `--ground` |
| Surface (cards, inputs) | `#FFFFFF` | `--surface` |
| Sunken | `#E7E5EF` | `--sunken` |
| Ink (body text) | `#191725` | `--ink` |
| Muted (secondary text) | `#6A6680` | `--muted` |
| Rule (borders/dividers) | `#DEDBE8` | `--rule` |
| Accent / Focus | `#4B1FCB` | `--accent`, `--focus` |
| Danger | `#C0392B` | `--danger` |

Accent is an electric violet (chosen specifically to read as a real color
choice, not a greyed-down tint — contrast against ground is 7.86:1).
`--accent-wash`, `--accent-edge`, `--ring`, `--glow` are all derived from
`--accent`/`--focus` via `color-mix()`, not separately hand-picked hexes.

### Color Palette (dark theme)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Ground | `#131220` | `--ground` |
| Surface | `#1C1A2B` | `--surface` |
| Sunken | `#262338` | `--sunken` |
| Ink | `#ECEAF4` | `--ink` |
| Muted | `#9793AC` | `--muted` |
| Rule | `#2E2B43` | `--rule` |
| Accent / Focus | `#B18AFF` | `--accent`, `--focus` |
| Danger | `#E8705C` | `--danger` |

Dark-theme shadows lean on a hairline top highlight rather than cast
shadow (shadows read as murk on dark backgrounds).

Applied automatically via `@media (prefers-color-scheme: dark)`, or
forced either way with `data-theme="light"` / `data-theme="dark"` on
`<html>` (the in-page toggle sets this).

### Typography

- **Font stack:** system fonts only — no web-font import, by design (see
  note above).
- **Serif** (headings, wordmark): `ui-serif, "Iowan Old Style", Charter, Georgia, Cambria, serif`
- **Sans** (body, UI chrome): `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
- **Mono** (numbers, codes, ranks): `ui-monospace, Menlo, "SF Mono", "Cascadia Mono", monospace`
- **Type scale:** `--step-0` 0.9375rem … `--step-4` fluid `clamp(2.125rem, 1.6rem + 2.6vw, 3rem)`, plus `--micro` 0.6875rem for eyebrow/label text.

### Radius

Sharp, near-square corners are deliberate — part of the "Bolder & sharper"
tone chosen for this page, not an unfinished rounding value.

| Token | Value |
|-------|-------|
| `--radius` | `1px` |
| `--radius-lg` | `2px` |

### Shadows

Deeper and darker than a typical paper-lift shadow on purpose — the page
is meant to feel like it has weight.

| Token | Light theme | Dark theme |
|-------|-------------|------------|
| `--lift-1` | `0 1px 2px rgba(17,15,28,.14)` | `0 1px 2px rgba(0,0,0,.3)` |
| `--lift-2` | `0 2px 3px rgba(17,15,28,.16), 0 8px 20px rgba(17,15,28,.18)` | `0 1px 2px rgba(0,0,0,.34), 0 4px 12px rgba(0,0,0,.3)` |
| `--lift-3` | `0 3px 6px rgba(17,15,28,.20), 0 20px 40px rgba(17,15,28,.26)` | `0 2px 4px rgba(0,0,0,.38), 0 12px 28px rgba(0,0,0,.36)` |

### Difficulty-driven accent (play screen only)

`data-play-level` on `<html>` (set when a round starts) escalates the
accent color with the chosen difficulty — cool/calm for easy, hot for
nightmare — scoped to `#play-live` so it never bleeds into the setup
picker's own level colors.

---

## Anti-Patterns (Do NOT Use in this repo)

- ❌ Any web font / external font import — breaks offline play
- ❌ Rounded corners beyond `--radius-lg` (2px) — fights the deliberate sharp tone
- ❌ Resizing `.roster-item button` to a generic touch-target minimum — its
  compact size is intentional (see comment above that rule in the CSS);
  it's also an admin-only control, not a control aimed at the game's
  younger players
- ❌ Muted/washed-out color choices — the accent violet was specifically
  saturated up from an earlier muted version for this reason
- ❌ Invisible focus states — already handled correctly (`:focus-visible`
  gets a replacement ring/outline everywhere `outline: none` is set, never
  just removed)

## Style-Agnostic Checks From the Skill's Audit

Applied where they didn't conflict with anything above:

- [x] Light mode: text contrast 4.5:1 minimum — `--ink` on `--ground`/`--surface` and `--muted` on `--surface` both clear this
- [x] `prefers-reduced-motion` respected — seven separate `@media` blocks handle it, both gating (`no-preference`) and fallback (`reduce`)
- [x] No horizontal scroll on mobile — confirmed via `css_audit.js`
- [x] Primary interactive elements (guess input, Guess/Hint buttons, difficulty/player pickers) keep ≥44px touch targets — `min-height: 3rem` on `.field input`/primary buttons
- [x] Every `<input>` has an accessible name — either a `<label for>` or, for the 20 compact/chat/dynamic-row inputs that only had a placeholder before, an `aria-label`. Zero visual change; screen readers previously had nothing to announce for these.
- [x] Status/error messages are announced to assistive tech — all 12 `*-notice` elements (account, code, play, live, solve, compare, shop, gift, global chat, feature request, spectate, admin) now carry `aria-live="polite"`, so things like "That code doesn't work" or "Copied!" get spoken, not just shown visually.
