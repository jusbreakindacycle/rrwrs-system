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

## Implemented M0 persistence vs target entities

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

M0 operation views infer location only when exactly one active location exists.
They reject ambiguity rather than silently choosing a branch. A multi-location
picker and per-location valuation/account assignment belong in M1/M4.

Still to implement: full suppliers/purchase headers/lines, price history, explicit
owner payable/money ledger, correction records, stock counts, and module entities.
Do not mistake a type/specification for a working lifecycle.

## Module invariants for later milestones

- Rice purchase: sacks × configured kg/sack → kg received. 50 kg at ₱2,300 plus
  50 kg at ₱2,500 = ₱48/kg. Store receipt value and valuation history; the current
  rounded product cost is only a demo projection, not final multi-device costing.
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
