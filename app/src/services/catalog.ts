import { db } from '../db/database'
import { assertCentavos, assertId, assertQuantity, requiredText } from '../domain/money'
import type { PaymentAccount, Product, Supplier } from '../domain/types'
import { executeCommand, type CommandInput } from './commands'
import { readableLocations, requireOwner, type LocalContext } from './local-context'

async function validateLocations(context: LocalContext, ids: string[], shared = false) {
  if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) throw new Error('Select at least one distinct location.')
  const locations = await readableLocations()
  for (const id of ids) {
    assertId(id)
    if (!locations.some(l => l.id === id && l.active && l.workspaceId === context.workspaceId && (shared || l.businessId === context.businessId))) throw new Error('Location availability is outside this profile’s scope.')
  }
}

function checkVersion(existing: { version?: number }, expected?: number) {
  if (expected !== (existing.version ?? 1)) throw new Error('This record changed in another tab. Reload it before saving.')
}

export type ProductInput = CommandInput & {
  id?: string; expectedVersion?: number; name: string; sku: string
  domainKind: NonNullable<Product['domainKind']>; baseUnit: Product['baseUnit']
  priceCentavos: number; estimatedCostCentavos: number; costKnown: boolean
  lowStockThreshold: number; locationIds: string[]; active: boolean
  metadata: Record<string, string | number | boolean>
}

export function saveProduct(input: ProductInput) {
  return executeCommand('product_revision', input, async (context, commandId, now) => {
    requireOwner(context)
    const name = requiredText(input.name, 'Product name')
    const sku = requiredText(input.sku, 'SKU', 60)
    assertCentavos(input.priceCentavos)
    assertCentavos(input.estimatedCostCentavos, true)
    if (typeof input.active !== 'boolean' || typeof input.costKnown !== 'boolean') throw new Error('Invalid product state.')
    if (input.lowStockThreshold !== 0) assertQuantity(input.lowStockThreshold, input.baseUnit !== 'kg')
    const business = await db.businesses.get(context.businessId)
    if (!['rice_grain', 'water_refill', 'water_container', 'service', 'stock_item'].includes(input.domainKind) || !['kg', 'unit', 'service'].includes(input.baseUnit)) throw new Error('Invalid product or unit type.')
    if (input.domainKind === 'rice_grain' && (business?.type !== 'rice' || input.baseUnit !== 'kg') || input.domainKind === 'water_refill' && (business?.type !== 'water' || input.baseUnit !== 'service') || input.domainKind === 'water_container' && (business?.type !== 'water' || input.baseUnit !== 'unit') || input.domainKind === 'service' && input.baseUnit !== 'service' || input.domainKind === 'stock_item' && input.baseUnit === 'service') throw new Error('The product type and unit do not match this business workflow.')
    await validateLocations(context, input.locationIds)
    if (!input.metadata || typeof input.metadata !== 'object' || Array.isArray(input.metadata) || JSON.stringify(input.metadata).length > 2000 || Object.values(input.metadata).some(v => !['string', 'number', 'boolean'].includes(typeof v))) throw new Error('Metadata must contain simple named values, up to 2,000 characters.')
    const before = input.id ? await db.products.get(input.id) : undefined
    if (input.id && (!before || before.workspaceId !== context.workspaceId || before.businessId !== context.businessId)) throw new Error('Product not found in this business.')
    if (before) {
      checkVersion(before, input.expectedVersion)
      if (before.baseUnit !== input.baseUnit || before.inventoryTracked !== (input.baseUnit !== 'service') || before.domainKind && before.domainKind !== input.domainKind) throw new Error('Create a new product to change its unit or inventory behavior. Historical identity is protected.')
    }
    const id = before?.id ?? commandId
    if (await db.products.where('businessId').equals(context.businessId).filter(p => p.id !== id && p.sku.toLowerCase() === sku.toLowerCase()).count()) throw new Error('This SKU already exists in the business.')
    const product: Product = { id, workspaceId: context.workspaceId, businessId: context.businessId, name, sku, category: input.domainKind.replaceAll('_', ' '), domainKind: input.domainKind, baseUnit: input.baseUnit, unitLabel: input.baseUnit === 'service' ? 'service' : input.baseUnit, inventoryTracked: input.baseUnit !== 'service', priceCentavos: input.priceCentavos, estimatedCostCentavos: before?.inventoryTracked ? before.estimatedCostCentavos : input.estimatedCostCentavos, costKnown: input.costKnown, lowStockThreshold: input.lowStockThreshold, active: input.active, locationIds: [...input.locationIds], metadata: { ...input.metadata }, version: (before?.version ?? (before ? 1 : 0)) + 1 }
    await db.products.put(product)
    await db.productRevisions.add({ id: commandId, productId: id, version: product.version!, snapshot: product, actorId: context.actorId, effectiveAt: now })
    return { result: product, payload: { before, product }, entityId: id, operation: before ? 'revise' : 'create' }
  })
}

