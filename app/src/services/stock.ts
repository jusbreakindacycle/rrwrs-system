import { db } from '../db/database'
import { assertCentavos, assertId, assertQuantity, proportionalCentavos, requiredText } from '../domain/money'
import type { LocationScope, Product, StockMovement, StockValuation } from '../domain/types'
import { executeCommand, type CommandInput } from './commands'
import { requireOwner, type LocalContext } from './local-context'

export async function scopedProduct(scope: LocationScope, productId: string) {
  assertId(productId)
  const product = await db.products.get(productId)
  if (!product?.active || product.businessId !== scope.businessId || product.workspaceId !== scope.workspaceId ||
    (product.locationIds !== undefined && !product.locationIds.includes(scope.locationId))) throw new Error('Choose an active product available at this business and location.')
  return product
}

export async function stockPosition(scope: LocationScope, product: Product) {
  const movements = await db.stockMovements.where('[locationId+productId]').equals([scope.locationId, product.id]).toArray()
  const projection = await db.stockValuations.get(`${scope.locationId}:${product.id}`)
  return deriveStockPosition(scope, product, movements, projection)
}

export function deriveStockPosition(scope: LocationScope, product: Product, movements: StockMovement[], projection?: StockValuation) {
  let quantityMilliunits = 0
  for (const movement of movements) {
    if (movement.workspaceId !== scope.workspaceId || movement.businessId !== scope.businessId) throw new Error('Stock ledger contains an invalid scope. Owner review required.')
    assertQuantity(Math.abs(movement.quantityDelta), product.baseUnit !== 'kg')
    quantityMilliunits += Math.round(movement.quantityDelta * 1000)
    if (!Number.isSafeInteger(quantityMilliunits)) throw new Error('Stock quantity exceeds supported precision.')
  }
  const id = `${scope.locationId}:${product.id}`
  if (projection && (projection.workspaceId !== scope.workspaceId || projection.businessId !== scope.businessId || projection.locationId !== scope.locationId || projection.productId !== product.id)) throw new Error('Stock valuation scope mismatch. Owner review required.')
  if (projection && projection.quantityMilliunits !== quantityMilliunits) throw new Error('Stock valuation does not match the ledger. Owner review required.')
  const valueCentavos = projection?.valueCentavos ?? (quantityMilliunits < 0 ? -proportionalCentavos(product.estimatedCostCentavos, -quantityMilliunits, 1000) : proportionalCentavos(product.estimatedCostCentavos, quantityMilliunits, 1000))
  if (!Number.isSafeInteger(valueCentavos)) throw new Error('Stock value exceeds supported precision.')
  return { ...scope, id, productId: product.id, quantityMilliunits, valueCentavos, basis: projection?.basis ?? ('legacy_estimate' as const) }
}

export async function postStock(context: LocalContext, product: Product, quantityDelta: number, valueDeltaCentavos: number, referenceId: string, reason: StockMovement['reason'], now: string, note?: string) {
  assertQuantity(Math.abs(quantityDelta), product.baseUnit !== 'kg')
  if (!Number.isSafeInteger(valueDeltaCentavos)) throw new Error('Invalid stock value.')
  const position = await stockPosition(context, product)
  const quantityMilliunits = position.quantityMilliunits + Math.round(quantityDelta * 1000)
  const valueCentavos = position.valueCentavos + valueDeltaCentavos
  if (quantityMilliunits < 0 || valueCentavos < 0) throw new Error('Insufficient stock or inventory value.')
  if (!Number.isSafeInteger(valueCentavos) || !Number.isSafeInteger(quantityMilliunits)) throw new Error('Inventory value or quantity exceeds supported precision.')
  const movement: StockMovement = { ...context, id: crypto.randomUUID(), productId: product.id, quantityDelta, valueDeltaCentavos, reason, referenceType: reason === 'purchase_receipt' ? 'purchase' : reason, referenceId, createdAt: now, note }
  await db.stockMovements.add(movement)
  await db.stockValuations.put({ ...position, quantityMilliunits, valueCentavos, basis: position.quantityMilliunits === 0 ? 'ledger' : position.basis })
  return movement
}

export function adjustStock(input: CommandInput & { productId: string; quantityDelta: number; unitCostCentavos?: number; note: string }) {
  return executeCommand('stock_adjustment', input, async (context, id, now) => {
    requireOwner(context)
    const note = requiredText(input.note, 'Adjustment reason', 500)
    const product = await scopedProduct(context, input.productId)
    if (!product.inventoryTracked) throw new Error('Services do not have stock to adjust.')
    assertQuantity(Math.abs(input.quantityDelta), product.baseUnit !== 'kg')
    const position = await stockPosition(context, product)
    let value: number
    if (input.quantityDelta > 0) {
      assertCentavos(input.unitCostCentavos ?? NaN, true)
      value = proportionalCentavos(input.unitCostCentavos!, Math.round(input.quantityDelta * 1000), 1000)
    } else {
      if (position.quantityMilliunits <= 0) throw new Error('Insufficient stock.')
      value = -proportionalCentavos(position.valueCentavos, Math.round(-input.quantityDelta * 1000), position.quantityMilliunits)
    }
    const movement = await postStock(context, product, input.quantityDelta, value, id, 'manual_adjustment', now, note)
    return { result: movement, payload: { movement } }
  })
}
