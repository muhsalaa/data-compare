import type { Source } from '@/db'
import type { SourceAdapter } from './types'
import { HttpSourceAdapter } from './http'

/**
 * Registry of source type names → adapter factories.
 * Extensible: call `register('websocket', (s) => new WsAdapter(s))` to add types.
 */
const registry = new Map<string, (source: Source) => SourceAdapter>()

/**
 * Register a source type adapter factory.
 */
export function registerSourceType(
  type: string,
  factory: (source: Source) => SourceAdapter,
): void {
  registry.set(type, factory)
}

/**
 * Create the appropriate SourceAdapter for a DB Source record.
 *
 * Defaults to `http-poll` when the source has no type discriminator
 * (backward-compatible with sources created before the type field existed).
 */
export function createAdapter(source: Source): SourceAdapter {
  // The `type` field on Source is 'http-poll' by default.
  // When Source gets a `type` discriminator in the DB schema,
  // read it here. For now all sources are HTTP.
  const factory = registry.get(source.type ?? 'http-poll')
  if (!factory) {
    throw new Error(`Unknown source type: "${source.type}". Known types: ${[...registry.keys()].join(', ')}`)
  }
  return factory(source)
}

// Register the built-in HTTP adapter
registerSourceType('http-poll', (s) => new HttpSourceAdapter(s))
