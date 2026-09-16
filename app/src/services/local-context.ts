import { db } from '../db/database'
import type { LocationScope } from '../domain/types'

// Scope validation is NOT production authorization. Only explicit demo
// workspaces may mutate until authenticated provisioning exists.
export async function localContext(businessId: string, locationId?: string) {
  const business = await db.businesses.get(businessId)
  if (!business?.active) throw new Error('Active business not found.')
  const workspace = await db.workspaces.get(business.workspaceId)
  if (workspace?.mode !== 'demo') throw new Error('Production provisioning is not available yet.')
  const locations = await db.locations.where('businessId').equals(businessId).filter(x => x.active).toArray()
  const location = locationId ? locations.find(x => x.id === locationId) : locations.length === 1 ? locations[0] : undefined
  if (!location || location.workspaceId !== business.workspaceId) throw new Error('Choose an active location for this business.')
  const actorId = (await db.settings.get('actorId'))?.value
  const deviceId = (await db.settings.get('deviceId'))?.value
  if (typeof actorId !== 'string' || typeof deviceId !== 'string') throw new Error('Local device identity is missing. Records were preserved.')
  return { workspaceId: business.workspaceId, businessId, locationId: location.id, actorId, deviceId, locationName: location.name }
}

export async function validateAccount(scope: LocationScope, accountId: string, cashOnly = false) {
  const account = await db.paymentAccounts.get(accountId)
  if (!account?.active || account.workspaceId !== scope.workspaceId ||
    (account.businessId !== scope.businessId && account.businessId !== 'shared') ||
    (cashOnly && account.kind !== 'cash')) throw new Error('Choose an active payment account for this business.')
  return account
}

export async function queueEvent(input: { businessId: string; locationId?: string; entityType: string; entityId: string; operation: string; payload: unknown; occurredAt: string }) {
  const context = await localContext(input.businessId, input.locationId)
  const id = crypto.randomUUID()
  await db.outbox.add({ ...context, ...input, locationId: context.locationId, id, schemaVersion: 1, attempts: 0, syncState: 'pending' })
  await db.auditEvents.add({
    ...context, id: crypto.randomUUID(), eventId: id, entityType: input.entityType,
    entityId: input.entityId, operation: input.operation, occurredAt: input.occurredAt
  })
}

// Overlapping tables serialize competing local transactions across tabs.
// Tighten table lists only with tests; never put network work in this boundary.
export function localWrite<T>(work: () => Promise<T>) {
  return db.transaction('rw', db.tables, work)
}
