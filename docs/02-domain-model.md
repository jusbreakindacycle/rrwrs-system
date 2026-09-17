# Domain Model

## Hierarchy
Workspace -> Business -> Location; authenticated members belong to a workspace
and receive explicit business/location access. Legal entity/owner context can be
referenced by businesses when needed; it is not equivalent to a branch or user.

A Business has type `water` or `rice` today. Future modules extend the module
contract; Laundry/Coffee do not appear in the executable catalog today.

## Shared core entities
- workspace
- business
- location
- user/role assignment
- product/service
- supplier
- sale + sale_line
- payment_account + payment_entry
- purchase + purchase_line
- expense
- money_movement
- stock_movement
- cash_session
- correction_request
- compliance_record
- audit_event
- sync_event/outbox

## Inventory invariant
`on_hand = SUM(stock_movements.quantity_delta)` scoped by location + inventory item/unit.

Never mutate `product.current_stock` directly.

## Financial-history invariant
Finalized sale/purchase/expense/payment records cannot be destructively edited by a store operator. A correction creates a linked reversing/adjusting event with actor, reason, approval status, and timestamps.

## Payment invariant
A sale total and where it was paid are separate. Payment entries must sum to the amount settled before the sale is finalized because customer credit is out of scope.

## Money taxonomy
- Revenue: sale
- Inventory acquisition: purchase
- Operating expense: expense
- Owner-funded business expense: expense + owner payable/abono movement
- Owner reimbursement: settlement of owner payable, not a second expense
- Owner contribution: equity/funding, not revenue
- Owner withdrawal: owner draw, not operating expense
- Account transfer: asset-to-asset movement, not revenue/expense

## Rice
- Base inventory unit: kg
- Purchase may be represented as `sacks * kg_per_sack`
- Sell units can map to kg (1 kg, 5 kg, 10 kg, full sack)
- Stock loss is a stock movement with a reason, not a sale
- Costing target: weighted average

## Water
- Refill service itself is a sale but not necessarily a finished-goods stock decrement
- New gallon is tracked inventory
- Customer-owned gallon does not move station container stock
- Station-owned gallon can move through loan/deposit/rental states
- Consumables and treatment parts are tracked separately from refill revenue

## Implemented persistence vs target entities

`workspaces`, `businesses`, `locations`, `members`, `locationAccess`, `products`,
`paymentAccounts`, `sales`, `saleLines`, `paymentEntries`, `stockMovements`,
`expenses`, `cashSessions`, `actionItems`, `auditEvents`, `outbox`, `settings`,
`syncCheckpoints`, `appliedEvents` are local tables. Membership/checkpoint tables
are structural foundations, not implemented remote authorization/sync.

Financial and movement rows carry workspace/business/location IDs. Products belong
to a business; stock belongs to location+product. Payment accounts belong to the
workspace and a business (or explicitly shared within the workspace). Money uses
integer centavos. UUID fixtures are demo-only; new event/transaction/device IDs
are generated once and persisted. Versioned event bundles carry immutable content;
delivery status/retry metadata can change independently.

M1 v3 adds `suppliers`, `purchases`, `purchaseLines`, `ownerPayables`,
`stockValuations`, `commands`, `drafts` and `productRevisions`. UI operations pass
an explicit location. Service callers may omit it only when exactly one active
location exists; ambiguous references are rejected.

Products carry domain kind, active state, availability locations, base unit, SKU,
current price, version and optional primitive metadata. Price revisions snapshot
the before/after product, actor and effective timestamp. Identity, unit and stock
behavior cannot change on an existing product. Old sale lines retain their price,
cost and version. Unknown service variable cost produces an incomplete-cost
message rather than an invented gross profit. No free-form sale price override.

Accounts carry type and availability. A new cash drawer belongs to one business
and location; electronic accounts may be shared across explicitly selected
workspace locations. Account kinds and ownership are immutable. Names/active
state/availability have audited revisions. An open drawer cannot be deactivated.

Cash opening records an observed float. Every subsequent cash sale, receipt and
business expense carries `cashSessionId`. Electronic payments and abono do not
enter the drawer. Close freezes expected/actual/variance and explanation; later
sessions cannot change this snapshot. Negative expected cash is visible rather
than silently balanced (owner review of opening/count/paid-from entry is needed).

Each paid receipt has a header, line, supplier name/reference snapshot, payment,
stock movement, audit and outbox bundle. Non-empty supplier reference is unique
per supplier/business in the serialized command boundary. No supplier credit.
Each owner-funded expense creates one positive `ownerPayables` entry keyed to the
expense and owner. No reimbursement endpoint exists in M1; no second expense.

Stock quantity sums integer milliunits (kg permits three decimals; containers and
services are whole). Movements remain the authority. `stockValuations` is an
atomic per-location/item quantity/value projection checked against the ledger.
Receipt value adds exact centavos; a sale consumes a proportion, rounded once to
centavos; full depletion consumes the remaining value. Average unit cost is a
display calculation, never a repeatedly rounded product stock value. New receipts
from zero have ledger cost basis. Legacy stock starts from the preserved M0
estimated cost; its projection is labeled `legacy_estimate` until exhausted.
That legacy cost baseline is frozen when editing a tracked catalog item.

Owner manual adjustment requires reason and a cost for positive additions;
negative adjustments consume proportional inventory value. It creates no money
movement. No UI/API edits finalized sales/purchases/expenses/stock/payables.
Cash open→closed and catalog revisions are deliberate audited lifecycle changes.

Still to implement: general money settlements, correction approvals/reversals,
stock counts and specialist module entities. Types alone do not establish a lifecycle.

## Module invariants for later milestones

- Rice purchase: sacks × configured kg/sack → kg received. 50 kg at ₱2,300 plus
  50 kg at ₱2,500 = ₱48/kg. Store receipt value and valuation history; the current
  legacy product cost is only a preserved estimate, not multi-device costing.
- A direct 5 kg weighed sale consumes bulk. A physical pack requires repacking:
  bulk -50 kg ↔ five 10 kg packs. Both quantity and inventory value are conserved.
- Water customer containers and refill services do not reduce new-container stock.
  Distinguish CUSTOMER_OWNED, BUSINESS_OWNED, SOLD, LOANED, ON_DEPOSIT, RETURNED,
  LOST, DAMAGED. Loan/deposit rules are configurable and require audited transitions.
- Dispensers are assets with rental/return/loss lifecycles. Deliveries use PENDING,
  PREPARING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, without route optimization.
- Compliance register: title, agency/source, business/location, reference number,
  issued date, due/expiry date, status, attachment/reference, notes, last verified
  date. Maintenance/treatment replacement records are separate from refill stock.
