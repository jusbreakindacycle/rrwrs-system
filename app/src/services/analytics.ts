import type { LocationScope } from '../domain/types'
import { expectedCashFromEntries } from './operations'
import { deriveStockPosition } from './stock'
import { readSnapshot, snapshotScope } from './read-model'

export function philippineDay(now = new Date()) { return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10) }

export async function getDashboard(businessId: string, locationId = 'all', day = philippineDay()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(`${day}T00:00:00+08:00`))) throw new Error('Choose a valid report date.')
  const data = await readSnapshot(), { includes, locations } = snapshotScope(data, businessId, locationId)
  const today = (time: string) => philippineDay(new Date(time)) === day
  const sales = data.sales.filter(s => includes(s) && today(s.createdAt) && s.status === 'finalized')
  const saleIds = new Set(sales.map(s => s.id))
  const lines = data.saleLines.filter(l => saleIds.has(l.saleId))
  const payments = data.payments.filter(p => includes(p) && p.kind === 'sale' && p.direction === 'in' && saleIds.has(p.saleId ?? ''))
  const expenses = data.expenses.filter(e => includes(e) && today(e.createdAt))
  const purchasePayments = data.payments.filter(p => includes(p) && today(p.createdAt) && p.kind === 'purchase' && p.direction === 'out')
  const payableRows = data.payables.filter(includes)
  const ownerPayables = [...new Set(payableRows.map(p => p.ownerId))].map(id => ({ id, name: data.members.find(m => m.userId === id)?.displayName ?? id, amountCentavos: payableRows.filter(p => p.ownerId === id).reduce((sum, p) => sum + p.amountCentavos, 0) }))
  const sessions = data.sessions.filter(includes)
  const cash = sessions.filter(s => s.status === 'open' || today(s.closedAt ?? s.openedAt)).map(session => ({ ...session, expected: expectedCashFromEntries(session, data.payments.filter(p => p.cashSessionId === session.id)), accountName: data.accounts.find(a => a.id === session.accountId)?.name ?? session.accountId, locationName: locations.find(l => l.id === session.locationId)?.name ?? session.locationId }))
  const failed = data.outbox.filter(e => includes(e) && e.syncState === 'failed')
  const unassignedAbono = data.expenses.filter(e => includes(e) && e.fundedByOwner && !payableRows.some(p => p.expenseId === e.id)).length
  const unscopedHistory = data.sales.filter(s => !s.workspaceId || !s.locationId).length
  const paymentMix = [...new Set(payments.map(p => p.accountId))].map(id => ({ id, name: data.accounts.find(a => a.id === id)?.name ?? payments.find(p => p.accountId === id)?.accountName ?? id, kind: data.accounts.find(a => a.id === id)?.kind ?? 'unknown', amountCentavos: payments.filter(p => p.accountId === id).reduce((sum, p) => sum + p.amountCentavos, 0) }))
  return {
    salesCentavos: sales.reduce((sum, s) => sum + s.totalCentavos, 0), saleCount: sales.length,
    grossProfitCentavos: lines.some(l => l.costKnown === false) ? null : lines.reduce((sum, l) => sum + l.lineTotalCentavos - l.costCentavos, 0),
    paymentMix, cash, ownerPayables, failed, unassignedAbono, unscopedHistory,
    expenseCentavos: expenses.filter(e => !e.fundedByOwner).reduce((sum, e) => sum + e.amountCentavos, 0),
    abonoCentavos: expenses.filter(e => e.fundedByOwner).reduce((sum, e) => sum + e.amountCentavos, 0),
    purchaseCentavos: purchasePayments.reduce((sum, p) => sum + p.amountCentavos, 0),
    varianceCount: sessions.filter(s => s.status === 'closed' && s.varianceCentavos !== 0 && s.varianceCentavos !== undefined).length
  }
}

export async function getInventory(businessId: string, locationId = 'all') {
  const data = await readSnapshot(), { locations, includes } = snapshotScope(data, businessId, locationId)
  const products = data.products.filter(p => p.inventoryTracked && (businessId === 'all' || p.businessId === businessId))
  const movements = data.movements.filter(includes)
  const rows = []
  for (const location of locations) for (const product of products.filter(p => p.businessId === location.businessId && p.workspaceId === location.workspaceId)) {
    const ledger = movements.filter(m => m.productId === product.id && m.locationId === location.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (!ledger.length && (!product.active || product.locationIds && !product.locationIds.includes(location.id))) continue
    const position = deriveStockPosition({ workspaceId: location.workspaceId, businessId: location.businessId, locationId: location.id }, product, ledger, data.valuations.find(v => v.id === `${location.id}:${product.id}`))
    rows.push({ product, location, onHand: position.quantityMilliunits / 1000, valueCentavos: position.valueCentavos, basis: position.basis, ledger })
  }
  return rows
}

export async function getHistory(businessId: string, locationId = 'all') {
  const data = await readSnapshot(), { includes, locations } = snapshotScope(data, businessId, locationId)
  const rows: { id: string; scope: LocationScope; time: string; kind: string; amount: number; detail: string }[] = []
  for (const sale of data.sales.filter(includes)) rows.push({ id: sale.id, scope: sale, time: sale.createdAt, kind: 'Sale', amount: sale.totalCentavos, detail: data.saleLines.filter(l => l.saleId === sale.id).map(l => `${l.quantity} ${l.unitLabel} × ${l.productName}`).join('; ') + ' · ' + data.payments.filter(p => p.saleId === sale.id).map(p => p.accountName ?? data.accounts.find(a => a.id === p.accountId)?.name ?? p.accountId).join(' + ') })
  for (const p of data.purchases.filter(includes)) rows.push({ id: p.id, scope: p, time: p.createdAt, kind: 'Purchase receipt', amount: p.totalCostCentavos, detail: `${p.supplierName} · ${p.reference || 'No reference'} · ${data.purchaseLines.filter(l => l.purchaseId === p.id).map(l => `${l.quantity} ${l.unitLabel} ${l.productName}`).join('; ')} · ${p.note}` })
  for (const e of data.expenses.filter(includes)) rows.push({ id: e.id, scope: e, time: e.createdAt, kind: e.fundedByOwner ? 'Owner-funded expense' : 'Business-paid expense', amount: e.amountCentavos, detail: `${e.category} · ${e.note ?? ''}` })
  const audits = data.audits.filter(includes).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  return { rows: rows.sort((a, b) => b.time.localeCompare(a.time)).map(r => ({ ...r, locationName: locations.find(l => l.id === r.scope.locationId)?.name })), audits }
}
