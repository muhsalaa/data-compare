# ADR-001: Source Abstraction Layer

**Status:** Accepted  
**Date:** 2026-06-20  
**Context:** Grilling session for data-compare dashboard MVP

---

## Decision

Define an abstract `Source` interface now, even though MVP only supports HTTP GET polling.

```ts
interface Source {
  key: string;
  name: string;
  enabled: boolean;
  type: 'http-poll' | 'websocket' | 'csv-upload' | 'sse'; // extensible
  fetch(): Promise<Record<string, Scalar>>;
}
```

HTTP source is one implementation. Later source types (WebSocket, SSE, CSV upload) implement the same interface.

## Rationale

- "Data agnostic" is the product vision. Baking the abstraction now avoids lock-in.
- The interface is thin — just `fetch()` returning scalar key-values. Low cost to define upfront.
- Field mapping, derived metrics, and charts all consume `Record<string, Scalar>`. They don't care where data came from.
- Refactoring later (option B) risks coupling the entire pipeline to HTTP semantics.

## Alternatives Considered

- **B — YAGNI, refactor later**: Rejected. Core product promise is data agnosticism. Waiting means untangling HTTP assumptions from stores, charts, and formulas.
- **C — Union type + switch**: Rejected. Less clean than full interface, same upfront work.

## Consequences

- Source config storage must include a `type` discriminator field.
- Polling scheduler only applies to `http-poll` sources. Other types have different lifecycles.
- Test fetch UI must dispatch to the correct source impl.
