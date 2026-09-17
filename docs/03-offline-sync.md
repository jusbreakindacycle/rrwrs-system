# Offline and Sync Contract

This describes the target protocol. **M1 has no network transport.** `syncPending`
returns disabled without sending, acknowledging or dropping an event. The pinned
Supabase SDK is reserved for M2 and is not imported by the browser runtime.

## Local-first rule
The local database commits the business operation first. Network availability must not be part of the sale transaction's success condition.

## Local storage
IndexedDB through Dexie. The app requests persistent browser storage when supported.

## Outbox pattern
Every finalized local business mutation emits an immutable outbox event with:
- globally unique event id
- workspace/business/location/device ids
- actor id
- entity type/id
- operation
- entity version when applicable
- payload
- client occurred-at timestamp

## Server sequence
The sync service assigns an increasing server sequence. A device pushes unsynced events, then pulls events after its last applied server sequence.

## Idempotency
The cloud rejects duplicate event ids. A client stores applied remote event ids so replay is safe.

## Conflict strategy
1. Sales/payments/stock movements: append-only; no field-level last-write-wins.
2. Finalized corrections: explicit reversal/adjustment events.
3. Master data such as product display name: optimistic version check; owner resolves genuine conflict.
4. Price changes: effective-dated price record, not silent rewrite of historical sale price.
5. Stock: derived from movement ledger, so two offline sales merge as two movements instead of fighting over a `current_stock` field.

## Connectivity states
- Offline: local operations continue; outbox grows.
- Online + healthy: push then pull.
- Online + sync error: operations still continue locally; show actionable sync warning.
- Conflict requiring owner: quarantine only the conflicting master-data change; do not freeze unrelated sales.

## Background sync warning
Browser background sync is an enhancement, not a correctness dependency. The app also syncs on launch, reconnect, focus, and an explicit Sync button.

The preceding triggers are the M2 target. M1 shows a live local queue count and
failed count without an actionable Sync button or any implication of cloud backup.

## Implemented atomic boundary

`localWrite` starts one Dexie read/write transaction over local tables. Scope,
product/account validation, stock checks, business records, audit and outbox are
all inside it. A final audit-write failure aborts the entire operation. IndexedDB
serializes overlapping transactions on one origin/database, including other tabs.
This does not coordinate independent offline devices.

Reporting queues its readonly queries synchronously in one Dexie transaction,
then computes the scoped report from the completed snapshot. Do not await nested
report loops inside an otherwise idle readonly transaction: real-browser testing
caught an early-commit error that fake IndexedDB did not reproduce. See
[Dexie transaction lifetime guidance](https://dexie.org/docs/DexieErrors/Dexie.PrematureCommitError).

All M1 commands use stable UUIDs and a canonical payload fingerprint. `commands`
stores the original result inside the same transaction as business records,
audit and outbox. Identical retries return that result; changed data under the
same ID fails. This covers sales, receipts, expenses, stock adjustment, catalog,
accounts, suppliers, cash open/close and store setup. Old service callers may omit
the command UUID to express a new operation; every current UI supplies one.

`drafts` persists each form's UUID/input in IndexedDB. Submit waits for the draft
write, then commits the command. Successful forms lock until explicit New; on
reload the saved command receipt locks them even if confirmation was lost. Two
tabs using the same persisted draft retry the same intent. Independent new
commands remain distinct real operations; similarity alone never deduplicates
two legitimate sales. Drafts are shared per location/form on this browser profile;
use one operator tab for independent customers. No primary business localStorage.

New outbox bundles use schemaVersion 2; existing v1 payloads remain verbatim.
Events and command receipts have distinct stable IDs. No local setup/member
claim authorizes an upload. M2 must explicitly enroll/import trusted local scope
and validate event versions and every claimed actor/reference server-side.

## IndexedDB migrations and recovery

- v1 remains declared; v2 adds hierarchy/audit/checkpoint/applied-event stores and
  a location+product movement index. No business history is cleared or rewritten.
- v3 adds purchase/supplier/payable/valuation/command/draft/revision tables and
  the payment cash-session index. Existing scoped products/accounts gain explicit
  availability and version metadata. Open v2 cash sessions freeze prior scoped
  timestamp-attributed payments as `legacyNetCentavos`; new payments use session
  IDs. Closed cash snapshots, old sales/payments/expenses/outbox stay unchanged.
  An old abono gets a separate payable only if exactly one owner is known; ambiguous
  owner funding stays visible for review. Migration runs atomically and does not
  emit fabricated new events for already-existing operations.
- Upgraded legacy data is marked in settings and remains in the default database.
  Old unscoped payloads are not silently enriched, replayed or uploaded. A reviewed
  import/mapping with owner verification is required before M2 can accept them.
- Demo and standard builds use different database names; sample seed checks and
  writes are one transaction. Non-empty unknown databases are never reseeded.
- Future migrations must run with pending-event fixtures, retain all old schema
  versions and abort on invalid data. Unknown event versions are quarantined with
  a visible reason, never acknowledged as applied. This quarantine UI is pending.
- App updates wait for all open tabs to close; no automatic in-form reload.
  First load requires connectivity, secure context, and a completed shell cache.
- Boot failures show a recoverable error; storage persistence denial does not
  prevent operations. Browser eviction, clearing, OS power loss and hardware
  failure require independent backup. M7 will add verified backup/restore.

## Required M2 protocol details

- Authenticate every push/pull and authorize workspace → member → business →
  location server-side. Reject sample identities and revoked scope at ingestion.
- Insert immutable events. Duplicate ID + identical content returns the existing
  acknowledgement; duplicate ID + different content is an error, never an upsert.
- Server acknowledgement loss leaves the local event queued for the same-ID retry.
  Backoff with jitter, attempts, last error and next retry must remain visible.
- Pull scoped server sequence pages; validate versions/authorization; atomically
  apply business projections, applied-event ID and checkpoint. A crash cannot
  advance the cursor without applied data. Replayed own events must not duplicate
  existing transactions. Decimal-string checkpoints avoid bigint rounding.
- Server sequence must be **commit-ordered**, or use an equivalent cursor that
  cannot skip a lower sequence committed after a higher one was pulled. A bare
  identity column/max(sequence) is insufficient; test this race in M2.
- Two-device stock can become negative after merge. Preserve both sales, flag the
  discrepancy, require owner reconciliation; never discard a paid sale to fix stock.
- Persist sale price/cost snapshots and price-version provenance. Stale-price sale
  acceptance/owner exception policy must be explicit; never recalculate history.
- A cached access grant cannot learn revocation while offline. M2 must define an
  offline access lease, freeze after expiry, and quarantine rejected events without
  data loss. This cannot be solved by frontend button visibility.

Implementation references: [Dexie transactions and versioning](https://dexie.org/docs/Tutorial/Design),
[PWA update prompting](https://vite-pwa-org.netlify.app/guide/prompt-for-update.html).
