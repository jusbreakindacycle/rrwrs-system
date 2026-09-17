import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
import { demoIds as ids, seedDemo } from '../db/seed'
import { createSale } from '../services/sales'
import { receiveStock, recordExpense, openCashSession, closeCashSession, calculateExpectedCash } from '../services/operations'
import { saveProduct, savePaymentAccount, saveSupplier, type ProductInput } from '../services/catalog'
import { addBusiness, addLocation, setupLocalWorkspace } from '../services/setup'
import { adjustStock, stockPosition } from '../services/stock'
import { getDashboard, getInventory, getHistory, philippineDay } from '../services/analytics'
import { localContext } from '../services/local-context'
import { proportionalCentavos } from '../domain/money'

const scope = { businessId: ids.rice, locationId: ids.riceLocation }
const sale = () => ({ ...scope, commandId: crypto.randomUUID(), productId: ids.sinandomeng, quantity: 5, paymentAccountId: ids.gcash })
const purchase = () => ({ ...scope, commandId: crypto.randomUUID(), productId: ids.sinandomeng, quantity: 100, totalCostCentavos: 490000, paidFromAccountId: ids.gcash })
const expense = () => ({ ...scope, commandId: crypto.randomUUID(), category: 'Utilities', amountCentavos: 15000, paidFromAccountId: ids.gcash, fundedByOwner: false })
const newProduct = (): ProductInput => ({ ...scope, commandId: crypto.randomUUID(), name: 'Jasmine', sku: 'R-JAS', domainKind: 'rice_grain', baseUnit: 'kg', priceCentavos: 6000, estimatedCostCentavos: 0, costKnown: false, active: true, lowStockThreshold: 10, locationIds: [ids.riceLocation], metadata: { sackKg: 50 } })
const counts = async () => Object.fromEntries(await Promise.all(db.tables.map(async t => [t.name, await t.count()])))

beforeEach(async () => { await db.delete(); await db.open(); await seedDemo(db, true) })
afterAll(() => db.delete())

