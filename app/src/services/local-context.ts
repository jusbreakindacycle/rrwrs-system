import { db } from '../db/database'
import type { LocationScope } from '../domain/types'
import { assertId } from '../domain/money'

// Trusted-device validation, NOT server authorization or tamper resistance.
export async function localContext(businessId: string, locationId?: string) {
  assertId(businessId)
  if (locationId !== undefined) assertId(locationId)
  const business = await db.businesses.get(businessId)
  if (!business?.active) throw new Error('Active business not found.')
  const workspace = await db.workspaces.get(business.workspaceId)
  if (!workspace || !['demo', 'local'].includes(workspace.mode)) throw new Error('Local workspace is not configured.')
  const locations = await db.locations.where('businessId').equals(businessId).filter(x => x.active).toArray()
  const location = locationId ? locations.find(x => x.id === locationId) : locations.length === 1 ? locations[0] : undefined
  if (!location || location.workspaceId !== business.workspaceId) throw new Error('Choose an active location for this business.')
  const actorId = (await db.settings.get('actorId'))?.value
  const deviceId = (await db.settings.get('deviceId'))?.value
  if (typeof actorId !== 'string' || typeof deviceId !== 'string') throw new Error('Local device identity is missing. Records were preserved.')
  assertId(actorId)
  assertId(deviceId)
  const member = await db.members.where('[workspaceId+userId]').equals([workspace.id, actorId]).first()
  const access = member && await db.locationAccess.where('[memberId+locationId]').equals([member.id, location.id]).first()
  if (!member?.active || !['owner', 'operator'].includes(member.role) || !access || access.workspaceId !== workspace.id || access.businessId !== businessId) throw new Error('This local profile has no access to that location.')
  return { workspaceId: business.workspaceId, businessId, locationId: location.id, actorId, deviceId, locationName: location.name, role: member.role }
}

export async function validateAccount(scope: LocationScope, accountId: string, cashOnly = false) {
  assertId(accountId)
  const account = await db.paymentAccounts.get(accountId)
  if (!account?.active || account.workspaceId !== scope.workspaceId ||
    (account.businessId !== scope.businessId && account.businessId !== 'shared') ||
    (account.locationIds !== undefined && !account.locationIds.includes(scope.locationId)) ||
    (cashOnly && account.kind !== 'cash')) throw new Error('Choose an active payment account for this business.')
  if (account.kind === 'cash' && (account.businessId === 'shared' || account.locationIds && account.locationIds.length !== 1)) throw new Error('Assign this cash drawer to exactly one business and location before use.')
  return account
}

export async function queueEvent(input: { businessId: string; locationId?: string; entityType: string; entityId: string; operation: string; payload: unknown; occurredAt: string }) {
  const context = await localContext(input.businessId, input.locationId)
  const id = crypto.randomUUID()
  await db.outbox.add({ ...context, ...input, locationId: context.locationId, id, schemaVersion: 2, attempts: 0, syncState: 'pending' })
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

export type LocalContext = Awaited<ReturnType<typeof localContext>>
export function requireOwner(context: LocalContext) {
  if (context.role !== 'owner') throw new Error('This action requires the local owner profile.')
}

export async function readableLocations() {
  const actorId = (await db.settings.get('actorId'))?.value
  const members = await db.members.filter(m => m.active && m.userId === actorId).toArray()
  const locations = await db.locations.toArray()
  const businesses = await db.businesses.toArray()
  const grants = await db.locationAccess.toArray()
  return locations.filter(l => members.some(m => m.workspaceId === l.workspaceId && grants.some(g => g.memberId === m.id && g.locationId === l.id && g.businessId === l.businessId && g.workspaceId === l.workspaceId)) && businesses.some(b => b.id === l.businessId && b.workspaceId === l.workspaceId))
}
