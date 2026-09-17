import Dexie from 'dexie'
import { db } from '../db/database'
import type { LocationScope } from '../domain/types'

// Queue all reads synchronously in a single readonly transaction. Return a Dexie
// promise directly; compute reports after commit. Native async continuations in
// nested report loops can outlive a readonly transaction in a real browser.
export function readSnapshot() {
  return db.transaction('r', db.tables, () => Dexie.Promise.all([Dexie.Promise.all([
    db.settings.toArray(), db.workspaces.toArray(), db.members.toArray(),
    db.locationAccess.toArray(), db.businesses.toArray(), db.locations.toArray(),
    db.products.toArray(), db.paymentAccounts.toArray(), db.sales.toArray(),
    db.saleLines.toArray()
  ]), Dexie.Promise.all([db.paymentEntries.toArray(), db.purchases.toArray(),
    db.purchaseLines.toArray(), db.expenses.toArray(), db.ownerPayables.toArray(),
    db.cashSessions.toArray(), db.stockMovements.toArray(), db.stockValuations.toArray(),
    db.outbox.toArray(), db.auditEvents.toArray()
  ])])).then(([[settings, workspaces, members, grants, businesses, locations, products, accounts, sales, saleLines], [payments, purchases, purchaseLines, expenses, payables, sessions, movements, valuations, outbox, audits]]) => ({ settings, workspaces, members, grants, businesses, locations, products, accounts, sales, saleLines, payments, purchases, purchaseLines, expenses, payables, sessions, movements, valuations, outbox, audits }))
}

export function snapshotScope(data: Awaited<ReturnType<typeof readSnapshot>>, businessId: string, locationId: string) {
  const actor = data.settings.find(s => s.key === 'actorId')?.value
  const members = data.members.filter(m => m.active && m.userId === actor && ['owner', 'operator'].includes(m.role))
  const locations = data.locations.filter(l => (businessId === 'all' || l.businessId === businessId) && (locationId === 'all' || l.id === locationId)
    && data.workspaces.some(w => w.id === l.workspaceId && ['local', 'demo'].includes(w.mode))
    && data.businesses.some(b => b.id === l.businessId && b.workspaceId === l.workspaceId)
    && members.some(m => m.workspaceId === l.workspaceId && data.grants.some(g => g.memberId === m.id && g.locationId === l.id && g.workspaceId === l.workspaceId && g.businessId === l.businessId)))
  const includes = (row: LocationScope) => locations.some(l => l.id === row.locationId && l.businessId === row.businessId && l.workspaceId === row.workspaceId)
  return { locations, includes }
}