describe('atomic operational commands', () => {
  it('receives a supplier purchase exactly once after duplicate and lost-response retry', async () => {
    const supplier = await saveSupplier({ ...scope, name: 'Mill', contact: 'Local', active: true })
    const input = { ...purchase(), supplierId: supplier.id, reference: 'INV-001' }
    const [first, second] = await Promise.all([receiveStock(input), receiveStock(input)])
    expect(first.id).toBe(second.id)
    db.close(); await db.open()
    expect((await receiveStock(input)).id).toBe(first.id)
    expect(await db.purchases.count()).toBe(1)
    expect(await db.purchaseLines.count()).toBe(1)
    expect(await db.stockMovements.where('reason').equals('purchase_receipt').count()).toBe(1)
    expect(await db.paymentEntries.count()).toBe(1)
    expect(await db.expenses.count()).toBe(0)
    expect(await db.outbox.where('entityType').equals('purchase_bundle').count()).toBe(1)
    await expect(receiveStock({ ...input, commandId: crypto.randomUUID(), reference: 'inv-001' })).rejects.toThrow('already been received')
    await expect(receiveStock({ ...input, quantity: 101 })).rejects.toThrow('different transaction')
  })

  it.each(['sale', 'purchase', 'expense', 'abono', 'adjustment', 'opening', 'catalog'] as const)('rolls back every write when final command receipt fails: %s', async kind => {
    const before = await counts()
    vi.spyOn(db.commands, 'add').mockRejectedValueOnce(new Error('storage full'))
    const operation = () => kind === 'sale' ? createSale(sale()) : kind === 'purchase' ? receiveStock(purchase()) : kind === 'expense' ? recordExpense(expense()) : kind === 'abono' ? recordExpense({ ...expense(), fundedByOwner: true }) : kind === 'adjustment' ? adjustStock({ ...scope, productId: ids.sinandomeng, quantityDelta: 2, unitCostCentavos: 4500, note: 'Witnessed opening addition' }) : kind === 'opening' ? openCashSession(ids.rice, ids.riceCash, 5000) : saveProduct(newProduct())
    await expect(operation()).rejects.toThrow('storage full')
    expect(await counts()).toEqual(before)
    expect((await getInventory(ids.rice)).find(r => r.product.id === ids.sinandomeng)?.onHand).toBe(100)
  })

  it('retries business and owner-funded expenses without duplicating outflow or liability', async () => {
    const session = await openCashSession(ids.rice, ids.riceCash, 100000)
    const business = { ...expense(), paidFromAccountId: ids.riceCash }
    await Promise.all([recordExpense(business), recordExpense(business)])
    const abono = { ...expense(), fundedByOwner: true, paidFromAccountId: '' }
    await Promise.all([recordExpense(abono), recordExpense(abono)])
    expect(await db.expenses.count()).toBe(2)
    expect(await db.paymentEntries.count()).toBe(1)
    expect(await db.ownerPayables.count()).toBe(1)
    expect((await db.ownerPayables.toArray())[0]).toMatchObject({ ownerId: ids.actor, amountCentavos: 15000, expenseId: abono.commandId })
    expect(await calculateExpectedCash(session)).toBe(85000)
    const report = await getDashboard(ids.rice)
    expect(report.expenseCentavos).toBe(15000)
    expect(report.abonoCentavos).toBe(15000)
    expect(report.ownerPayables[0].amountCentavos).toBe(15000)
    expect(report.salesCentavos).toBe(0)
  })

  it('commits mixed refill and container lines atomically and snapshots prices', async () => {
    const input = { businessId: ids.water, locationId: ids.waterLocation, commandId: crypto.randomUUID(), lines: [{ productId: ids.purified, quantity: 2 }, { productId: ids.container, quantity: 1 }], paymentAccountId: ids.gcash }
    await createSale(input); await createSale(input)
    expect(await db.sales.count()).toBe(1)
    expect(await db.saleLines.count()).toBe(2)
    expect((await getInventory(ids.water))[0].onHand).toBe(15)
    expect((await getDashboard(ids.water)).salesCentavos).toBe(25000)
    await db.products.update(ids.container, { priceCentavos: 99999 })
    expect((await db.saleLines.where('productId').equals(ids.container).first())?.unitPriceCentavos).toBe(19000)
  })

  it('supports exact split allocations without counting payment accounts as separate sales', async () => {
    const cash = await openCashSession(ids.rice, ids.riceCash, 10000)
    await createSale({ ...sale(), payments: [{ accountId: ids.gcash, amountCentavos: 20000 }, { accountId: ids.riceCash, amountCentavos: 7500 }] })
    const report = await getDashboard(ids.rice)
    expect(report.salesCentavos).toBe(27500)
    expect(report.paymentMix.map(p => p.amountCentavos).sort((a,b) => a-b)).toEqual([7500, 20000])
    expect(await calculateExpectedCash(cash)).toBe(17500)
    const before = await counts()
    await expect(createSale({ ...sale(), payments: [{ accountId: ids.gcash, amountCentavos: 27499 }] })).rejects.toThrow('equal')
    expect(await counts()).toEqual(before)
  })

  it('rejects overselling across duplicate basket lines without partial inventory consumption', async () => {
    await expect(createSale({ ...sale(), lines: [{ productId: ids.sinandomeng, quantity: 60 }, { productId: ids.sinandomeng, quantity: 60 }] })).rejects.toThrow('Insufficient')
    expect(await db.sales.count()).toBe(0)
    expect(await db.stockValuations.count()).toBe(0)
    expect(await db.stockMovements.count()).toBe(3)
  })
})

