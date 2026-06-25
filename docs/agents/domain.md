# Domain Docs

How the engineering skills should consume this repo's domain documentation.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`docs/adr/`** — read ADRs that touch the area you're about to work in
- **`docs/glossary.md`** — domain vocabulary

If any of these files don't exist, proceed silently.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
├── docs/
│   ├── adr/
│   ├── glossary.md
│   └── db-schema.md
└── src/
```

## Use the glossary's vocabulary

When naming a domain concept, use the term as defined in `docs/glossary.md`. Don't drift to synonyms.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.
