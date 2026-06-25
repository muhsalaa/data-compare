---
name: Data Compare
description: A browser-first, data-agnostic dashboard for comparing multiple live API data sources over time.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.205 0 0)"
  primary-foreground: "oklch(0.985 0 0)"
  secondary: "oklch(0.97 0 0)"
  secondary-foreground: "oklch(0.205 0 0)"
  muted: "oklch(0.97 0 0)"
  muted-foreground: "oklch(0.556 0 0)"
  accent: "oklch(0.97 0 0)"
  accent-foreground: "oklch(0.205 0 0)"
  destructive: "oklch(0.577 0.245 27.325)"
  border: "oklch(0.922 0 0)"
  input: "oklch(0.922 0 0)"
  ring: "oklch(0.708 0 0)"
  chart-1: "oklch(0.87 0 0)"
  chart-2: "oklch(0.556 0 0)"
  chart-3: "oklch(0.439 0 0)"
  chart-4: "oklch(0.371 0 0)"
  chart-5: "oklch(0.269 0 0)"
  sidebar: "oklch(0.985 0 0)"
  sidebar-foreground: "oklch(0.145 0 0)"
  sidebar-primary: "oklch(0.205 0 0)"
  sidebar-primary-foreground: "oklch(0.985 0 0)"
  sidebar-accent: "oklch(0.97 0 0)"
  sidebar-accent-foreground: "oklch(0.205 0 0)"
  sidebar-border: "oklch(0.922 0 0)"
  sidebar-ring: "oklch(0.708 0 0)"
typography:
  body:
    fontFamily: "'Geist Variable', system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Geist Variable', system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "normal"
  title:
    fontFamily: "'Geist Variable', system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
  headline:
    fontFamily: "'Geist Variable', system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
  display:
    fontFamily: "'Geist Variable', system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.1
  mono:
    fontFamily: "ui-monospace, Consolas, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    fontFeature: "'tnum' on, 'zero' on"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.625rem"
  xl: "1.4rem"
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2rem"
  button-destructive:
    backgroundColor: "transparent"
    textColor: "{colors.destructive}"
    rounded: "{rounded.md}"
    padding: "0 0.625rem"
    height: "2rem"
  card-default:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "{spacing.md}"
  card-sm:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.xl}"
    padding: "{spacing.sm}"
  input-default:
    backgroundColor: "transparent"
    rounded: "{rounded.md}"
    height: "2rem"
    padding: "0 0.625rem"
  badge-default:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "9999px"
    height: "1.25rem"
    padding: "0 0.5rem"
---

# Design System: Data Compare

## 1. Overview

**Creative North Star: "The Lab Bench"**

Data Compare is the workbench for measurement. Every element is an instrument — purposeful, calibrated, and placed exactly where it's needed. The interface doesn't decorate; it reveals.

The personality is **analytical, precise, calm**. High signal-to-noise. Minimal chrome, maximum data density. The UI exists to get out of the way — borders and spacing define structure, not shadows or gradients. Color is reserved almost exclusively for data itself (chart lines, status indicators). UI chrome at rest is invisible; interactive elements announce themselves through subtle state changes (opacity shifts, focus rings).

This system explicitly rejects Grafana's everything-configurable density and SaaS-cream generic shadcn defaults. It is deliberately narrower, more opinionated, and calmer.

**Key Characteristics:**
- Grayscale-chrome: data carries all the color; UI is neutral
- Flat surfaces separated by thin rings and borders, not shadows
- Tight, consistent 2rem (h-8) component sizing — compact but not cramped
- Single type family (Geist Variable) — hierarchy via weight and scale, not font switches
- State changes are subtle opacity/background shifts, not animations
- Full dark/light theme parity — both first-class

## 2. Colors

The palette is gray-chrome with zero chroma at key points. Data carries all the color meaning; the UI is neutral infrastructure.

The only exception is `destructive`, which carries a restrained red (oklch 0.577 0.245 27.325) for errors and deletion — functional color, not decorative.

### Neutral

- **Background** (oklch 1 0 0 / dark: oklch 0.145 0 0): Page canvas. The lightest or darkest surface.
- **Foreground** (oklch 0.145 0 0 / dark: oklch 0.985 0 0): Primary text. Maximum contrast.
- **Card** (oklch 1 0 0 / dark: oklch 0.205 0 0): Container surfaces. Same as background in light mode; lifted slightly in dark.
- **Muted** (oklch 0.97 0 0 / dark: oklch 0.269 0 0): Subtle background fills — secondary surfaces, table stripes, disabled states.
- **Muted Foreground** (oklch 0.556 0 0 / dark: oklch 0.708 0 0): Secondary text, metadata, placeholders.
- **Border** (oklch 0.922 0 0 / dark: oklch 1 0 0 / 10%): Structural dividers — card rings, table borders, separator lines.
- **Input** (oklch 0.922 0 0 / dark: oklch 1 0 0 / 15%): Input field borders at rest.
- **Ring** (oklch 0.708 0 0 / dark: oklch 0.556 0 0): Focus ring color.