describe('cash attribution and reconciliation', () => {
  it('requires an explicit open drawer for every cash mutation', async () => {
    await expect(createSale({ ...sale(), paymentAccountId: ids.riceCash })).rejects.toThrow('Open a cash session')
    await expect(receiveStock({ ...purchase(), paidFromAccountId: ids.riceCash })).rejects.toThrow('Open a cash session')
    await expect(recordExpense({ ...expense(), paidFromAccountId: ids.riceCash })).rejects.toThrow('Open a cash session')
    expect(await db.paymentEntries.count()).toBe(0)
    expect(await db.stockMovements.count()).toBe(3)
  })

  it.each([-500, 500, 0])('preserves variance %s, requires explanations, isolates next session, and retries close safely', async variance => {
    const openingCommand = crypto.randomUUID()
    const session = await openCashSession(ids.rice, ids.riceCash, 50000, { commandId: openingCommand })
    expect((await openCashSession(ids.rice, ids.riceCash, 50000, { commandId: openingCommand })).id).toBe(session.id)
    await createSale({ ...sale(), paymentAccountId: ids.riceCash })
    await createSale(sale()) // electronic money must not inflate the drawer
    await receiveStock({ ...purchase(), quantity: 1, totalCostCentavos: 4800, paidFromAccountId: ids.riceCash })
    await recordExpense({ ...expense(), amountCentavos: 1000, paidFromAccountId: ids.riceCash })
    expect(await calculateExpectedCash(session)).toBe(71700)
    if (variance) await expect(closeCashSession(session.id, 71700 + variance)).rejects.toThrow('explanation')
    const options = { commandId: crypto.randomUUID(), note: variance ? 'Recounted twice; discrepancy retained' : '' }
    const [a,b] = await Promise.all([closeCashSession(session.id, 71700 + variance, options), closeCashSession(session.id, 71700 + variance, options)])
    expect(a).toEqual({ expected: 71700, variance }); expect(b).toEqual(a)
    const closed = (await db.cashSessions.get(session.id))!
    const next = await openCashSession(ids.rice, ids.riceCash, 71700 + variance)
    await createSale({ ...sale(), paymentAccountId: ids.riceCash })
    expect(await calculateExpectedCash(closed)).toBe(71700)
    expect(await calculateExpectedCash(next)).toBe(99200 + variance)
    expect((await db.paymentEntries.where('cashSessionId').equals(session.id).count())).toBe(3)
  })

  it('restores an open session if final close audit fails', async () => {
    const session = await openCashSession(ids.rice, ids.riceCash, 10000)
    const before = await counts()
    vi.spyOn(db.auditEvents, 'add').mockRejectedValueOnce(new Error('close failed'))
    await expect(closeCashSession(session.id, 10000)).rejects.toThrow('close failed')
    expect((await db.cashSessions.get(session.id))?.status).toBe('open')
    expect(await counts()).toEqual(before)
  })
})

