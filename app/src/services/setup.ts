import { db } from '../db/database'
import { assertId, requiredText } from '../domain/money'
import type { Business, BusinessType, Location, LocationScope } from '../domain/types'
import { executeCommand, fingerprint, type CommandInput } from './commands'
import { localWrite, queueEvent, requireOwner } from './local-context'

async function createStore(workspaceId: string, ownerId: string, name: string, type: BusinessType, locationName: string) {
  if (!['water', 'rice'].includes(type)) throw new Error('Choose Water or Rice.')
  const business: Business = { id: crypto.randomUUID(), workspaceId, name: requiredText(name, 'Business name'), type, active: true }
  const location: Location = { id: crypto.randomUUID(), workspaceId, businessId: business.id, name: requiredText(locationName, 'Location name'), active: true }
  const member = await db.members.where('[workspaceId+userId]').equals([workspaceId, ownerId]).first()
  if (!member) throw new Error('Local owner profile is missing.')
  await db.businesses.add(business)
  await db.locations.add(location)
  const access = { id: crypto.randomUUID(), workspaceId, businessId: business.id, locationId: location.id, memberId: member.id }
  await db.locationAccess.add(access)
  const account = { id: crypto.randomUUID(), workspaceId, businessId: business.id, name: 'Main Cash Drawer', kind: 'cash' as const, active: true, locationIds: [location.id], version: 1 }
  await db.paymentAccounts.add(account)
  return { business, location, access, account }
}

export function setupLocalWorkspace(input: { commandId: string; workspaceName: string; ownerName: string; businessName: string; businessType: BusinessType; locationName: string }) {
  return localWrite(async () => {
    assertId(input.commandId)
    const signature = fingerprint(input)
    const prior = await db.commands.get(input.commandId)
    if (prior) {
      if (prior.kind !== 'local_setup' || prior.fingerprint !== signature) throw new Error('Setup command belongs to different data.')
      return prior.result as LocationScope
    }
    for (const table of db.tables.filter(t => t.name !== 'drafts')) {
      if (await table.count()) throw new Error('Setup requires an empty database. Existing records were preserved; no automatic import or reset is available.')
    }
    const now = new Date().toISOString()
    const workspace = { id: input.commandId, name: requiredText(input.workspaceName, 'Workspace name'), mode: 'local' as const }
    const actorId = crypto.randomUUID()
    const member = { id: actorId, workspaceId: workspace.id, userId: actorId, role: 'owner' as const, active: true, displayName: requiredText(input.ownerName, 'Owner name') }
    await db.workspaces.add(workspace)
    await db.members.add(member)
    await db.settings.bulkAdd([{ key: 'actorId', value: actorId }, { key: 'deviceId', value: crypto.randomUUID() }])
    const store = await createStore(workspace.id, actorId, input.businessName, input.businessType, input.locationName)
    const scope = { workspaceId: workspace.id, businessId: store.business.id, locationId: store.location.id }
    await queueEvent({ ...scope, entityType: 'local_setup', entityId: workspace.id, operation: 'create', payload: { workspace, member, ...store }, occurredAt: now })
    await db.commands.add({ ...scope, id: input.commandId, kind: 'local_setup', fingerprint: signature, result: scope, committedAt: now })
    return scope
  })
}

export function addBusiness(input: CommandInput & { name: string; type: BusinessType; locationName: string }) {
  return executeCommand('business_setup', input, async (context) => {
    requireOwner(context)
    const store = await createStore(context.workspaceId, context.actorId, input.name, input.type, input.locationName)
    return { result: store.business, payload: store, entityId: store.business.id }
  })
}

export function addLocation(input: CommandInput & { name: string }) {
  return executeCommand('location_setup', input, async (context, id) => {
    requireOwner(context)
    const location: Location = { id, workspaceId: context.workspaceId, businessId: context.businessId, name: requiredText(input.name, 'Location name'), active: true }
    const member = await db.members.where('[workspaceId+userId]').equals([context.workspaceId, context.actorId]).first()
    if (!member) throw new Error('Local profile is missing.')
    const access = { ...context, id: crypto.randomUUID(), locationId: id, memberId: member.id }
    await db.locations.add(location)
    await db.locationAccess.add(access)
    return { result: location, payload: { location, access } }
  })
}
