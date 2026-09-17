export type BusinessType = 'water' | 'rice'
export type Role = 'owner' | 'operator'
export type PaymentKind = 'cash' | 'ewallet' | 'bank'
export type StockReason =
  | 'opening'
  | 'purchase'
  | 'sale'
  | 'spillage'
  | 'damage'
  | 'count_shortage'
  | 'count_excess'
  | 'reversal'
  | 'adjustment'
  | 'purchase_receipt'
  | 'manual_adjustment'

export interface Workspace {
  id: string
  name: string
  mode: 'demo' | 'local' | 'production'
}

export interface Location {
  id: string
  workspaceId: string
  businessId: string
  name: string
  active: boolean
}

export interface LocationScope {
  workspaceId: string
  businessId: string
  locationId: string
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: Role
  active: boolean
  displayName?: string
}

export interface LocationAccess extends LocationScope {
  id: string
  memberId: string
}

export interface Business {
  id: string
  workspaceId: string
  name: string
  type: BusinessType
  active: boolean
}

export interface Product {
  id: string
  workspaceId: string
  businessId: string
  name: string
  category: string
  sku: string
  unitLabel: string
  baseUnit: 'kg' | 'unit' | 'service'
  priceCentavos: number
  estimatedCostCentavos: number
  inventoryTracked: boolean
  lowStockThreshold: number
  active: boolean
  locationIds?: string[]
  domainKind?: 'rice_grain' | 'water_refill' | 'water_container' | 'service' | 'stock_item'
  version?: number
  costKnown?: boolean
  metadata?: Record<string, string | number | boolean>
}

export interface PaymentAccount {
  id: string
  workspaceId: string
  businessId: string | 'shared'
  name: string
  kind: PaymentKind
  active: boolean
  locationIds?: string[]
  version?: number
}

export interface Sale extends LocationScope {
  id: string
  businessId: string
  locationName: string
  createdAt: string
  actorId: string
  totalCentavos: number
  status: 'finalized' | 'reversed'
  syncStatus: 'queued' | 'synced'
}

export interface SaleLine {
  id: string
  saleId: string
  productId: string
  productName: string
  quantity: number
  baseQuantity: number
  unitLabel: string
  unitPriceCentavos: number
  costCentavos: number
  lineTotalCentavos: number
  productVersion?: number
  costKnown?: boolean
}

export interface PaymentEntry extends LocationScope {
  id: string
  saleId?: string
  businessId: string
  accountId: string
  amountCentavos: number
  direction: 'in' | 'out'
  kind: 'sale' | 'expense' | 'purchase' | 'transfer' | 'owner' | 'cash_adjustment'
  createdAt: string
  cashSessionId?: string
  referenceId?: string
  accountName?: string
}

export interface StockMovement extends LocationScope {
  id: string
  businessId: string
  productId: string
  quantityDelta: number
  reason: StockReason
  referenceType: string
  referenceId: string
  note?: string
  createdAt: string
  valueDeltaCentavos?: number
  actorId?: string
}

export interface Expense extends LocationScope {
  id: string
  businessId: string
  category: string
  amountCentavos: number
  paidFromAccountId: string
  fundedByOwner: boolean
  note?: string
  createdAt: string
  ownerId?: string
}

export interface CashSession extends LocationScope {
  id: string
  businessId: string
  accountId: string
  openedAt: string
  openingCentavos: number
  closedAt?: string
  expectedClosingCentavos?: number
  actualClosingCentavos?: number
  varianceCentavos?: number
  status: 'open' | 'closed'
  note?: string
  cashModelVersion?: number
  legacyNetCentavos?: number
  actorId?: string
}

export interface Supplier {
  id: string
  workspaceId: string
  businessId: string
  name: string
  contact: string
  active: boolean
  version: number
}

export interface Purchase extends LocationScope {
  id: string
  supplierId?: string
  supplierName: string
  reference: string
  totalCostCentavos: number
  paidFromAccountId: string
  status: 'received'
  createdAt: string
  actorId: string
  note: string
}

export interface PurchaseLine {
  id: string
  purchaseId: string
  productId: string
  productName: string
  quantity: number
  unitLabel: string
  totalCostCentavos: number
}

export interface OwnerPayable extends LocationScope {
  id: string
  ownerId: string
  expenseId: string
  amountCentavos: number
  createdAt: string
  kind: 'expense_funding'
}

export interface StockValuation extends LocationScope {
  id: string
  productId: string
  quantityMilliunits: number
  valueCentavos: number
  basis: 'legacy_estimate' | 'ledger'
}

export interface CommandReceipt extends LocationScope {
  id: string
  kind: string
  fingerprint: string
  result: unknown
  committedAt: string
}

export interface LocalDraft {
  key: string
  commandId: string
  data: unknown
  updatedAt: string
}

export interface ProductRevision {
  id: string
  productId: string
  version: number
  snapshot: Product
  actorId: string
  effectiveAt: string
}

export interface ActionItem {
  id: string
  businessId: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  dueAt?: string
  resolved: boolean
}

export interface OutboxEvent extends LocationScope {
  id: string
  workspaceId: string
  businessId: string
  deviceId: string
  actorId: string
  entityType: string
  entityId: string
  operation: string
  payload: unknown
  occurredAt: string
  syncState: 'pending' | 'synced' | 'failed'
  serverSeq?: number
  error?: string
  schemaVersion: number
  attempts: number
  nextAttemptAt?: string
  lastAttemptAt?: string
}

export interface AuditEvent extends LocationScope {
  id: string
  eventId: string
  actorId: string
  deviceId: string
  entityType: string
  entityId: string
  operation: string
  occurredAt: string
}

export interface SyncCheckpoint {
  scopeKey: string
  // Decimal string: a Postgres bigint cursor can exceed JS's safe integer range.
  serverSequence: string
  updatedAt: string
}

export interface AppliedEvent {
  id: string
  appliedAt: string
}