### Semantic

- **Primary** (oklch 0.205 0 0 / dark: oklch 0.922 0 0): Filled button backgrounds, active badges. Dark in light mode (near-black), light in dark mode (near-white). Inverted always.
- **Destructive** (oklch 0.577 0.245 27.325): Errors, delete actions, failed fetch indicators. The one splash of hue in the system.

### Chart

- Five-step neutral scale (oklch 0.87 → 0.269, 0 chroma): The chart palette is tonal gray. If the user's data sources need differentiation, color can be introduced in chart lines, but the default palette stays neutral so the data's own shape does the talking.

### Named Rules

**The Zero-Chrome Rule.** UI chrome has zero chroma. No tinted borders, no colored backgrounds on cards. Color is reserved for data visualization, status indicators, and destructive actions. If it's not data or status, it's gray.

**The One-Splash Rule.** Destructive red is the only intentional hue in the UI chrome. Everything else is achromatic. The rarity of red makes errors instantly recognizable.

## 3. Typography

**Body Font:** Geist Variable (with system-ui / -apple-system / Segoe UI / Roboto / sans-serif fallbacks)
**Mono Font:** ui-monospace (with Consolas, monospace fallbacks)

Single-family system. No display font, no serif. Hierarchy is achieved through weight and scale contrast alone — a deliberate constraint that keeps the interface calm and uniform.

Geist Variable's optical sizing means text stays crisp at every scale. Its generous x-height and moderate contrast make it readable at small sizes (0.75rem labels, 0.875rem body).

### Hierarchy

- **Display** (600 weight, 2.25rem / 36px, 1.1 line-height): Page headings only (home hero "No sessions yet"). Not used inside dashboards.
- **Headline** (600 weight, 1.5rem / 24px, 1.2 line-height): Section titles, empty-state CTAs.
- **Title** (500 weight, 1rem / 16px, 1.375 line-height): Card titles, dialog headers, sidebar labels.
- **Body** (400 weight, 0.875rem / 14px, 1.5 line-height): Default text. Forms, table cells, descriptions. Max line length 65–75ch.
- **Label** (500 weight, 0.75rem / 12px, 1 line-height): Form labels, metadata, stat card headers, badge text. Small but bold.
- **Mono** (400 weight, 0.75rem / 12px): Code, JSON previews, data source keys, expression formulas, timestamps. Tabular figures (`tnum`, `zero`) for alignment in tables.

### Named Rules

**The Single-Family Rule.** Never introduce a second font family. If a heading needs more presence, increase the weight or scale — do not change the typeface.

## 4. Elevation

The system is flat by default. Depth is communicated through thin ring borders and background color shifts, not shadows.

- **Cards** use `ring-1 ring-foreground/10` — a hairline border that adapts to both themes. No shadow.
- **Focus states** use `ring-3 ring-ring/50` — a visible but restrained ring. The ring color matches the theme's ring token, not a bright accent.
- **Dialogs** use the same ring pattern as cards, with a `bg-black/10` backdrop and optional `backdrop-blur-xs`. Still no shadow.
- **Input focus** mirrors button focus: border shifts to `ring` color + a 3px ring at 50% opacity.

There is no shadow vocabulary. Surfaces do not float. This is a deliberate constraint: flat interfaces read as honest, modern, and tool-like. A shadow would imply elevation hierarchy where none exists.

### Named Rules

**The Flat-By-Default Rule.** All resting surfaces are flat. Focus rings appear on interaction. Hover is communicated through background opacity changes, never lifts or shadow reveals.

## 5. Components

Every component is compact (default height 2rem), uses the base radius (0.5rem), and communicates state through opacity/background shifts only.

### Buttons

- **Shape:** Gently rounded corners (0.5rem / rounded-md).
- **Primary (`default`):** Filled background (`--primary`), inverted text. Hover reduces opacity to 80%. Active state shifts down 1px (`translate-y-px`).
- **Outline:** Transparent background, `--border` stroke on button itself. Hover adds `--muted` background. Used for secondary actions, toolbar buttons.
- **Secondary:** `--secondary` background (muted gray). Hover lightens slightly via `color-mix`. Use case: paired actions.
- **Ghost:** Transparent at rest. Hover shows `--muted` background. For icon buttons, inline actions, less prominent controls.
- **Destructive:** Transparent, red text. Hover fills with `--destructive/10` → `--destructive/20`. For delete, remove, clear actions.
- **Sizes:** `default` (h-8), `sm` (h-7), `lg` (h-9), `xs` (h-6), plus icon variants (`icon` 8, `icon-sm` 7, `icon-xs` 6, `icon-lg` 9).
- **Focus:** `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` — shared pattern across all interactive elements.
- **Disabled:** `opacity-50 pointer-events-none`.

