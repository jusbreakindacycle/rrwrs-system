import Dexie from 'dexie'
import { expect, it } from 'vitest'
import { BusinessDatabase, legacySchema } from '../db/database'
import { seedDemo } from '../db/seed'
import { demoIds as ids } from '../db/seed'

it('upgrades v1 without rewriting old history or unsynchronized payloads', async () => {
  const name = `Migration-${crypto.randomUUID()}`
  const legacy = new Dexie(name)
  legacy.version(1).stores(legacySchema)
  const oldEvent = { id: 'legacy-event', businessId: 'rice-main', syncState: 'pending', payload: { totalCentavos: 12345, original: true } }
  const oldSale = { id: 'legacy-sale', businessId: 'rice-main', totalCentavos: 12345 }
  await legacy.table('outbox').add(oldEvent)
  await legacy.table('sales').add(oldSale)
  legacy.close()
  const upgraded = new BusinessDatabase(name)
  try {
    await upgraded.open()
    expect(upgraded.verno).toBe(3)
    expect(await upgraded.outbox.get(oldEvent.id)).toEqual(oldEvent)
    expect(await upgraded.sales.get(oldSale.id)).toEqual(oldSale)
    expect(await upgraded.settings.get('legacyV1Preserved')).toEqual({ key: 'legacyV1Preserved', value: true })
    expect(await upgraded.locations.count()).toBe(0)
    expect(await upgraded.auditEvents.count()).toBe(0)
    await expect(seedDemo(upgraded, true)).rejects.toThrow('restricted')
    expect(await upgraded.outbox.get(oldEvent.id)).toEqual(oldEvent)
  } finally { await upgraded.delete() }
})

it('leaves a new non-demo database empty and refuses seed into a non-empty demo database', async () => {
  const database = new BusinessDatabase(`RRWRS-Demo-Seed-Test-${crypto.randomUUID()}`)
  try {
    await seedDemo(database, false)
    expect(await database.businesses.count()).toBe(0)
    await database.settings.add({ key: 'unrelated-existing-record', value: 'preserve me' })
    await expect(seedDemo(database, true)).rejects.toThrow('empty database')
    expect(await database.workspaces.count()).toBe(0)
    expect((await database.settings.get('unrelated-existing-record'))?.value).toBe('preserve me')
  } finally { await database.delete() }
})

it('upgrades scoped v2 sessions and abono while preserving payments, sales and pending bundles verbatim', async () => {
  const name = `Migration-v2-${crypto.randomUUID()}`, old = new Dexie(name)
  old.version(1).stores(legacySchema)
  old.version(2).stores({ workspaces: 'id, mode', businesses: 'id, workspaceId, type', locations: 'id, workspaceId, businessId, [workspaceId+businessId]', members: 'id, [workspaceId+userId]', locationAccess: 'id, memberId, [memberId+locationId]', stockMovements: 'id, businessId, productId, [locationId+productId], reason, createdAt, referenceId', auditEvents: 'id, &eventId, entityId, locationId, occurredAt', syncCheckpoints: 'scopeKey', appliedEvents: 'id, appliedAt' })
  const scope = { workspaceId: ids.workspace, businessId: ids.rice, locationId: ids.riceLocation }
  await old.table('workspaces').add({ id: ids.workspace, name: 'Practice', mode: 'demo' })
  await old.table('businesses').add({ id: ids.rice, workspaceId: ids.workspace, name: 'Rice', type: 'rice', active: true })
  await old.table('locations').add({ id: ids.riceLocation, workspaceId: ids.workspace, businessId: ids.rice, name: 'Store', active: true })
  await old.table('members').add({ id: ids.actor, userId: ids.actor, workspaceId: ids.workspace, role: 'owner', active: true })
  await old.table('products').add({ id: ids.sinandomeng, workspaceId: ids.workspace, businessId: ids.rice, name: 'Rice', baseUnit: 'kg', inventoryTracked: true, estimatedCostCentavos: 4700 })
  await old.table('paymentAccounts').add({ id: ids.riceCash, workspaceId: ids.workspace, businessId: ids.rice, name: 'Drawer', kind: 'cash', active: true })
  const time = '2026-09-16T00:00:00.000Z', sessionId = crypto.randomUUID(), closedId = crypto.randomUUID()
  const closed = { ...scope, id: closedId, accountId: ids.riceCash, openedAt: '2026-09-15T00:00:00.000Z', closedAt: '2026-09-15T01:00:00.000Z', status: 'closed', openingCentavos: 100, expectedClosingCentavos: 200, actualClosingCentavos: 190, varianceCentavos: -10 }
  await old.table('cashSessions').bulkAdd([{ ...scope, id: sessionId, accountId: ids.riceCash, openedAt: time, openingCentavos: 10000, status: 'open' }, closed])
  const payment = { ...scope, id: crypto.randomUUID(), accountId: ids.riceCash, createdAt: time, direction: 'in', kind: 'sale', amountCentavos: 5500 }
  const expense = { ...scope, id: crypto.randomUUID(), createdAt: time, category: 'Repair', amountCentavos: 15000, fundedByOwner: true, paidFromAccountId: 'owner-personal' }
  const sale = { ...scope, id: crypto.randomUUID(), totalCentavos: 5500, status: 'finalized', createdAt: time }
  const event = { ...scope, id: crypto.randomUUID(), entityType: 'sale_bundle', entityId: sale.id, payload: { sale, originalVersion: true }, syncState: 'pending', schemaVersion: 1, attempts: 0 }
  await old.table('paymentEntries').add(payment); await old.table('expenses').add(expense); await old.table('sales').add(sale); await old.table('outbox').add(event)
  old.close()
  const next = new BusinessDatabase(name)
  try {
    await next.open()
    expect((await next.cashSessions.get(sessionId))).toMatchObject({ legacyNetCentavos: 5500, cashModelVersion: 3, openingCentavos: 10000 })
    expect(await next.cashSessions.get(closedId)).toEqual(closed)
    expect(await next.paymentEntries.get(payment.id)).toEqual(payment)
    expect(await next.expenses.get(expense.id)).toEqual(expense)
    expect(await next.sales.get(sale.id)).toEqual(sale)
    expect(await next.outbox.get(event.id)).toEqual(event)
    expect((await next.ownerPayables.toArray())[0]).toMatchObject({ expenseId: expense.id, ownerId: ids.actor, amountCentavos: 15000 })
    expect((await next.products.get(ids.sinandomeng))).toMatchObject({ domainKind: 'rice_grain', version: 1, locationIds: [ids.riceLocation] })
    expect(await next.commands.count()).toBe(0)
    next.close(); await next.open()
    expect(await next.ownerPayables.count()).toBe(1)
  } finally { await next.delete() }
})
