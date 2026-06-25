# Glossary — Data Compare Dashboard

## Domain Terms

| Term | Definition |
|------|-----------|
| **Session** | A self-contained monitoring configuration. Has data sources, field mappings, derived metrics, charts, and warning rules. Statuses: `active`, `paused`, `stopped`. |
| **Data Source** | An external system that provides data. MVP: HTTP GET only. Abstract `Source` interface for future types. |
| **Source Key** | Unique identifier per session for a data source. Lowercase, letters/numbers/underscore, no leading number. Example: `ads`, `crowdfunding`. |
| **Field Mapping** | Maps a scalar JSON value from a source response to a named field. Uses dot-path syntax: `campaign.stats.spend`. |
| **Derived Metric** | User-defined formula combining mapped fields. MVP: NO cross-references — only references mapped fields directly. Operators: `+ - * / ()`. |
| **Warning Rule** | Expression evaluated after each poll cycle. Outputs events on state transitions. Severities: `info`, `warning`, `critical`. |
| **Poll Cycle** | One round of fetching all enabled sources in a session. All sources fetched in parallel (all-settled). Single shared timestamp for chart alignment. |
| **Scalar** | `string | number | boolean | null`. The only values accepted from field mappings. |

## Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | IndexedDB + Dexie | Simplest browser-native storage for MVP. No backend. |
| D2 | No auto-cleanup | User deletes sessions/history manually. Avoids surprising data loss. |
| D3 | Dot-path jsonPath | `campaign.stats.spend` — intuitive, no JSONPath spec to learn. |
| D4 | Missing field = null | When jsonPath parent is null, only that field becomes null. Other fields unaffected. Chart shows gap. |
| D5 | Type mismatch = error | If jsonPath resolves to non-scalar (object/array), raise error on mapping. |
| D6 | Derived metrics: no cross-refs | MVP simplicity. No dependency graph needed. Revisit v2. |
| D7 | Warning initial state: unknown | No false alarm on first poll. State set silently on first eval. |
| D8 | Fixed schedule + timeout | Poll cycles fire on schedule. Slow sources get timeout (configurable, default 15s, capped at 80% of interval). Timeout = source failed for that cycle. |
| D9 | Per-session chained timeout | Each session manages its own polling with chained `setTimeout`, avoiding overlapping cycles while keeping cadence simple for 3-5 sessions. |
| D10 | Tab wake: latest + gap | Fetch latest on visibility change. Visual gap band on chart for missing period. |
| D11 | Import: fresh copy | Import creates new session from config. No history. Malformed JSON rejected. v2 details TBD. |
| D12 | Source interface now | `fetch(): Record<string, Scalar>` interface defined upfront. HTTP is first impl. |
| D13 | Charts: window + paginate | Last N points shown. Zoom/pan for history. Recharts brush. |
| D14 | TSQ = polling layer | TanStack Query drives refetchInterval. IndexedDB for persistence. |
| D15 | Pause/stop keeps history | Pause = temp, stop = archive. Delete = nuclear (config + history wiped). |
| D16 | Field mapper: auto-discover | Test fetch → extract all scalar paths → user picks with checkboxes. |
| D17 | Dashboard: single scroll | Stat cards → charts → warnings → history. One page, no tabs. |
| D18 | Errors: inline badge | Badge on affected card/chart. Tooltip shows last error. Non-intrusive. |
| D19 | Chart builder form | User creates named charts, picks series from multi-select. Multiple charts per session. |
| D20 | math.js for expressions | Safe eval with restricted scope. Used for both derived metrics and warning rules. |
| D21 | Separate key namespaces | Source refs have dots (`ads.spend`), derived metrics don't (`roas`). No collision. |
| D22 | Offline: stale + banner | Last known values from IndexedDB. Yellow banner. History browsable. |
| D23 | Test fetch errors: inline | Red error text below URL field. No modal. No JSON preview until success. |
| D24 | DB schema: normalized-light | 10 tables. sessions, sources, field_mappings, derived_metrics, charts, warning_rules, poll_cycles, source_results, mapped_values, derived_values, warning_events. |
| D25 | TSQ: one query per source | Key: `['source', sessionId, sourceKey]`. Each source = independent query with own refetchInterval. |
| D26 | Chart data: pivot at query time | Query poll_cycles → join mapped_values + derived_values → pivot in JS → memoize with useMemo. |
| D27 | Edit config: sources locked | Editing sources/mappings/charts requires pausing session. Session details (name, interval, timeout) editable any time. |
| D28 | Empty states: CTA + illustration | (a) Hero + Create button. (b) Source setup wizard prompt. (c) Skeleton cards with spinner. |
| D29 | Stat cards: latest + delta | Big number = latest value. Arrow = change vs previous cycle. |
| D30 | URLs: static only MVP | No template variables. Query params as static key-value config. |
| D31 | Timestamps: UTC ISO, display local | Store as ISO 8601 UTC string. Display via Intl.DateTimeFormat in local timezone. |
| D32 | Export: maintain IDs, regenerate on import | JSON includes internal IDs for reference. Import regenerates IDs to avoid collisions. |
| D33 | Formula null: save as null | Division by zero or null operand → null. Chart gaps. Warning rules treat null as false. |
| D34 | Interval change keeps history | Changing interval mid-session restarts the polling timer. All past poll cycles preserved. Chart naturally shows the gap between old and new intervals via real timestamps. No data deleted. |
