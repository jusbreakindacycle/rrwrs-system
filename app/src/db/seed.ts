import { db, type BusinessDatabase } from './database'
import { demoMode } from '../config'
import type { Product } from '../domain/types'

const fixtureId = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`
export const demoIds = {
  workspace: fixtureId(1), actor: fixtureId(2), water: fixtureId(3), rice: fixtureId(4),
  waterLocation: fixtureId(5), riceLocation: fixtureId(6),
  purified: fixtureId(7), alkaline: fixtureId(8), container: fixtureId(9),
  sinandomeng: fixtureId(10), dinorado: fixtureId(11),
  waterCash: fixtureId(12), riceCash: fixtureId(13), gcash: fixtureId(14)
}

export async function seedDemo(database: BusinessDatabase = db, enabled = demoMode) {
  if (!enabled) return
  if (!database.name.startsWith('RRWRS-Demo')) throw new Error('Sample data is restricted to a demo database.')
  await database.transaction('rw', database.tables, async () => {
    // Check inside the transaction: safe under React StrictMode and two tabs.
    if (await database.settings.get('seededAt')) return
    for (const table of database.tables) {
      if (await table.count()) throw new Error('Demo setup requires an empty database; existing records were preserved.')
    }
    const w = demoIds.workspace
    await database.workspaces.add({ id: w, name: 'Practice workspace', mode: 'demo' })
    await database.businesses.bulkAdd([
      { id: demoIds.water, workspaceId: w, name: 'Water Refilling Station', type: 'water', active: true },
      { id: demoIds.rice, workspaceId: w, name: 'Bigasan', type: 'rice', active: true }
    ])
    await database.locations.bulkAdd([
      { id: demoIds.waterLocation, workspaceId: w, businessId: demoIds.water, name: 'Water store · demo location', active: true },
      { id: demoIds.riceLocation, workspaceId: w, businessId: demoIds.rice, name: 'Rice store · separate demo location', active: true }
    ])
    await database.members.add({ id: demoIds.actor, workspaceId: w, userId: demoIds.actor, role: 'owner', active: true })
    await database.locationAccess.bulkAdd([
      { id: fixtureId(20), workspaceId: w, businessId: demoIds.water, locationId: demoIds.waterLocation, memberId: demoIds.actor },
      { id: fixtureId(21), workspaceId: w, businessId: demoIds.rice, locationId: demoIds.riceLocation, memberId: demoIds.actor }
    ])
    const product = (id: string, businessId: string, name: string, sku: string, baseUnit: Product['baseUnit'], priceCentavos: number, estimatedCostCentavos: number): Product => ({
      id, workspaceId: w, businessId, name, sku, baseUnit, priceCentavos, estimatedCostCentavos,
      category: baseUnit === 'kg' ? 'Rice' : baseUnit === 'service' ? 'Refill' : 'Container',
      unitLabel: baseUnit === 'service' ? '5-gal refill' : baseUnit,
      inventoryTracked: baseUnit !== 'service', lowStockThreshold: baseUnit === 'kg' ? 20 : 5, active: true
    })
    await database.products.bulkAdd([
      product(demoIds.purified, demoIds.water, 'Purified Water Refill', 'W-PUR', 'service', 3000, 900),
      product(demoIds.alkaline, demoIds.water, 'Alkaline Water Refill', 'W-ALK', 'service', 3500, 1100),
      product(demoIds.container, demoIds.water, 'New 5-Gallon Container', 'W-GAL', 'unit', 19000, 14000),
      product(demoIds.sinandomeng, demoIds.rice, 'Sinandomeng', 'R-SIN', 'kg', 5500, 4700),
      product(demoIds.dinorado, demoIds.rice, 'Dinorado', 'R-DIN', 'kg', 6200, 5300)
    ])
    await database.paymentAccounts.bulkAdd([
      { id: demoIds.waterCash, workspaceId: w, businessId: demoIds.water, name: 'Water Cash Drawer', kind: 'cash', active: true },
      { id: demoIds.riceCash, workspaceId: w, businessId: demoIds.rice, name: 'Rice Cash Drawer', kind: 'cash', active: true },
      { id: demoIds.gcash, workspaceId: w, businessId: 'shared', name: 'GCash', kind: 'ewallet', active: true },
      { id: fixtureId(15), workspaceId: w, businessId: 'shared', name: 'Maya', kind: 'ewallet', active: true },
      { id: fixtureId(16), workspaceId: w, businessId: 'shared', name: 'Bank', kind: 'bank', active: true }
    ])
    const now = new Date().toISOString()
    await database.stockMovements.bulkAdd([
      { id: fixtureId(17), workspaceId: w, businessId: demoIds.water, locationId: demoIds.waterLocation, productId: demoIds.container, quantityDelta: 16, reason: 'opening', referenceType: 'demo_seed', referenceId: w, createdAt: now },
      { id: fixtureId(18), workspaceId: w, businessId: demoIds.rice, locationId: demoIds.riceLocation, productId: demoIds.sinandomeng, quantityDelta: 100, reason: 'opening', referenceType: 'demo_seed', referenceId: w, createdAt: now },
      { id: fixtureId(19), workspaceId: w, businessId: demoIds.rice, locationId: demoIds.riceLocation, productId: demoIds.dinorado, quantityDelta: 100, reason: 'opening', referenceType: 'demo_seed', referenceId: w, createdAt: now }
    ])
    await database.settings.bulkAdd([
      { key: 'seededAt', value: now }, { key: 'deviceId', value: crypto.randomUUID() },
      { key: 'actorId', value: demoIds.actor }
    ])
  })
}
