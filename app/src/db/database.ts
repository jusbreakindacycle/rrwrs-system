import Dexie, { type Table } from 'dexie'
import { databaseName } from '../config'
import type { Workspace, Location, WorkspaceMember, LocationAccess, AuditEvent, SyncCheckpoint, AppliedEvent } from '../domain/types'
import type { Supplier, Purchase, PurchaseLine, OwnerPayable, StockValuation, CommandReceipt, LocalDraft, ProductRevision } from '../domain/types'
import type {
  ActionItem,
  Business,
  CashSession,
  Expense,
  OutboxEvent,
  PaymentAccount,
  PaymentEntry,
  Product,
  Sale,
  SaleLine,
  StockMovement
} from '../domain/types'

export class BusinessDatabase extends Dexie {
  suppliers!: Table<Supplier, string>
  purchases!: Table<Purchase, string>
  purchaseLines!: Table<PurchaseLine, string>
  ownerPayables!: Table<OwnerPayable, string>
  stockValuations!: Table<StockValuation, string>
  commands!: Table<CommandReceipt, string>
  drafts!: Table<LocalDraft, string>
  productRevisions!: Table<ProductRevision, string>
  workspaces!: Table<Workspace, string>
  locations!: Table<Location, string>
  members!: Table<WorkspaceMember, string>
  locationAccess!: Table<LocationAccess, string>
  auditEvents!: Table<AuditEvent, string>
  syncCheckpoints!: Table<SyncCheckpoint, string>
  appliedEvents!: Table<AppliedEvent, string>
  businesses!: Table<Business, string>
  products!: Table<Product, string>
  paymentAccounts!: Table<PaymentAccount, string>
  sales!: Table<Sale, string>
  saleLines!: Table<SaleLine, string>
  paymentEntries!: Table<PaymentEntry, string>
  stockMovements!: Table<StockMovement, string>
  expenses!: Table<Expense, string>
  cashSessions!: Table<CashSession, string>
  actionItems!: Table<ActionItem, string>
  outbox!: Table<OutboxEvent, string>
  settings!: Table<{ key: string; value: unknown }, string>

  constructor(name = databaseName) {
    super(name)
    this.version(1).stores(legacySchema)
    this.version(2).stores({
      workspaces: 'id, mode',
      businesses: 'id, workspaceId, type',
      locations: 'id, workspaceId, businessId, [workspaceId+businessId]',
      members: 'id, [workspaceId+userId]',
      locationAccess: 'id, memberId, [memberId+locationId]',
      stockMovements: 'id, businessId, productId, [locationId+productId], reason, createdAt, referenceId',
      auditEvents: 'id, &eventId, entityId, locationId, occurredAt',
      syncCheckpoints: 'scopeKey',
      appliedEvents: 'id, appliedAt'
    }).upgrade(async tx => {
      // Preserve v1 rows and pending payloads verbatim. They have no trustworthy
      // authorization/location provenance; M2 must provide a reviewed importer.
      await tx.table('settings').put({ key: 'legacyV1Preserved', value: true })
    })
    this.version(3).stores({
      suppliers: 'id, workspaceId, businessId',
      purchases: 'id, businessId, locationId, supplierId, createdAt',
      purchaseLines: 'id, purchaseId, productId',
      ownerPayables: 'id, &expenseId, ownerId, businessId, locationId',
      stockValuations: 'id, [locationId+productId]',
      commands: 'id, kind, locationId, committedAt',
      drafts: 'key',
      productRevisions: 'id, productId, [productId+version]',
      paymentEntries: 'id, saleId, businessId, accountId, cashSessionId, createdAt, kind'
    }).upgrade(async tx => {
      const locations = await tx.table<Location>('locations').toArray()
      const businesses = await tx.table<Business>('businesses').toArray()
      const products = await tx.table<Product>('products').toArray()
      for (const product of products) {
        const business = businesses.find(b => b.id === product.businessId && b.workspaceId === product.workspaceId)
        if (!business) continue // Unscoped v1 records remain preserved and unavailable.
        const scopeLocations = locations.filter(l => l.businessId === business.id && l.workspaceId === business.workspaceId)
        const domainKind = business.type === 'rice' && product.baseUnit === 'kg' ? 'rice_grain'
          : business.type === 'water' && product.baseUnit === 'service' ? 'water_refill'
          : business.type === 'water' && product.category === 'Container' ? 'water_container'
          : product.baseUnit === 'service' ? 'service' : 'stock_item'
        await tx.table('products').update(product.id, { locationIds: scopeLocations.map(l => l.id), domainKind, version: 1, costKnown: true, metadata: {} })
      }
      const accounts = await tx.table<PaymentAccount>('paymentAccounts').toArray()
      for (const account of accounts) {
        if (!account.workspaceId) continue
        await tx.table('paymentAccounts').update(account.id, {
          locationIds: locations.filter(l => l.workspaceId === account.workspaceId && (account.businessId === 'shared' || l.businessId === account.businessId)).map(l => l.id), version: 1
        })
      }
      // Freeze the old timestamp-based opening carry; don't rewrite old payments
      // or pending payloads, and never apply future entries to a closed drawer.
      const sessions = await tx.table<CashSession>('cashSessions').toArray()
      const payments = await tx.table<PaymentEntry>('paymentEntries').toArray()
      for (const session of sessions.filter(s => s.status === 'open' && s.locationId)) {
        const legacyNetCentavos = payments.filter(p => p.workspaceId === session.workspaceId && p.businessId === session.businessId && p.locationId === session.locationId && p.accountId === session.accountId && p.createdAt >= session.openedAt)
          .reduce((sum, p) => sum + (p.direction === 'in' ? p.amountCentavos : -p.amountCentavos), 0)
        await tx.table('cashSessions').update(session.id, { legacyNetCentavos, cashModelVersion: 3 })
      }
      // Recover documented M0 owner-funding liability without changing its expense
      // or creating a second expense. Scoped demo owner is the only safe fallback.
      const members = await tx.table<WorkspaceMember>('members').toArray()
      for (const expense of await tx.table<Expense>('expenses').toArray()) {
        const owners = members.filter(m => m.workspaceId === expense.workspaceId && m.role === 'owner')
        if (!expense.fundedByOwner || !expense.locationId || owners.length !== 1) continue
        await tx.table('ownerPayables').add({ ...expense, id: expense.id, expenseId: expense.id, ownerId: owners[0].userId, kind: 'expense_funding' })
      }
    })
  }
}

// Kept unchanged so existing v1 databases upgrade without destructive reset.
export const legacySchema = {
      businesses: 'id, type, active',
      products: 'id, businessId, sku, category, active',
      paymentAccounts: 'id, businessId, kind, active',
      sales: 'id, businessId, createdAt, status, syncStatus',
      saleLines: 'id, saleId, productId',
      paymentEntries: 'id, saleId, businessId, accountId, createdAt, kind',
      stockMovements: 'id, businessId, productId, reason, createdAt, referenceId',
      expenses: 'id, businessId, category, createdAt',
      cashSessions: 'id, businessId, accountId, status, openedAt',
      actionItems: 'id, businessId, severity, resolved, dueAt',
      outbox: 'id, businessId, syncState, occurredAt, entityType, entityId',
      settings: 'key'
    }

export const db = new BusinessDatabase()