describe('catalog, scope and numeric safeguards', () => {
  it('manages product revisions, inactive state, and rejects stale price/identity changes', async () => {
    const input = newProduct(), p = await saveProduct(input)
    expect((await saveProduct(input)).id).toBe(p.id)
    const updated = { ...input, commandId: crypto.randomUUID(), id: p.id, expectedVersion: 1, priceCentavos: 6500 }
    await saveProduct(updated)
    await expect(saveProduct({ ...updated, commandId: crypto.randomUUID() })).rejects.toThrow('another tab')
    await expect(createSale({ ...sale(), lines: [{ productId: p.id, quantity: 1, expectedVersion: 1, expectedPriceCentavos: 6000 }] })).rejects.toThrow('changed')
    await expect(saveProduct({ ...updated, commandId: crypto.randomUUID(), expectedVersion: 2, domainKind: 'stock_item', baseUnit: 'unit' })).rejects.toThrow('identity')
    await saveProduct({ ...updated, commandId: crypto.randomUUID(), expectedVersion: 2, active: false })
    await expect(receiveStock({ ...purchase(), productId: p.id })).rejects.toThrow('active product')
    expect(await db.productRevisions.where('productId').equals(p.id).count()).toBe(3)
    expect((await db.productRevisions.where('[productId+version]').equals([p.id, 1]).first())?.snapshot.priceCentavos).toBe(6000)
  })

  it('keeps configurable account identity, location and open-cash constraints', async () => {
    const a = await savePaymentAccount({ ...scope, name: 'BPI settlement', kind: 'bank', shared: false, active: true, locationIds: [ids.riceLocation] })
    await createSale({ ...sale(), paymentAccountId: a.id })
    expect((await getDashboard(ids.rice)).paymentMix[0].name).toBe('BPI settlement')
    await expect(savePaymentAccount({ ...scope, id: a.id, expectedVersion: 1, name: 'BPI', kind: 'ewallet', shared: false, active: true, locationIds: [ids.riceLocation] })).rejects.toThrow('cannot be changed')
    await expect(savePaymentAccount({ ...scope, name: 'Shared cash', kind: 'cash', shared: true, active: true, locationIds: [ids.riceLocation] })).rejects.toThrow('exactly one')
    await openCashSession(ids.rice, ids.riceCash, 0)
    await expect(savePaymentAccount({ ...scope, id: ids.riceCash, expectedVersion: 1, name: 'Rice drawer', kind: 'cash', shared: false, active: false, locationIds: [ids.riceLocation] })).rejects.toThrow('Close the cash session')
  })

  it('rejects cross-location availability, ambiguous scope, denied local access and operator administration', async () => {
    const location = await addLocation({ ...scope, name: 'Rice annex' })
    await expect(createSale({ ...sale(), locationId: location.id })).rejects.toThrow('available')
    await expect(createSale({ ...sale(), locationId: undefined })).rejects.toThrow('Choose an active location')
    await expect(saveProduct({ ...newProduct(), locationIds: [ids.waterLocation] })).rejects.toThrow('scope')
    await db.members.update(ids.actor, { role: 'operator' })
    await expect(saveProduct(newProduct())).rejects.toThrow('owner')
    await expect(adjustStock({ ...scope, productId: ids.sinandomeng, quantityDelta: -1, note: 'wrong entry' })).rejects.toThrow('owner')
    await createSale(sale())
    await db.locationAccess.where('[memberId+locationId]').equals([ids.actor, ids.riceLocation]).delete()
    await expect(createSale(sale())).rejects.toThrow('no access')
    expect((await getDashboard('all')).salesCentavos).toBe(0)
    expect((await getHistory('all')).rows).toHaveLength(0)
  })

  it('does not leak scoped reports or writes across workspaces', async () => {
    await createSale(sale())
    await db.products.update(ids.sinandomeng, { workspaceId: crypto.randomUUID() })
    await expect(createSale(sale())).rejects.toThrow('active product')
    await db.paymentAccounts.update(ids.gcash, { workspaceId: crypto.randomUUID() })
    await expect(recordExpense(expense())).rejects.toThrow('active payment')
    const row = (await db.sales.toArray())[0]
    await db.sales.update(row.id, { workspaceId: crypto.randomUUID() })
    expect((await getDashboard('all')).salesCentavos).toBe(0)
    expect((await getDashboard('all')).paymentMix).toHaveLength(0)
  })

  it.each([0, -1, NaN, Infinity, 0.0011])('rejects invalid quantities atomically: %s', async quantity => {
    const before = await counts()
    await expect(receiveStock({ ...purchase(), quantity })).rejects.toThrow()
    await expect(createSale({ ...sale(), quantity })).rejects.toThrow()
    expect(await counts()).toEqual(before)
  })

  it.each([0, -1, NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER + 1])('rejects invalid financial amounts atomically: %s', async amount => {
    const before = await counts()
    await expect(recordExpense({ ...expense(), amountCentavos: amount })).rejects.toThrow()
    await expect(receiveStock({ ...purchase(), totalCostCentavos: amount })).rejects.toThrow()
    expect(await counts()).toEqual(before)
  })

  it('rejects invalid identifiers, unauthorized supplier/owner, and non-expense categories', async () => {
    const before = await counts()
    await expect(createSale({ ...sale(), businessId: 'rice-main' })).rejects.toThrow('identifier')
    await expect(createSale({ ...sale(), locationId: ids.waterLocation })).rejects.toThrow('location')
    await expect(createSale({ ...sale(), commandId: 'bad' })).rejects.toThrow('identifier')
    await expect(receiveStock({ ...purchase(), supplierId: ids.actor })).rejects.toThrow('supplier')
    await expect(recordExpense({ ...expense(), fundedByOwner: true, ownerId: crypto.randomUUID() })).rejects.toThrow('owner')
    await expect(recordExpense({ ...expense(), fundedByOwner: true, ownerId: '' })).rejects.toThrow('identifier')
    for (const category of ['Inventory', 'Transfer', 'Owner contribution', 'Owner withdrawal', 'Reimbursement', 'Payroll']) await expect(recordExpense({ ...expense(), category })).rejects.toThrow('category')
    expect(await counts()).toEqual(before)
  })
})

