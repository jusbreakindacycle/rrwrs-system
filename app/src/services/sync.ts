import { db } from '../db/database'

// Hard boundary: environment variables alone MUST NOT activate transport.
// M2 will supply authenticated ingestion, authorization, retries and atomic pull.
export const cloudConfigured = false

export async function requestPersistentStorage() {
  try {
    return navigator.storage?.persist ? await navigator.storage.persist() : false
  } catch {
    return false
  }
}

export async function syncPending() {
  return { pushed: 0, mode: 'disabled' as const, pending: await countPending() }
}

export function countPending() {
  return db.outbox.where('syncState').anyOf('pending', 'failed').count()
}
