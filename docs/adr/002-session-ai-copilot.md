# ADR-002: Session-scoped AI copilot with BYOK OpenAI-compatible runtime

**Status:** Accepted  
**Date:** 2026-06-25  
**Deciders:** project maintainer

---

## Context

Data Compare is a browser-first monitoring tool. Users can already define a Session, poll HTTP sources, map fields, derive metrics, persist history in IndexedDB, and review charts plus warning events.

The next product step is an AI copilot that helps the operator interpret the data. The copilot needs business context, not just numbers, so each Session also needs a human-written description explaining what the Session tracks and what “good” means.

This feature must preserve the current product constraints:

- browser-first, no required hosted backend
- open source and reusable by others
- local-first storage in IndexedDB
- flexible enough for different AI providers and self-hosted setups

Key tensions:

1. Many providers do not support safe direct browser access or have CORS limitations.
2. A provider-specific integration matrix would create too much surface area for v1.
3. Sending an entire Session history and every raw response on every chat turn would be expensive and noisy.
4. The first version should inform the operator, not autonomously mutate Session configuration.

## Decision

Build a **read-only, per-session AI copilot** with these rules:

1. **Each Session gains a `description` field** used as the first business-context input for the copilot.
2. **The first AI scope is exactly one Session.** No cross-session reasoning by default.
3. **AI connectivity uses a BYOK OpenAI-compatible runtime** with configurable:
   - `baseUrl`
   - `apiKey`
   - `model`
   - `transport` (`direct` or `relay`)
4. **Direct browser requests remain allowed** for compatible endpoints.
5. **An optional user-owned relay is supported** for providers that block browser CORS or for operators who prefer not to connect directly from the browser.
6. **Chat remains read-only in v1.** The copilot can explain, summarize, compare, and suggest; it does not auto-edit warning rules, metrics, charts, or source configuration.
7. **Model context is built from compact context packets**, not from a full IndexedDB dump on every turn.
8. **Chat history is stored locally per Session** in IndexedDB.

## What the copilot can read

The copilot may use data from the current Session only:

- Session name and description
- source definitions and latest statuses
- field mappings and mapping descriptions
- derived metrics
- warning rules and warning events
- recent poll history and recent deltas
- saved source fetch results and raw response excerpts
- stat summaries computed from persisted history

## Context strategy

Each request should start from a compact structured packet:

1. **Session brief**
   - name
   - description
   - poll interval
   - source list
   - field mappings
   - derived metrics
   - warning rules
2. **Current snapshot**
   - latest values
   - latest source successes/failures
   - active warnings
   - recent fetch errors
3. **Recent history summary**
   - bounded time window or bounded cycle count
   - trend, min/max, delta, anomaly hints
4. **Optional deep evidence**
   - specific raw JSON excerpts
   - longer metric windows
   - warning/event timelines

The app should only include deep evidence when the user asks for it or when a retrieval layer selects it.

## Storage shape

Minimum new local data concepts:

### Session

Add:

```ts
interface Session {
  description?: string
}
```

### AI Profile

Global local settings, reusable across Sessions:

```ts
interface AIProfile {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  model: string
  transport: 'direct' | 'relay'
  enabled: boolean
  createdAt: string
  updatedAt: string
}
```

### Session Chat Message

```ts
interface SessionChatMessage {
  id: string
  sessionId: string
  role: 'system' | 'user' | 'assistant'
  content: string
  createdAt: string
  meta?: {
    preset?: string
    model?: string
    profileId?: string
    contextWindow?: string
  }
}
```

## Rationale

### Why OpenAI-compatible first

It is the smallest useful integration surface.

One protocol shape can support:

- OpenRouter
- local OpenAI-compatible servers
- Ollama-compatible gateways when exposed in that shape
- many hosted third-party endpoints
- any future self-hosted relay that speaks the same wire format

This avoids shipping separate v1 adapters for OpenAI, Anthropic, Gemini, and others.

### Why BYOK

The app is open source and browser-first. Operators need to choose their own provider, cost model, and privacy posture. BYOK keeps the project infrastructure-free.

### Why optional relay instead of required relay

A required relay would break the current browser-first simplicity and create setup friction for every user. An optional relay keeps the lowest-friction path while leaving room for stricter setups.

### Why per-session scope first

The user mental model is already Session-centric. Restricting the copilot to one Session keeps prompts smaller, boundaries clearer, and answers more grounded.

### Why read-only first

The first AI job is interpretation, not mutation. Read-only scope reduces trust and safety risk while still delivering value.

## Alternatives considered

### A. Named provider adapters first

Rejected for v1.

Reason: too much UI, validation, and protocol complexity for limited product gain.

### B. Required server/relay for every AI request

Rejected for v1.

Reason: conflicts with browser-first product positioning and adds deployment burden.

### C. Full-database prompt dump

Rejected.

Reason: high token cost, noisy context, worse answers, and poor scaling as history grows.

### D. Cross-session AI by default

Rejected for v1.

Reason: ambiguous scope and much larger prompt cost. Can be added later as an explicit opt-in.

### E. Agent writes config automatically in v1

Rejected.

Reason: too much product and safety surface. Suggestions can come first; mutations can come later behind review.

## Consequences

### Positive

- keeps the app browser-first
- gives users provider freedom
- supports both cloud and local/self-hosted setups
- fits the current Session-centric domain model
- keeps v1 implementation surface small

### Negative

- direct browser mode means API keys live locally in the browser
- some providers will still need a relay because of CORS or browser restrictions
- OpenAI-compatible shape may not expose every advanced provider-specific feature
- context building must be explicit and bounded to avoid prompt bloat

## Security and UX notes

- AI profile secrets are local-only and should be labeled sensitive.
- The UI must warn that direct mode stores keys in the browser profile.
- The app must not silently send all raw history; context inclusion should be bounded and inspectable.
- Relay support is user-owned. This project does not require a maintainer-hosted backend.

## Non-goals

Not part of this ADR:

- cross-session chat
- automatic warning-rule creation without review
- automatic metric or chart edits
- background AI jobs
- provider-specific tool use
- vector search or embeddings
- hosted multi-user sync

## Follow-up plans

Implementation is split into docs/plans:

- `docs/plans/011-add-session-description-and-ai-schema.md`
- `docs/plans/012-build-openai-compatible-ai-runtime.md`
- `docs/plans/013-build-session-chat-ui-and-presets.md`
- `docs/plans/014-add-context-retrieval-and-safety-rails.md`
