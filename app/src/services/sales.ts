import { db } from '../db/database'
import type { PaymentEntry, Sale, SaleLine, StockMovement } from '../domain/types'
import { assertCentavos, assertQuantity } from '../domain/money'
import { localContext, localWrite, queueEvent, validateAccount } from './local-context'

export async function createSale(input: {
  businessId: string
  productId: string
  quantity: number
  paymentAccountId: string
  locationId?: string
  commandId?: string
}) {
  return localWrite(async () => {
  const context = await localContext(input.businessId, input.locationId)
  if (input.commandId) {
    const existing = await db.sales.get(input.commandId)
    if (existing) {
      const line = await db.saleLines.where('saleId').equals(existing.id).first()
      const payment = await db.paymentEntries.where('saleId').equals(existing.id).first()
      if (existing.businessId !== input.businessId || existing.locationId !== context.locationId ||
        line?.productId !== input.productId || line.quantity !== input.quantity || payment?.accountId !== input.paymentAccountId) {
        throw new Error('This command ID already belongs to a different sale.')
      }
      return existing
    }
  }
  const product = await db.products.get(input.productId)
  const business = await db.businesses.get(input.businessId)
  if (!product?.active || !business || product.businessId !== business.id || product.workspaceId !== context.workspaceId) throw new Error('Product or business not found')
  assertQuantity(input.quantity, product.baseUnit !== 'kg')
  if (product.baseUnit === 'kg' && input.quantity < 1) throw new Error('Rice sales start at 1 kg.')
  await validateAccount(context, input.paymentAccountId)

  const saleId = input.commandId ?? crypto.randomUUID()
  const now = new Date().toISOString()
  const total = Math.round(product.priceCentavos * input.quantity)
  const cost = Math.round(product.estimatedCostCentavos * input.quantity)
  assertCentavos(total)
  assertCentavos(cost, true)

  if (product.inventoryTracked) {
    const movements = await db.stockMovements.where('[locationId+productId]').equals([context.locationId, product.id]).toArray()
    const onHand = movements.reduce((sum, m) => sum + m.quantityDelta, 0)
    if (onHand < input.quantity) throw new Error(`Insufficient stock. On hand: ${onHand} ${product.unitLabel}`)
  }

  const sale: Sale = {
    ...context,
    id: saleId,
    businessId: business.id,
    locationName: context.locationName,
    createdAt: now,
    actorId: context.actorId,
    totalCentavos: total,
    status: 'finalized',
    syncStatus: 'queued'
  }

  const line: SaleLine = {
    id: crypto.randomUUID(),
    saleId,
    productId: product.id,
    productName: product.name,
    quantity: input.quantity,
    baseQuantity: input.quantity,
    unitLabel: product.unitLabel,
    unitPriceCentavos: product.priceCentavos,
    costCentavos: cost,
    lineTotalCentavos: total
  }

  const payment: PaymentEntry = {
    ...context,
    id: crypto.randomUUID(),
    saleId,
    businessId: business.id,
    accountId: input.paymentAccountId,
    amountCentavos: total,
    direction: 'in',
    kind: 'sale',
    createdAt: now
  }

  const stockMovement: StockMovement | undefined = product.inventoryTracked
    ? {
        ...context,
        id: crypto.randomUUID(),
        businessId: business.id,
        productId: product.id,
        quantityDelta: -input.quantity,
        reason: 'sale',
        referenceType: 'sale',
        referenceId: saleId,
        createdAt: now
      }
    : undefined

    await db.sales.add(sale)
    await db.saleLines.add(line)
    await db.paymentEntries.add(payment)
    if (stockMovement) await db.stockMovements.add(stockMovement)
    await queueEvent({
      businessId: business.id,
      locationId: context.locationId,
      entityType: 'sale_bundle',
      entityId: saleId,
      operation: 'create',
      payload: { sale, lines: [line], payments: [payment], stockMovements: stockMovement ? [stockMovement] : [] },
      occurredAt: now
    })

  return sale
  })
}
