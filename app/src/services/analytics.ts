import { db } from '../db/database'

function startOfTodayISO() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function getDashboard(businessId: string | 'all') {
  const start = startOfTodayISO()
  const sales = await db.sales.where('createdAt').aboveOrEqual(start).toArray()
  const filteredSales = businessId === 'all' ? sales : sales.filter(s => s.businessId === businessId)
  const saleIds = new Set(filteredSales.map(s => s.id))
  const allLines = await db.saleLines.toArray()
  const lines = allLines.filter(l => saleIds.has(l.saleId))
  const allPayments = await db.paymentEntries.where('createdAt').aboveOrEqual(start).toArray()
  const payments = allPayments.filter(p => p.kind === 'sale' && (businessId === 'all' || p.businessId === businessId))
  const accounts = await db.paymentAccounts.toArray()

  const salesCentavos = filteredSales.reduce((s, x) => s + x.totalCentavos, 0)
  const grossProfitCentavos = lines.reduce((s, x) => s + (x.lineTotalCentavos - x.costCentavos), 0)

  const paymentMix = accounts
    .map(account => ({
      name: account.name,
      kind: account.kind,
      amountCentavos: payments.filter(p => p.accountId === account.id).reduce((s, p) => s + p.amountCentavos, 0)
    }))
    .filter(x => x.amountCentavos > 0)

  return { salesCentavos, grossProfitCentavos, paymentMix, saleCount: filteredSales.length }
}

export async function getInventory(businessId: string | 'all') {
  const products = await db.products.filter(p => p.inventoryTracked && (businessId === 'all' || p.businessId === businessId)).toArray()
  const movements = await db.stockMovements.toArray()
  return products.map(product => ({
    product,
    onHand: movements.filter(m => m.productId === product.id).reduce((s, m) => s + m.quantityDelta, 0)
  }))
}
