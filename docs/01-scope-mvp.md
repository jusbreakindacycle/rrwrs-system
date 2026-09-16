# MVP Scope

This is approved **target scope**, not a list of completed features. `HANDOFF.md`
and acceptance evidence state current implementation status.

## In scope
- Multi-business and multi-location hierarchy
- Owner and store-operator roles
- Offline-first PWA on Android and desktop browsers
- Sales and sales lines
- Cash, GCash, Maya, bank and future configurable payment accounts
- Split-payment-ready transaction model
- Opening/closing cash sessions and variance
- Purchases and COD supplier payments
- Expenses
- Owner abono / reimbursement
- Owner contribution and withdrawal
- Internal account transfers
- Append-only stock ledger and stock counts
- Approval/correction request foundation
- Audit trail foundation
- Water: refill products, new gallon sales, container ownership/deposit model foundation, dispenser-rental domain, delivery status domain, consumables, maintenance/compliance domain
- Rice: kg base unit, sack receiving, scoop sales, 5 kg and 10 kg sale units, weighted-average-cost foundation, shrinkage/spillage reasons
- Permit/compliance records foundation
- Accountant/report export boundary
- Offline outbox and cloud sync adapter boundary

## Explicitly not in MVP
- Customer utang/receivables
- Supplier credit/payables
- Payroll
- HR system
- E-commerce/customer ordering portal
- AI forecasting
- Delivery route optimization
- IoT treatment-machine integration
- Detailed water-production accounting by every liter
- Official BIR POS/e-invoicing/computerized books
- Automated tax filing
- Laundry and coffee workflows

## Milestone gates

0. Foundation: docs, conventions, PWA, IndexedDB migrations, safe demo and harness.
1. Core local operations: catalogs, accounts, sales, stock, purchases, expenses,
   abono, cash reconciliation and dashboard.
2. Identity and secure sync: membership/RLS, ingestion, pull/cursor, retry; requires
   a witnessed real two-device test before completion.
3. Controlled corrections: request/reason/owner decision/reversal and stock counts.
4. Rice: sack/kg receipt, weighted average, scoop sales, physical 5/10 kg repacking
   and explained losses/variance.
5. Water: services, container/asset lifecycles, delivery, maintenance/compliance.
6. Financial completion: transfers, contributions/draws/reimbursements, split-payment
   UX, payment reconciliation and accountant exports.
7. Resilience: validated backup/restore, recovery and migration failure drills.
8. Production readiness: realistic independent store days and remote owner review.
