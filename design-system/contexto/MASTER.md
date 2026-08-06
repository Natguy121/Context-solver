# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Contexto
**Generated:** 2026-08-05 10:52:32
**Updated:** 2026-08-06 (full Claymorphism component pass — see note below)
**Category:** Casual Puzzle Game

> History: the page originally shipped a deliberate "Bolder & sharper"
> style (sharp corners, deep shadows, electric violet). Feedback that
> this read as too harsh led to a warmer pass (rounder corners, lighter
> shadows, a burnt-orange accent) — a partial move toward the skill's
> Claymorphism suggestion. A later request to go "completely new...
> using the skill" finished the job: thick 3px borders in a darker shade
> of each element's own fill, inset+outset "puffy" double shadows on
> buttons, a matching inset "pressed-in" look on inputs, a bouncy
> overshoot easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`) on press/hover,
> and a warm cream surface colour instead of pure white — all straight
> from the skill's own Claymorphism CSS variable recommendations
> (`border-radius: 16-24px`, `border: 3-4px solid`, double shadows,
> soft-bounce easing). Still not applied: the skill's Google-hosted
> Baloo 2 / Comic Neue font pairing, and its literal pastel palette —
> a web-font import would break this page's "works with no connection"
> requirement, and the accent stays fully saturated (not pastel) since
> it doubles as text colour in several places and pastels don't clear
> 4.5:1 contrast there. This file documents the style actually shipping
> in `contexto.html`/`index.html`.

---

## Global Rules

### Color Palette (light theme)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Ground (page background) | `#F1F0F6` | `--ground` |
| Surface (cards, inputs) | `#FFFBF7` (warm cream, not pure white) | `--surface` |
| Sunken | `#E7E5EF` | `--sunken` |
| Ink (body text) | `#191725` | `--ink` |
| Muted (secondary text) | `#6A6680` | `--muted` |
| Rule (borders/dividers) | `#DEDBE8` | `--rule` |
| Accent / Focus | `#A8360C` | `--accent`, `--focus` |
| Danger | `#C0392B` | `--danger` |

Accent is a warm burnt orange (contrast against ground: 5.80:1 — clears
WCAG AA; it's used as text color in several places, e.g. links, so this
matters, not just as a button background). `--accent-wash`, `--accent-edge`,
`--ring`, `--glow` are all derived from `--accent`/`--focus` via
`color-mix()`, not separately hand-picked hexes, so they follow
automatically.

### Color Palette (dark theme)

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Ground | `#131220` | `--ground` |
| Surface | `#1C1A2B` | `--surface` |
| Sunken | `#262338` | `--sunken` |
| Ink | `#ECEAF4` | `--ink` |
| Muted | `#9793AC` | `--muted` |
| Rule | `#2E2B43` | `--rule` |
| Accent / Focus | `#FFA268` | `--accent`, `--focus` |
| Danger | `#E8705C` | `--danger` |

Dark-theme accent is a warm peachy orange, matching the light theme's hue
(contrast against dark ground: 9.36:1).

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

Rounded and friendly on purpose — walked back from an earlier sharp,
near-square style that read as too harsh. Sits inside the skill's own
recommended 16-24px range for Claymorphism.

| Token | Value |
|-------|-------|
| `--radius` | `18px` |
| `--radius-lg` | `24px` |

### Borders, clay shadows, and press feel

| Token | Value |
|-------|-------|
| `--border-width` | `3px` |
| `--accent-deep` | `color-mix(in srgb, var(--accent) 78%, black)` — a filled button's border is this, not the fill color itself, so the edge reads as a distinct "rim" of the clay shape |
| `--bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` — a springy overshoot, used for hover/press transitions instead of `--ease` |

- **Buttons** (raised clay): `inset 0 1px 0 rgba(255,255,255,.3)` (top highlight) + `inset 0 -2px 3px rgba(0,0,0,.12)` (bottom shade) + `var(--lift-1)` at rest; deepens on hover (`translateY(-2px)`), inverts to a single inward shadow + `translateY(1px) scale(0.98)` on `:active` — a soft press-and-settle, not a flat snap.
- **Inputs** (pressed into clay): `inset 0 2px 4px rgba(17,15,28,.06)` at rest, same inset plus the existing focus ring on `:focus-visible`.
- **Flat controls stay flat**: `.tab`, `.admin-btn`, `.purse`, `.linkish` deliberately get none of this — they're meant to read as minimal/text-like, not as clay buttons, and `css_audit.js` asserts their box-shadow stays `none`. Don't "fix" that.

### Shadows

Light and diffuse — floats rather than presses down. Walked back from an
earlier, deliberately heavy-weight shadow style for the same reason as
the radius change.

| Token | Light theme | Dark theme |
|-------|-------------|------------|
| `--lift-1` | `0 1px 3px rgba(17,15,28,.08)` | `0 1px 2px rgba(0,0,0,.3)` |
| `--lift-2` | `0 2px 4px rgba(17,15,28,.06), 0 4px 10px rgba(17,15,28,.10)` | `0 1px 2px rgba(0,0,0,.34), 0 4px 12px rgba(0,0,0,.3)` |
| `--lift-3` | `0 4px 8px rgba(17,15,28,.08), 0 10px 24px rgba(17,15,28,.14)` | `0 2px 4px rgba(0,0,0,.38), 0 12px 28px rgba(0,0,0,.36)` |

Dark-theme shadows were left as-is — already restrained (a hairline top
highlight does most of the depth work there, since cast shadow reads as
murk on dark ground), so they weren't part of the "too heavy" problem.

### Difficulty-driven accent (play screen only)

`data-play-level` on `<html>` (set when a round starts) escalates the
accent color with the chosen difficulty — cool/calm for easy, hot for
nightmare — scoped to `#play-live` so it never bleeds into the setup
picker's own level colors.

| Level | Color | Hue |
|-------|-------|-----|
| Easy | `#2E63C7` (blue) | 219° |
| Normal | mirrors `--accent` (burnt orange) | 16° |
| Hard | `#A67C0A` (golden amber) | 44° |
| Nightmare | `#C81E3A` (red) | 350° |

Hard was changed from its old value (`#B5670E`, hue 32°) because normal
now mirrors the new burnt-orange accent (hue 16°) — the two were only 16°
apart and read as nearly the same color. Golden amber keeps all four
levels visually distinct at a glance.

---

## Anti-Patterns (Do NOT Use in this repo)

- ❌ Any web font / external font import — breaks offline play
- ❌ Sharp/near-square corners, or shadows heavier than the values above —
  that was the previous style, deliberately walked back for reading too
  harsh
- ❌ Resizing `.roster-item button` to a generic touch-target minimum — its
  compact size is intentional (see comment above that rule in the CSS);
  it's also an admin-only control, not a control aimed at the game's
  younger players
- ❌ Muted/washed-out color choices — the accent orange is fully saturated
  on purpose, same reasoning that applied to the violet it replaced
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
