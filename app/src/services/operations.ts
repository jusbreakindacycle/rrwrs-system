import { db } from '../db/database'
import type { CashSession, Expense, OwnerPayable, PaymentEntry, Purchase, PurchaseLine } from '../domain/types'
import { assertCentavos, assertId, assertQuantity, requiredText } from '../domain/money'
import { localContext, validateAccount } from './local-context'
import { executeCommand, type CommandInput } from './commands'
import { postPayment } from './payments'
import { postStock, scopedProduct, stockPosition } from './stock'

export const expenseCategories = ['Utilities', 'Rent', 'Fuel / delivery', 'Maintenance', 'Repair', 'Filters / treatment', 'Packaging', 'Permits / laboratory', 'Other'] as const

export function receiveStock(input: CommandInput & { productId: string; quantity: number; totalCostCentavos: number; paidFromAccountId: string; supplierId?: string; reference?: string; note?: string }) {
  return executeCommand('purchase_bundle', input, async (context, id, now) => {
    assertCentavos(input.totalCostCentavos)
    const product = await scopedProduct(context, input.productId)
    if (!product.inventoryTracked) throw new Error('Choose an inventory-tracked product for this business.')
    assertQuantity(input.quantity, product.baseUnit !== 'kg')
    const position = await stockPosition(context, product)
    if (position.quantityMilliunits < 0) throw new Error('Negative stock requires reconciliation before receiving.')
    const supplier = input.supplierId ? await db.suppliers.get(input.supplierId) : undefined
    if (input.supplierId && (!supplier?.active || supplier.businessId !== context.businessId || supplier.workspaceId !== context.workspaceId)) throw new Error('Choose an active supplier for this business.')
    const reference = input.reference?.trim() ?? ''
    if (reference.length > 100 || (input.note?.length ?? 0) > 500) throw new Error('Purchase reference or note is too long.')
    if (supplier && reference && await db.purchases.where('businessId').equals(context.businessId).filter(p => p.supplierId === supplier.id && p.reference.toLowerCase() === reference.toLowerCase()).count()) throw new Error('This supplier reference has already been received. Review purchase history.')
    const purchase: Purchase = { ...context, id, supplierId: supplier?.id, supplierName: supplier?.name ?? 'Unspecified supplier', reference, totalCostCentavos: input.totalCostCentavos, paidFromAccountId: input.paidFromAccountId, status: 'received', createdAt: now, note: input.note?.trim() ?? '' }
    const line: PurchaseLine = { id: crypto.randomUUID(), purchaseId: id, productId: product.id, productName: product.name, quantity: input.quantity, unitLabel: product.unitLabel, totalCostCentavos: input.totalCostCentavos }
    await db.purchases.add(purchase)
    await db.purchaseLines.add(line)
    const movement = await postStock(context, product, input.quantity, input.totalCostCentavos, id, 'purchase_receipt', now, purchase.note)
    const payment = await postPayment(context, input.paidFromAccountId, input.totalCostCentavos, 'out', 'purchase', id, now)
    return { result: purchase, payload: { purchase, lines: [line], movements: [movement], payments: [payment] } }
  })
}

export function recordExpense(input: CommandInput & { category: string; amountCentavos: number; paidFromAccountId: string; fundedByOwner: boolean; ownerId?: string; note?: string }) {
  return executeCommand('expense_bundle', input, async (context, id, now) => {
    assertCentavos(input.amountCentavos)
    if (!expenseCategories.some(c => c === input.category)) throw new Error('Choose an operating expense category. Inventory and owner money have separate workflows.')
    if (typeof input.fundedByOwner !== 'boolean') throw new Error('Choose the expense funding source.')
    const note = input.note?.trim() ?? ''
    if (note.length > 500 || input.category === 'Other' && !note) throw new Error('Describe this expense in a note (maximum 500 characters).')
    const ownerId = input.fundedByOwner ? input.ownerId ?? context.actorId : undefined
    if (input.fundedByOwner) {
      assertId(ownerId!)
      const owner = await db.members.where('[workspaceId+userId]').equals([context.workspaceId, ownerId!]).first()
      if (!owner?.active || owner.role !== 'owner') throw new Error('Select an active owner who paid personally.')
    }
    const expense: Expense = { ...context, id, category: input.category, amountCentavos: input.amountCentavos, paidFromAccountId: ownerId ?? input.paidFromAccountId, fundedByOwner: input.fundedByOwner, ownerId, note, createdAt: now }
    await db.expenses.add(expense)
    let payable: OwnerPayable | undefined
    if (ownerId) {
      payable = { ...context, id: crypto.randomUUID(), ownerId, expenseId: id, amountCentavos: input.amountCentavos, createdAt: now, kind: 'expense_funding' }
      await db.ownerPayables.add(payable)
    }
    const payment = ownerId ? undefined : await postPayment(context, input.paidFromAccountId, input.amountCentavos, 'out', 'expense', id, now)
    return { result: expense, payload: { expense, payable, payment } }
  })
}

