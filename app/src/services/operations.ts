import { db } from '../db/database'
import type { CashSession, Expense, PaymentEntry, StockMovement } from '../domain/types'
import { assertCentavos, assertQuantity } from '../domain/money'
import { localContext, localWrite, queueEvent, validateAccount } from './local-context'

export async function receiveStock(input: {
  businessId: string
  productId: string
  quantity: number
  totalCostCentavos: number
  paidFromAccountId: string
}) {
  return localWrite(async () => {
  const context = await localContext(input.businessId)
  assertQuantity(input.quantity)
  assertCentavos(input.totalCostCentavos)
  await validateAccount(context, input.paidFromAccountId)
  const product = await db.products.get(input.productId)
  if (!product?.active || !product.inventoryTracked || product.businessId !== input.businessId || product.workspaceId !== context.workspaceId) throw new Error('Choose an inventory-tracked product for this business.')
  assertQuantity(input.quantity, product.baseUnit !== 'kg')

  const now = new Date().toISOString()
  const purchaseId = crypto.randomUUID()
  const movements = await db.stockMovements.where('[locationId+productId]').equals([context.locationId, product.id]).toArray()
  const oldQty = movements.reduce((s, m) => s + m.quantityDelta, 0)
  if (oldQty < 0) throw new Error('Negative stock requires reconciliation before costing a receipt.')
  const oldValue = Math.max(0, oldQty) * product.estimatedCostCentavos
  const receivedUnitCost = Math.round(input.totalCostCentavos / input.quantity)
  const newQty = Math.max(0, oldQty) + input.quantity
  const newAverageCost = newQty > 0 ? Math.round((oldValue + input.totalCostCentavos) / newQty) : receivedUnitCost

  const movement: StockMovement = {
    ...context,
    id: crypto.randomUUID(), businessId: input.businessId, productId: input.productId,
    quantityDelta: input.quantity, reason: 'purchase', referenceType: 'purchase', referenceId: purchaseId, createdAt: now
  }
  const payment: PaymentEntry = {
    ...context,
    id: crypto.randomUUID(), businessId: input.businessId, accountId: input.paidFromAccountId,
    amountCentavos: input.totalCostCentavos, direction: 'out', kind: 'purchase', createdAt: now
  }

    await db.stockMovements.add(movement)
    await db.paymentEntries.add(payment)
    await db.products.update(product.id, { estimatedCostCentavos: newAverageCost })
    await queueEvent({ businessId: input.businessId, entityType: 'purchase_bundle', entityId: purchaseId, operation: 'create', payload: { purchaseId, productId: product.id, quantity: input.quantity, totalCostCentavos: input.totalCostCentavos, receivedUnitCost, newAverageCost, movement, payment }, occurredAt: now })
  })
}

export async function recordExpense(input: {
  businessId: string
  category: string
  amountCentavos: number
  paidFromAccountId: string
  fundedByOwner: boolean
  note?: string
}) {
  return localWrite(async () => {
  const context = await localContext(input.businessId)
  assertCentavos(input.amountCentavos)
  if (!input.category.trim()) throw new Error('Expense category is required.')
  if (!input.fundedByOwner) await validateAccount(context, input.paidFromAccountId)
  const now = new Date().toISOString()
  const expense: Expense = {
    ...context,
    id: crypto.randomUUID(), businessId: input.businessId, category: input.category,
    amountCentavos: input.amountCentavos, paidFromAccountId: input.fundedByOwner ? context.actorId : input.paidFromAccountId,
    fundedByOwner: input.fundedByOwner, note: input.note, createdAt: now
  }

    await db.expenses.add(expense)
    let payment: PaymentEntry | undefined
    if (!input.fundedByOwner) {
      payment = {
        ...context,
        id: crypto.randomUUID(), businessId: input.businessId, accountId: input.paidFromAccountId,
        amountCentavos: input.amountCentavos, direction: 'out', kind: 'expense', createdAt: now
      }
      await db.paymentEntries.add(payment)
    }
    await queueEvent({ businessId: input.businessId, entityType: 'expense_bundle', entityId: expense.id, operation: 'create', payload: { expense, payment, ownerPayableCentavos: input.fundedByOwner ? input.amountCentavos : 0 }, occurredAt: now })
  return expense
  })
}

export async function getOpenCashSession(businessId: string, accountId: string) {
  const sessions = await db.cashSessions.where('businessId').equals(businessId).filter(x => x.accountId === accountId && x.status === 'open').toArray()
  return sessions.sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0]
}

export async function openCashSession(businessId: string, accountId: string, openingCentavos: number) {
  return localWrite(async () => {
  const context = await localContext(businessId)
  assertCentavos(openingCentavos, true)
  await validateAccount(context, accountId, true)
  const existing = await getOpenCashSession(businessId, accountId)
  if (existing) throw new Error('A cash session is already open for this drawer.')
  const session: CashSession = { ...context, id: crypto.randomUUID(), businessId, accountId, openedAt: new Date().toISOString(), openingCentavos, status: 'open' }
    await db.cashSessions.add(session)
    await queueEvent({ businessId, entityType: 'cash_session', entityId: session.id, operation: 'open', payload: session, occurredAt: session.openedAt })
  return session
  })
}

export async function calculateExpectedCash(session: CashSession) {
  if (session.status === 'closed' && session.expectedClosingCentavos !== undefined) return session.expectedClosingCentavos
  const entries = await db.paymentEntries.where('businessId').equals(session.businessId).filter(x => x.locationId === session.locationId && x.accountId === session.accountId && x.createdAt >= session.openedAt).toArray()
  return entries.reduce((balance, entry) => balance + (entry.direction === 'in' ? entry.amountCentavos : -entry.amountCentavos), session.openingCentavos)
}

export async function closeCashSession(sessionId: string, actualClosingCentavos: number) {
  return localWrite(async () => {
  assertCentavos(actualClosingCentavos, true)
  const session = await db.cashSessions.get(sessionId)
  if (!session || session.status !== 'open') throw new Error('Open cash session not found.')
  const expected = await calculateExpectedCash(session)
  const closedAt = new Date().toISOString()
  const patch = { status: 'closed' as const, closedAt, expectedClosingCentavos: expected, actualClosingCentavos, varianceCentavos: actualClosingCentavos - expected }
    await db.cashSessions.update(session.id, patch)
    await queueEvent({ businessId: session.businessId, entityType: 'cash_session', entityId: session.id, operation: 'close', payload: { ...session, ...patch }, occurredAt: closedAt })
  return { expected, variance: actualClosingCentavos - expected }
  })
}
