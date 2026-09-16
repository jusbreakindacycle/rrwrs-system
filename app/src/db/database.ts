import Dexie, { type Table } from 'dexie'
import { databaseName } from '../config'
import type { Workspace, Location, WorkspaceMember, LocationAccess, AuditEvent, SyncCheckpoint, AppliedEvent } from '../domain/types'
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