describe('inventory value and honest reporting', () => {
  it('rounds proportional costs without losing cents near supported integer boundaries', () => {
    expect(proportionalCentavos(9007199254740991, 999999999, 1000000000)).toBe(9007199245733792)
    expect(proportionalCentavos(1, 1, 2)).toBe(1)
    expect(() => proportionalCentavos(Number.MAX_SAFE_INTEGER, 2, 1)).toThrow('centavos')
  })
  it('conserves inventory value through weighted purchases, fractional sales and exhaustion', async () => {
    const p = await saveProduct(newProduct())
    await receiveStock({ ...purchase(), productId: p.id, quantity: 50, totalCostCentavos: 230000 })
    await receiveStock({ ...purchase(), productId: p.id, quantity: 50, totalCostCentavos: 250000 })
    const context = await localContext(ids.rice, ids.riceLocation)
    expect((await stockPosition(context, p)).valueCentavos).toBe(480000)
    await createSale({ ...sale(), productId: p.id, quantity: 5 })
    expect((await db.saleLines.where('productId').equals(p.id).first())?.costCentavos).toBe(24000)
    await createSale({ ...sale(), productId: p.id, quantity: 1.001 })
    await createSale({ ...sale(), productId: p.id, quantity: 93.999 })
    expect(await stockPosition(context, p)).toMatchObject({ quantityMilliunits: 0, valueCentavos: 0, basis: 'ledger' })
    expect((await db.saleLines.where('productId').equals(p.id).toArray()).reduce((s,l) => s+l.costCentavos, 0)).toBe(480000)
  })

  it('requires explained owner adjustments and preserves ledger-only quantities', async () => {
    const input = { ...scope, commandId: crypto.randomUUID(), productId: ids.sinandomeng, quantityDelta: -.3, note: 'Witnessed reconciliation' }
    await adjustStock(input); await adjustStock(input)
    expect((await getInventory(ids.rice)).find(r => r.product.id === ids.sinandomeng)?.onHand).toBe(99.7)
    expect(await db.paymentEntries.count()).toBe(0)
    await expect(adjustStock({ ...input, commandId: crypto.randomUUID(), note: '' })).rejects.toThrow('reason')
    await expect(adjustStock({ ...input, commandId: crypto.randomUUID(), quantityDelta: -100 })).rejects.toThrow('Insufficient')
    await db.stockValuations.update(`${ids.riceLocation}:${ids.sinandomeng}`, { quantityMilliunits: 999 })
    await expect(createSale(sale())).rejects.toThrow('does not match')
  })

  it('uses Philippine report dates and discloses unknown service cost', async () => {
    expect(philippineDay(new Date('2026-09-15T16:00:00Z'))).toBe('2026-09-16')
    await db.products.update(ids.purified, { costKnown: false })
    await createSale({ businessId: ids.water, productId: ids.purified, quantity: 1, paymentAccountId: ids.gcash })
    await receiveStock(purchase()); await recordExpense(expense())
    const report = await getDashboard('all')
    expect(report.grossProfitCentavos).toBeNull()
    expect(report.salesCentavos).toBe(3000)
    expect(report.purchaseCentavos).toBe(490000)
    expect(report.expenseCentavos).toBe(15000)
    expect((await getDashboard('all', 'all', '2000-01-01')).saleCount).toBe(0)
  })
})

describe('explicit empty local setup', () => {
  it('creates no sample stock, is retry safe, and supports separate businesses and locations', async () => {
    await db.delete(); await db.open()
    const input = { commandId: crypto.randomUUID(), workspaceName: 'Family stores', ownerName: 'Local owner', businessName: 'Water store', businessType: 'water' as const, locationName: 'Store A' }
    const result = await setupLocalWorkspace(input)
    expect(await setupLocalWorkspace(input)).toEqual(result)
    expect(await db.products.count()).toBe(0); expect(await db.stockMovements.count()).toBe(0)
    expect((await db.workspaces.toArray())[0].mode).toBe('local')
    const rice = await addBusiness({ ...result, commandId: crypto.randomUUID(), name: 'Bigasan', type: 'rice', locationName: 'Store B' })
    expect(rice.type).toBe('rice'); expect(await db.businesses.count()).toBe(2)
    expect(await db.paymentAccounts.count()).toBe(2)
    await expect(setupLocalWorkspace({ ...input, commandId: crypto.randomUUID() })).rejects.toThrow('empty database')
  })
})
