import Dexie from 'dexie'
import { db, type PollCycle } from '@/db'

/**
 * Fetch the most recent N poll cycles for a session.
 *
 * Uses the compound index [sessionId+timestamp] for efficient bounded reads.
 * Returns cycles in newest-first order (descending timestamp).
 *
 * This avoids loading the entire poll history into memory, which would
 * slow down as the session accumulates data.
 */
export async function getRecentCycles(
  sessionId: string,
  limit: number,
): Promise<PollCycle[]> {
  return db.pollCycles
    .where('[sessionId+timestamp]')
    .between([sessionId, Dexie.minKey], [sessionId, Dexie.maxKey])
    .reverse()
    .limit(limit)
    .toArray()
}
