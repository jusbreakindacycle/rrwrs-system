import { db } from '../db/database'
import { assertCentavos, assertQuantity, proportionalCentavos } from '../domain/money'
import type { Sale, SaleLine, StockMovement } from '../domain/types'
import { executeCommand, type CommandInput } from './commands'
import { postPayment } from './payments'
import { postStock, scopedProduct, stockPosition } from './stock'

export interface SaleItemInput { productId: string; quantity: number; expectedVersion?: number; expectedPriceCentavos?: number }
export type SaleInput = CommandInput & {
  productId?: string; quantity?: number; paymentAccountId?: string
  lines?: SaleItemInput[]
  payments?: { accountId: string; amountCentavos: number }[]
}

export function createSale(input: SaleInput) {
  return executeCommand('sale_bundle', input, async (context, id, now) => {
    const items = input.lines ?? [{ productId: input.productId ?? '', quantity: input.quantity ?? NaN }]
    if (!items.length || items.length > 100) throw new Error('A sale needs 1–100 items.')
    const lines: SaleLine[] = []
    const stockMovements: StockMovement[] = []
    for (const item of items) {
      const product = await scopedProduct(context, item.productId)
      assertQuantity(item.quantity, product.baseUnit !== 'kg')
      if ((product.domainKind === 'rice_grain' || product.baseUnit === 'kg' && product.domainKind === undefined) && item.quantity < 1) throw new Error('Rice sales start at 1 kg.')
      if (item.expectedVersion !== undefined && item.expectedVersion !== (product.version ?? 1) || item.expectedPriceCentavos !== undefined && item.expectedPriceCentavos !== product.priceCentavos) throw new Error('The price or product changed. Review the current catalog before finalizing.')
      const quantityMilliunits = Math.round(item.quantity * 1000)
      const lineTotalCentavos = proportionalCentavos(product.priceCentavos, quantityMilliunits, 1000)
      assertCentavos(lineTotalCentavos)
      let costCentavos = proportionalCentavos(product.estimatedCostCentavos, quantityMilliunits, 1000)
      if (product.inventoryTracked) {
        const position = await stockPosition(context, product)
        if (position.quantityMilliunits < Math.round(item.quantity * 1000)) throw new Error(`Insufficient stock for ${product.name}.`)
        costCentavos = proportionalCentavos(position.valueCentavos, quantityMilliunits, position.quantityMilliunits)
        stockMovements.push(await postStock(context, product, -item.quantity, -costCentavos, id, 'sale', now))
      }
      assertCentavos(costCentavos, true)
      lines.push({ id: crypto.randomUUID(), saleId: id, productId: product.id, productName: product.name, quantity: item.quantity, baseQuantity: item.quantity, unitLabel: product.unitLabel, unitPriceCentavos: product.priceCentavos, productVersion: product.version ?? 1, costCentavos, costKnown: product.inventoryTracked || product.costKnown !== false, lineTotalCentavos })
    }
    const totalCentavos = lines.reduce((sum, line) => sum + line.lineTotalCentavos, 0)
    assertCentavos(totalCentavos)
    const allocations = input.payments ?? [{ accountId: input.paymentAccountId ?? '', amountCentavos: totalCentavos }]
    if (!allocations.length || allocations.length > 10) throw new Error('Choose 1–10 payment allocations.')
    allocations.forEach(p => assertCentavos(p.amountCentavos))
    if (allocations.reduce((sum, p) => sum + p.amountCentavos, 0) !== totalCentavos) throw new Error('Payments must equal the sale total. Customer credit is not supported.')
    const sale: Sale = { ...context, id, createdAt: now, totalCentavos, status: 'finalized', syncStatus: 'queued' }
    await db.sales.add(sale)
    await db.saleLines.bulkAdd(lines)
    const payments = []
    for (const p of allocations) payments.push(await postPayment(context, p.accountId, p.amountCentavos, 'in', 'sale', id, now))
    return { result: sale, payload: { sale, lines, payments, stockMovements } }
  })
}
