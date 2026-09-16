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

export interface Workspace {
  id: string
  name: string
  mode: 'demo' | 'production'
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
}

export interface PaymentAccount {
  id: string
  workspaceId: string
  businessId: string | 'shared'
  name: string
  kind: PaymentKind
  active: boolean
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