export function savePaymentAccount(input: CommandInput & { id?: string; expectedVersion?: number; name: string; kind: PaymentAccount['kind']; shared: boolean; locationIds: string[]; active: boolean }) {
  return executeCommand('payment_account', input, async (context, commandId) => {
    requireOwner(context)
    const name = requiredText(input.name, 'Account name')
    if (!['cash', 'ewallet', 'bank'].includes(input.kind) || typeof input.active !== 'boolean' || typeof input.shared !== 'boolean') throw new Error('Invalid account configuration.')
    if (input.kind === 'cash' && (input.shared || input.locationIds.length !== 1)) throw new Error('A physical cash drawer belongs to exactly one business and location.')
    await validateLocations(context, input.locationIds, input.shared)
    const before = input.id ? await db.paymentAccounts.get(input.id) : undefined
    if (input.id && (!before || before.workspaceId !== context.workspaceId || before.businessId !== context.businessId && before.businessId !== 'shared')) throw new Error('Account not found in this scope.')
    if (before) {
      checkVersion(before, input.expectedVersion)
      if (before.kind !== input.kind || before.businessId !== (input.shared ? 'shared' : context.businessId) || before.kind === 'cash' && before.locationIds && before.locationIds[0] !== input.locationIds[0]) throw new Error('Account type and ownership cannot be changed. Create a new account.')
      if (!input.active && await db.cashSessions.where('accountId').equals(before.id).filter(s => s.status === 'open').count()) throw new Error('Close the cash session before deactivating its drawer.')
    }
    const account: PaymentAccount = { id: before?.id ?? commandId, workspaceId: context.workspaceId, businessId: input.shared ? 'shared' : context.businessId, name, kind: input.kind, active: input.active, locationIds: [...input.locationIds], version: (before?.version ?? (before ? 1 : 0)) + 1 }
    await db.paymentAccounts.put(account)
    return { result: account, payload: { before, account }, entityId: account.id, operation: before ? 'revise' : 'create' }
  })
}

export function saveSupplier(input: CommandInput & { id?: string; expectedVersion?: number; name: string; contact: string; active: boolean }) {
  return executeCommand('supplier', input, async (context, commandId) => {
    requireOwner(context)
    const name = requiredText(input.name, 'Supplier name')
    if (input.contact.length > 200 || typeof input.active !== 'boolean') throw new Error('Invalid supplier details.')
    const before = input.id ? await db.suppliers.get(input.id) : undefined
    if (input.id && (!before || before.workspaceId !== context.workspaceId || before.businessId !== context.businessId)) throw new Error('Supplier not found in this business.')
    if (before) checkVersion(before, input.expectedVersion)
    const supplier: Supplier = { id: before?.id ?? commandId, workspaceId: context.workspaceId, businessId: context.businessId, name, contact: input.contact.trim(), active: input.active, version: (before?.version ?? 0) + 1 }
    await db.suppliers.put(supplier)
    return { result: supplier, payload: { before, supplier }, entityId: supplier.id, operation: before ? 'revise' : 'create' }
  })
}
