# Red-Team Cases

## Chosen behavior and validation ownership

| Failure | Chosen behavior / present evidence | Gate |
| --- | --- | --- |
| Internet disappears during sale | Local commit has no network dependency; browser offline test | M0 |
| Tab closes immediately after success | Reopen/reload shows committed sale, queue and stock; browser test. Power-cut durability not proven | M0 / M7 |
| Reload before cash close commits | An unsaved variance preview is not confirmation. Wait for reconciliation history; interrupted work remains a draft. PR review strengthened the browser test to check the closed record and its count/explanation before reload | M1 |
| Submit twice | Every M1 command stores its result atomically. Same UUID/payload returns it; changed payload is rejected. Durable drafts remain locked after success/reload | M1 |
| Same outbox pushed twice | Immutable same-ID acknowledgement; changed payload rejected. Transport disabled today | M2 |
| Response lost after server commit | Retry same ID, retain local pending record until acknowledgement | M2 |
| Two offline devices sell same stock | Keep both events; show negative-stock exception for owner reconciliation | M2 / M4 |
| Stale price / owner changes price offline | Current-device product version/price must match basket snapshot; stale basket is rejected for review. Independent-device stale price policy remains M2. Historical and completed-form totals retain the committed snapshot | M1 / M2 |
| Cash sale reversed later | Owner-reviewed linked reversal; preserve closed session variance and attribute later refund to its own session | M3 / M6 |
| Receipt duplicated | Stable UUID returns one purchase/line/movement/payment/audit/outbox; duplicate non-empty reference for the same supplier/business is rejected even with a new UUID | M1 |
| Repacking interrupted | Atomic paired movements and batch, conservation test; no pack creation without bulk consumption | M4 |
| Wrong rice variety | Request reason/owner correction; reverse wrong movement and post correct variety, retain original | M3 / M4 |
| Correction after original synced elsewhere | Linked reversal idempotently pulls to other device; original remains | M2 / M3 |
| Operator changes protected price | Local owner-role/version checks tested, operator rejected. This is not tamper-proof authorization. Server enforcement remains M2 | M1 / M2 |
| Location access revoked offline | Cached lease policy; server rejects stale grant, quarantine event for owner without erasure | M2 |
| Migration with old pending events | v1→v3 and v2→v3 fixtures preserve old payloads/history; v2 cash carry/payable migration is explicit. Unknown versions require future quarantine/import, no invented scope | M1 / M2 / M7 |
| IndexedDB cleared / storage eviction | Do not fabricate/reseed production history. Recovery requires independent backup; unavailable today | M7 |
| Corrupt backup | Validate schema, checksum, references and monetary/stock totals before any import | M7 |
| Restore onto non-empty DB | Refuse by default; isolated validated staging and explicit owner-reviewed replacement/merge | M7 |
| Late audit/outbox/command write fails | Abort all business, valuation, payment, payable and outbox writes. Failure injection covers sale/receipt/expense/abono/adjustment/catalog/open/close | M1 |
| Concurrent tabs open/close cash | Serialized commands, one open session per account. New payments explicitly reference the session; close freezes snapshots. Same-command retry is safe | M1 |
| Future/stale device clock | Report dates use Asia/Manila; session attribution never depends on clock ordering. Device clock is still trusted for timestamps; remote time comparison/warnings remain M2 | M1 / M2 |
| PWA update during entry | Waiting worker; no forced refresh; update lifecycle regression test remains M7 | M0 / M7 |
| Negative stock before receipt | Reject provisional cost refresh with reconciliation error; never silently erase negative quantity | M0 / M4 |
| Expense double submit | Stable command prevents a second expense/payment/payable; browser form lock plus command-level tests | M1 |
| Cash vs electronic sale | Only a payment linked to an open cash session affects expected physical cash; split API allocation test proves separation | M1 |
| Owner-funded expense without valid owner | Reject missing/empty/foreign owner ID. Valid abono adds one payable and no store payment | M1 |
| Cash shortage/overage | Actual minus expected; nonzero variance requires explanation and remains in closed session/history. No balancing payment is generated | M1 |
| Two tabs edit the same draft | They share the persisted command ID. Same payload retries safely; different payload cannot overwrite committed intent. Use one operator tab for independent customer drafts | M1 |
| Valuation projection disagrees with stock ledger | Reject mutation with review error. Quantity is never silently replaced by projection value | M1 |
| Wrong workspace/location reference | Local membership/grants, product/account availability, supplier/owner scope are checked within commit; malformed/foreign references reject atomically | M1 / M2 |
| Cost/quantity overflow or invalid amount | Safe integer centavos; finite, positive quantities; ≤3 kg decimals; proportional intermediate uses BigInt and rejects result overflow | M1 |

## M1 residual risks and deliberate limits

- This is trusted local operation, not authenticated staff access. Developer tools
  can alter local data. Local setup events must never bootstrap server privileges.
- Offline first use still needs one successful shell load/cache. IndexedDB clearing,
  eviction or device loss has no restore path until M7. Closing a browser tab after
  commit is tested; abrupt OS power loss and real Android process eviction are not.
- New commands intentionally mean new operations. A manually re-entered sale can
  be economically duplicate; do not guess from matching totals. Supplier reference
  protection helps receipts when a document reference is provided.
- Legacy catalog costs are estimates; legacy purchase headers were never stored.
  Existing purchase payments remain in outflow reporting, and old outbox bundles
  remain intact. No historical documents are fabricated. Ambiguous legacy abono
  needs review; old unscoped rows are excluded and retained for import decisions.
- Expected cash may become negative if recorded cash outflows exceed recorded
  float/inflows. It remains visible; no invented contribution or adjustment fills it.
- Queries currently read scoped local history and render unpaginated lists. Very
  large datasets, long outages, background eviction and migration-failure drills
  require M7/M8 performance/resilience work.
- Wrong product/payment/count needs M3 correction. M1 offers read-only review and
  explained owner stock movements, not an unauthorized financial-history editor.

These are decisions and gates, not claims that every test is implemented. The
original domain scenarios below remain part of later realistic store simulations.

## Offline / sync
- Two devices create different sales offline at the same location.
- Device clock is wrong by hours/days.
- Same outbox event is retried five times.
- Internet reconnects midway through push.
- Local database exists but service-worker cache was updated.
- Browser storage pressure threatens local data.

## Financial integrity
- Staff selects GCash but customer paid cash.
- Staff tries to edit yesterday's price after cash close.
- Owner transfers GCash to bank and report mistakenly treats it as new income.
- Owner pays a filter personally then gets reimbursed; system must not double-count expense.
- Cash sale is reversed after cash close.

## Rice
- Receive two sacks at different costs, then sell from mixed physical stock.
- 5 kg prepack is sold but physically prepared quantity was wrong.
- Stock count finds -8 kg variance.
- Supplier renames a variety while old stock remains.

## Water
- Customer buys a new gallon and a refill in same transaction.
- Customer-owned and station-owned containers are mixed on delivery.
- Deposit is refunded after the original transaction day.
- Monthly test due date passes while store remains offline.

## Authorization
- Store operator attempts to approve own correction.
- Former employee has a cached app session.
- A device assigned to Rice attempts to see Water data without permission.
