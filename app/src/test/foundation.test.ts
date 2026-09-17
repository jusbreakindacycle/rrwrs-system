import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/database'
import { demoIds as ids, seedDemo } from '../db/seed'
import { createSale } from '../services/sales'
import { closeCashSession, openCashSession, calculateExpectedCash, receiveStock, recordExpense } from '../services/operations'
import { getDashboard, getInventory } from '../services/analytics'
import { syncPending } from '../services/sync'
import { assertCentavos, assertQuantity, toCentavos } from '../domain/money'
import { stockPosition } from '../services/stock'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await seedDemo(db, true)
})
afterAll(() => db.delete())

const riceSale = () => ({ businessId: ids.rice, productId: ids.sinandomeng, quantity: 5, paymentAccountId: ids.gcash })

describe('local foundation', () => {
  it('seeds once across concurrent initializations with separate locations and stable device identity', async () => {
    const device = await db.settings.get('deviceId')
    await Promise.all([seedDemo(db, true), seedDemo(db, true)])
    expect(await db.businesses.count()).toBe(2)
    expect(await db.locations.count()).toBe(2)
    expect(await db.stockMovements.count()).toBe(3)
    expect(await db.settings.get('deviceId')).toEqual(device)
  })

  it('commits sale, lines, payment, stock, audit and outbox locally without network', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const sale = await createSale(riceSale())
    expect(sale.totalCentavos).toBe(27500)
    expect(await db.saleLines.where('saleId').equals(sale.id).count()).toBe(1)
    expect(await db.paymentEntries.where('saleId').equals(sale.id).count()).toBe(1)
    expect((await getInventory(ids.rice)).find(x => x.product.id === ids.sinandomeng)?.onHand).toBe(95)
    expect(await db.auditEvents.count()).toBe(1)
    const event = await db.outbox.toCollection().first()
    expect(event).toMatchObject({ locationId: ids.riceLocation, workspaceId: ids.workspace, schemaVersion: 2, attempts: 0, syncState: 'pending' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rolls back all business writes if the last audit write fails', async () => {
    vi.spyOn(db.auditEvents, 'add').mockRejectedValueOnce(new Error('injected write failure'))
    await expect(createSale(riceSale())).rejects.toThrow('injected write failure')
    for (const table of [db.sales, db.saleLines, db.paymentEntries, db.outbox, db.auditEvents]) expect(await table.count()).toBe(0)
    expect(await db.stockMovements.count()).toBe(3)
  })

  it('retries the same command safely and rejects reusing its ID for a different sale', async () => {
    const input = { ...riceSale(), commandId: crypto.randomUUID() }
    const results = await Promise.all([createSale(input), createSale(input)])
    expect(results[0].id).toBe(results[1].id)
    expect(await db.sales.count()).toBe(1)
    expect(await db.outbox.count()).toBe(1)
    expect(await db.stockMovements.where('reason').equals('sale').count()).toBe(1)
    await expect(createSale({ ...input, quantity: 6 })).rejects.toThrow('different')
  })

  it('serializes competing local stock checks', async () => {
    const results = await Promise.allSettled([createSale({ ...riceSale(), quantity: 75 }), createSale({ ...riceSale(), quantity: 75 })])
    expect(results.filter(x => x.status === 'fulfilled')).toHaveLength(1)
    expect((await getInventory(ids.rice)).find(x => x.product.id === ids.sinandomeng)?.onHand).toBe(25)
  })

  it('rejects cross-business products, accounts, and locations before writing', async () => {
    await expect(createSale({ ...riceSale(), productId: ids.container })).rejects.toThrow()
    await expect(createSale({ ...riceSale(), paymentAccountId: ids.waterCash })).rejects.toThrow()
    await expect(createSale({ ...riceSale(), locationId: ids.waterLocation })).rejects.toThrow()
    expect(await db.sales.count()).toBe(0)
  })

  it('does not decrement container stock on a refill; container sales do decrement it', async () => {
    await createSale({ businessId: ids.water, productId: ids.purified, quantity: 3, paymentAccountId: ids.gcash })
    expect(await db.stockMovements.count()).toBe(3)
    await createSale({ businessId: ids.water, productId: ids.container, quantity: 1, paymentAccountId: ids.gcash })
    expect((await getInventory(ids.water))[0].onHand).toBe(15)
  })

  it('keeps payment mix within total sales and snapshots estimated costs', async () => {
    await createSale(riceSale())
    await createSale({ businessId: ids.water, productId: ids.purified, quantity: 3, paymentAccountId: ids.gcash })
    const dashboard = await getDashboard('all')
    expect(dashboard.salesCentavos).toBe(36500)
    expect(dashboard.paymentMix.reduce((sum, x) => sum + x.amountCentavos, 0)).toBe(36500)
    expect(dashboard.grossProfitCentavos).toBe(10300)
  })

  it('receives stock as purchase outflow, updates weighted average, and does not create expense', async () => {
    await openCashSession(ids.rice, ids.riceCash, 500000)
    await receiveStock({ businessId: ids.rice, productId: ids.sinandomeng, quantity: 100, totalCostCentavos: 490000, paidFromAccountId: ids.riceCash })
    const position = await stockPosition({ workspaceId: ids.workspace, businessId: ids.rice, locationId: ids.riceLocation }, (await db.products.get(ids.sinandomeng))!)
    expect(position.valueCentavos / (position.quantityMilliunits / 1000)).toBe(4800)
    expect((await getInventory(ids.rice)).find(x => x.product.id === ids.sinandomeng)?.onHand).toBe(200)
    expect(await db.expenses.count()).toBe(0)
    expect((await db.paymentEntries.toCollection().first())?.kind).toBe('purchase')
  })

  it('retains owner funding without reducing the drawer and records cash variance', async () => {
    const session = await openCashSession(ids.rice, ids.riceCash, 100000)
    await createSale({ ...riceSale(), paymentAccountId: ids.riceCash })
    await recordExpense({ businessId: ids.rice, category: 'Repair', amountCentavos: 10000, paidFromAccountId: ids.riceCash, fundedByOwner: true })
    expect(await calculateExpectedCash(session)).toBe(127500)
    await recordExpense({ businessId: ids.rice, category: 'Utilities', amountCentavos: 5000, paidFromAccountId: ids.riceCash, fundedByOwner: false })
    expect(await closeCashSession(session.id, 122000, { note: 'Counted short by five pesos' })).toEqual({ expected: 122500, variance: -500 })
    const closed = await db.cashSessions.get(session.id)
    await expect(createSale({ ...riceSale(), paymentAccountId: ids.riceCash })).rejects.toThrow('Open a cash session')
    await openCashSession(ids.rice, ids.riceCash, 122000)
    await createSale({ ...riceSale(), paymentAccountId: ids.riceCash })
    expect(await calculateExpectedCash(closed!)).toBe(122500)
    expect(await db.expenses.count()).toBe(2)
  })

  it('allows only one concurrent cash opening and one closing', async () => {
    const opened = await Promise.allSettled([openCashSession(ids.rice, ids.riceCash, 0), openCashSession(ids.rice, ids.riceCash, 0)])
    expect(opened.filter(x => x.status === 'fulfilled')).toHaveLength(1)
    const session = await db.cashSessions.toCollection().first()
    const closed = await Promise.allSettled([closeCashSession(session!.id, 0), closeCashSession(session!.id, 0)])
    expect(closed.filter(x => x.status === 'fulfilled')).toHaveLength(1)
  })

  it('disabled sync never sends, acknowledges or loses queued events', async () => {
    await createSale(riceSale())
    const original = await db.outbox.toArray()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('must not send'))
    for (let attempt = 0; attempt < 3; attempt++) expect((await syncPending()).mode).toBe('disabled')
    expect(await db.outbox.toArray()).toEqual(original)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('numeric boundaries', () => {
  it.each([NaN, Infinity, -1, 0])('rejects invalid positive quantity %s', value => expect(() => assertQuantity(value)).toThrow())
  it.each([NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid centavos %s', value => expect(() => assertCentavos(value)).toThrow())
  it('converts PHP to integer centavos', () => expect(toCentavos(1.01)).toBe(101))
})