### Cards

- **Corner Style:** Rounded-xl (1.4rem / generous radius).
- **Background:** `--card` (matches `--background` in light, slightly lifted in dark).
- **Border:** `ring-1 ring-foreground/10` — thin structural ring.
- **Padding:** Default 1rem (--card-spacing). Sm variant 0.75rem.
- **Content gap:** Matches padding via CSS variable `[--card-spacing:--spacing(4)]`.
- **Footer:** Separated via `border-t bg-muted/50` — tonal distinction, not a shadow.

### Inputs

- **Style:** Border stroke (`--input`/`--border`), transparent fill. Same height as buttons (h-8, 2rem).
- **Focus:** Border shifts to `--ring` color + 3px focus ring at 50% opacity. Matches button focus exactly.
- **Disabled:** Background fills with `--input/50`, opacity reduced. No border change.
- **Placeholder:** `--muted-foreground`.
- **File input:** Inline file trigger, styled as compact inline button.

### Badges

- **Shape:** Fully rounded (rounded-4xl / 9999px), pill form.
- **Height:** 1.25rem (h-5) — smaller than buttons. Reads as a tag, not an action.
- **Variants:** Default (primary fill), secondary (muted fill), destructive (red tint), outline (border only). Ghost and link available for edge cases.
- **Use:** Status indicators, severity labels, data source states, filter chips.

### Dialog

- **Surface:** Rounded-xl, `--popover` background, `ring-1 ring-foreground/10`. Same card pattern.
- **Overlay:** `bg-black/10` with `backdrop-blur-xs` — subtle backdrop, not obtrusive.
- **Position:** Centered fixed, opens with fade + zoom-95 animation.
- **Footer:** Optional tonal footer (`border-t bg-muted/50`) for action buttons.
- **Close:** Ghost icon button in top-right corner.

### Navigation

- **Header:** Horizontal bar with `border-b` separation. Logo/name on the left, nav links on right.
- **Links:** Text-only (no badge/button wrapper). Default `--muted-foreground`, hover `--foreground`.
- **Main content:** Centered `max-w-5xl` with `px-6 py-8` padding. Single scroll page, no tabs on dashboard.

### Separator

- **Style:** `h-px bg-border` (horizontal) or `w-px bg-border` (vertical). 1px structural divider.
- **Behavior:** Shrinks to fit content. No margins, spacing handled by parent.

### Named Rules

**The Consistent-Height Rule.** All form controls (buttons, inputs, selects) share the same default height (2rem / h-8). The horizontal rhythm is uniform; only width and label position differentiate them.

## 6. Do's and Don'ts

### Do:

- **Do** let data carry all the color. Chart lines, stat deltas, and status indicators are where color lives. UI chrome is grayscale.
- **Do** use the ring-border pattern (`ring-1 ring-foreground/10`) for card and surface separation. It's the project's structural signature.
- **Do** use the consistent 2rem component height for all form controls. Aligns inputs, buttons, and selects on the same baseline.
- **Do** keep action buttons compact — `px-2.5`, `h-8` is the default. Big padded buttons are not this system's language.
- **Do** use the destructive variant (red tint, no fill) for delete/remove actions. Red is the one intentional UI hue — its rarity gives it weight.
- **Do** use the Lab Bench mentality: every element must justify its existence. If a border, label, or card isn't doing structural work, remove it.

### Don't:

- **Don't** use shadows for card or surface elevation. Cards use rings, not drop shadows. Flat is the default, not an option.
- **Don't** introduce a second font family. Geist Variable covers every role from display to label. No serif, no monospace for UI (mono is data-only in code blocks and expressions).
- **Don't** add color to UI chrome — no tinted borders, no colored card headers, no accent underlines. Product.md says *"minimal chrome, maximum signal-to-noise"* — colored chrome is noise.
- **Don't** use gradient text (`background-clip: text` with gradients). Emphasis comes from weight or size, not decoration.
- **Don't** use border-left or border-right accents greater than 1px. No side stripes on cards or list items.
- **Don't** use glassmorphism (backdrop blur backgrounds) as a default. The dialog overlay's subtle blur is the only exception.
- **Don't** replicate Grafana's infinite-configuration density. This is narrower and more opinionated. Limited chart count, no PromQL, no dashboard-as-code.
- **Don't** use hero-metric templates (big number + small label + gradient accent). Stat cards show a value, delta, and label — flat, no decoration.
- **Don't** animate CSS layout properties. State changes use opacity/background transitions; no width, height, or position animations.
