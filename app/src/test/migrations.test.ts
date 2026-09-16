import Dexie from 'dexie'
import { expect, it } from 'vitest'
import { BusinessDatabase, legacySchema } from '../db/database'
import { seedDemo } from '../db/seed'

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
    expect(upgraded.verno).toBe(2)
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