export async function getOpenCashSession(businessId: string, accountId: string, locationId?: string) {
  const context = await localContext(businessId, locationId)
  await validateAccount(context, accountId, true)
  return db.cashSessions.where('accountId').equals(accountId).filter(s => s.status === 'open' && s.businessId === businessId && s.locationId === context.locationId && s.workspaceId === context.workspaceId).first()
}

export function openCashSession(businessId: string, accountId: string, openingCentavos: number, options: { locationId?: string; commandId?: string } = {}) {
  const input = { businessId, accountId, openingCentavos, ...options }
  return executeCommand('cash_open', input, async (context, id, now) => {
    assertCentavos(openingCentavos, true)
    await validateAccount(context, accountId, true)
    if (await db.cashSessions.where('accountId').equals(accountId).filter(s => s.status === 'open').count()) throw new Error('A cash session is already open for this drawer.')
    const session: CashSession = { ...context, id, accountId, openedAt: now, openingCentavos, status: 'open', cashModelVersion: 3, legacyNetCentavos: 0 }
    await db.cashSessions.add(session)
    return { result: session, payload: { session }, operation: 'open' }
  })
}

export async function calculateExpectedCash(session: CashSession) {
  if (session.status === 'closed' && session.expectedClosingCentavos !== undefined) return session.expectedClosingCentavos
  const entries = await db.paymentEntries.where('cashSessionId').equals(session.id).toArray()
  return expectedCashFromEntries(session, entries)
}

export function expectedCashFromEntries(session: CashSession, entries: PaymentEntry[]) {
  if (session.status === 'closed' && session.expectedClosingCentavos !== undefined) return session.expectedClosingCentavos
  if (entries.some(p => p.accountId !== session.accountId || p.locationId !== session.locationId || p.workspaceId !== session.workspaceId || p.businessId !== session.businessId)) throw new Error('Cash ledger scope mismatch; owner review required.')
  const expected = entries.reduce((sum, p) => sum + (p.direction === 'in' ? p.amountCentavos : -p.amountCentavos), session.openingCentavos + (session.legacyNetCentavos ?? 0))
  if (!Number.isSafeInteger(expected)) throw new Error('Cash total exceeds supported precision.')
  return expected
}

export async function closeCashSession(sessionId: string, actualClosingCentavos: number, options: { note?: string; commandId?: string } = {}) {
  assertId(sessionId)
  const found = await db.cashSessions.get(sessionId)
  if (!found) throw new Error('Cash session not found.')
  return executeCommand('cash_close', { businessId: found.businessId, locationId: found.locationId, sessionId, actualClosingCentavos, ...options } as CommandInput & { sessionId: string; actualClosingCentavos: number }, async (context, _id, now) => {
    assertCentavos(actualClosingCentavos, true)
    const session = await db.cashSessions.get(sessionId)
    if (!session || session.status !== 'open') throw new Error('Open cash session not found.')
    if (session.workspaceId !== context.workspaceId || session.businessId !== context.businessId || session.locationId !== context.locationId) throw new Error('Cash session scope mismatch. Records were preserved.')
    const expected = await calculateExpectedCash(session)
    const variance = actualClosingCentavos - expected
    const note = variance === 0 ? options.note?.trim() ?? '' : requiredText(options.note ?? '', 'Variance explanation', 500)
    if (note.length > 500) throw new Error('Note exceeds 500 characters.')
    const closed: CashSession = { ...session, status: 'closed', closedAt: now, expectedClosingCentavos: expected, actualClosingCentavos, varianceCentavos: variance, note }
    await db.cashSessions.put(closed)
    return { result: { expected, variance }, payload: { session: closed }, entityId: sessionId, operation: 'close' }
  })
}
