# Product

## Register

product

## Users

**Primary:** Developers and technical operators comparing data across HTTP APIs. They're comfortable with JSON paths, expression syntax, and data structures. They use this as a lightweight observability tool for quick cross-source comparisons — not a full Datadog replacement.

**Context:** Sitting at a desk, often with other dev tools open (terminal, editor, browser). They're impatient with setup friction. They want to configure a comparison in seconds, not minutes. They read charts for trends, not pixels.

**Job to be done:** "I have two (or more) API endpoints returning numbers I care about. Show me how they relate over time, alert me when something's off, and let me export/share this configuration."

## Product Purpose

A browser-first, data-agnostic dashboard for comparing multiple live API data sources over time. Positioned as the simplest way to monitor and compare any HTTP data — no backend, no cloud, no signup. Open source, self-contained, zero-config.

Success looks like: a user can go from landing page to seeing live chart data in under 60 seconds.

## Brand Personality

**Analytical · Precise · Calm**

- Confident but not aggressive. Data speaks; the UI doesn't compete.
- Minimal chrome, maximum signal-to-noise.
- Preference for space over clutter, precision over decoration.
- Tone in copy: direct, technical, helpful without hand-holding. No marketing fluff.
- Feels like a well-crafted developer tool — not a SaaS product, not a toy.

## Anti-references

- **Not Grafana:** Grafana is everything for everyone. This is deliberately narrower, simpler, more opinionated. No infinite customization, no PromQL, no dashboards-as-code complexity. Less surface area, better in its lane.
- **Not another shadcn-default SaaS:** No cookie-cutter white/gray card grids. The default shadcn palette is a starting point, not the finish line.
- **Not over-engineered:** No enterprise-cruft sidebars with 14 nav items. The core loop is: pick sources → map fields → see charts. Everything else is secondary.

## Design Principles

1. **Show data, not chrome.** The interface gets out of the way. Borders, shadows, gradients, and decorative flourishes are noise. Data density is a feature.
2. **Progressive disclosure.** The default view shows the essentials. Advanced features (derived metrics, warning rules, custom charts) are one click deeper, not always visible.
3. **Fast setup, minimal friction.** Every form, every flow should answer "what's the fewest number of fields to make this work?" Defaults should be smart.
4. **State is visible.** Polling status, connectivity, data freshness, errors — all surfaced at the point of relevance, not buried in a status bar or toast queue.
5. **Open source by default.** The UI shouldn't assume hosted infrastructure. No "cloud sync," no "upgrade to pro" framing in empty states or feature labels. It's a local tool that respects the user's data.

## Accessibility & Inclusion

- WCAG 2.2 AA minimum. Color is never the sole differentiator.
- Dark and light themes both first-class, not afterthoughts.
- Keyboard-navigable: all forms, charts, and interactive elements.
- Charts must work for deuteranopia/protanopia (avoid pure red/green differentiation).
- Reduced motion respected: no decorative transitions, utility motion only.
