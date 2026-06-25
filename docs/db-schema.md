# IndexedDB Schema

## Tables

### sessions
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| name | string | User-facing name |
| description | string (optional) | Free-text Session context for the AI copilot |
| status | `active` \| `paused` \| `stopped` | Current state |
| pollIntervalMs | number | Min 5000 (5s) |
| timeoutMs | number | Per-source timeout, min 1000, max 80% of pollIntervalMs, default 15000 |
| createdAt | string (ISO) | |
| updatedAt | string (ISO) | |

### sources
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| sessionId | string (FK → sessions) | |
| key | string | Unique per session. Lowercase, [a-z0-9_], no leading number |
| name | string | User-facing label |
| url | string | Static GET URL |
| queryParams | JSON | `[{key, value}]` |
| authConfig | JSON | `{type: 'none' \| 'bearer' \| 'header', ...}` |
| enabled | boolean | |
| createdAt | string (ISO) | |

### field_mappings
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| sourceId | string (FK → sources) | |
| label | string | Display name |
| key | string | Short key, e.g. `spend` |
| jsonPath | string | Dot-path, e.g. `campaign.stats.spend` |
| type | `string` \| `number` \| `boolean` | Expected scalar type |

### derived_metrics
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| sessionId | string (FK → sessions) | |
| label | string | Display name |
| key | string | Short key, e.g. `roas` |
| formula | string | Expression using mapped fields, e.g. `amount / spend` |

### charts
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| sessionId | string (FK → sessions) | |
| name | string | Chart title |
| series | JSON | `string[]` — refs like `ads.spend`, `roas` |
| createdAt | string (ISO) | |

### warning_rules
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| sessionId | string (FK → sessions) | |
| name | string | |
| expression | string | e.g. `roas < 1.2 && ads.spend > 100000` |
| severity | `info` \| `warning` \| `critical` | |
| enabled | boolean | |

### poll_cycles
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| sessionId | string (FK → sessions) | |
| timestamp | string (ISO) | Shared timestamp for all sources in cycle |

### source_results
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| cycleId | string (FK → poll_cycles) | |
| sourceId | string (FK → sources) | |
| success | boolean | |
| rawJson | JSON | Full response body (nullable on failure) |
| statusCode | number | HTTP status |
| error | string | Error message if failed |
| durationMs | number | Fetch latency |

### mapped_values
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| sourceResultId | string (FK → source_results) | |
| mappingId | string (FK → field_mappings) | |
| value | scalar | Extracted scalar value (null if missing/error) |

### derived_values
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| cycleId | string (FK → poll_cycles) | |
| metricId | string (FK → derived_metrics) | |
| value | number \| null | Computed result (null on error) |
| error | string | Error message if computation failed |

### warning_events
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| cycleId | string (FK → poll_cycles) | |
| ruleId | string (FK → warning_rules) | |
| state | `healthy` \| `warning` \| `critical` | New state |
| transition | `healthy→warning` \| `warning→healthy` \| `healthy→critical` \| etc. | |

### ai_profiles
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| name | string | Local profile label |
| baseUrl | string | OpenAI-compatible endpoint or relay URL |
| apiKey | string | Stored locally in IndexedDB |
| model | string | Default model name |
| transport | `direct` \| `relay` | Browser direct call or user-owned proxy |
| enabled | boolean | Whether the profile is active |
| createdAt | string (ISO) | |
| updatedAt | string (ISO) | |

### session_chat_messages
| Field | Type | Description |
|-------|------|-------------|
| id | string (PK) | UUID |
| sessionId | string (FK → sessions) | |
| role | `system` \| `user` \| `assistant` | Chat role |
| content | string | Persisted message text |
| createdAt | string (ISO) | |
| meta | JSON | Optional preset/model/context metadata |

## Indexes

| Table | Index | Fields |
|-------|-------|--------|
| sources | bySession | sessionId |
| sources | byKey | [sessionId, key] (unique) |
| field_mappings | bySource | sourceId |
| derived_metrics | bySession | sessionId |
| charts | bySession | sessionId |
| warning_rules | bySession | sessionId |
| poll_cycles | bySession | [sessionId, timestamp] |
| source_results | byCycle | cycleId |
| source_results | bySource | [sourceId, cycleId] |
| mapped_values | byResult | sourceResultId |
| mapped_values | byMapping | [mappingId, sourceResultId] |
| derived_values | byCycle | cycleId |
| derived_values | byMetric | [metricId, cycleId] |
| warning_events | byCycle | cycleId |
| warning_events | byRule | [ruleId, cycleId] |
| ai_profiles | byEnabled | enabled |
| ai_profiles | byUpdatedAt | updatedAt |
| session_chat_messages | bySession | sessionId |
| session_chat_messages | bySessionCreatedAt | [sessionId, createdAt] |

## Notes

- All IDs are UUID v4 strings.
- `authConfig` is stored as plain JSON. MVP stores secrets in IndexedDB. Excluded from export.
- `ai_profiles.apiKey` is stored locally in IndexedDB and is intentionally excluded from Session export.
- `session_chat_messages` are local copilot history and are intentionally excluded from Session export.
- `rawJson` in source_results may be large. Consider pruning or moving to separate object store if quota becomes an issue.
