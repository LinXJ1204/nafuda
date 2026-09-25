// One title index per page load, shared by every view; refreshed after a write (issue, transfer).

import { PSA_REGISTRY, START_BLOCK, TITLE_CONTROLLER } from './config.ts'
import { client } from './ens.ts'
import { loadIndex, type IndexedTitle } from './events.ts'

let cached: Promise<IndexedTitle[]> | null = null

export function titleIndex(refresh = false): Promise<IndexedTitle[]> {
  if (!cached || refresh) {
    cached = loadIndex(client, { titleController: TITLE_CONTROLLER, psaRegistry: PSA_REGISTRY, startBlock: START_BLOCK })
    cached.catch(() => (cached = null)) // retry on the next call
  }
  return cached
}
