# Red-Team Cases

## Chosen behavior and validation ownership

| Failure | Chosen behavior / present evidence | Gate |
| --- | --- | --- |
| Internet disappears during sale | Local commit has no network dependency; browser offline test | M0 |
| Tab closes immediately after success | Reopen/reload shows committed sale, queue and stock; browser test. Power-cut durability not proven | M0 / M7 |
| Submit twice | Same sale command returns existing result; concurrent test. Other operation commands still need protection | M0 / M1 |
| Same outbox pushed twice | Immutable same-ID acknowledgement; changed payload rejected. Transport disabled today | M2 |
| Response lost after server commit | Retry same ID, retain local pending record until acknowledgement | M2 |
| Two offline devices sell same stock | Keep both events; show negative-stock exception for owner reconciliation | M2 / M4 |
| Stale price / owner changes price offline | Snapshot sale price/version; flag stale-policy exception, never rewrite historical totals | M1 / M2 |
| Cash sale reversed later | Owner-reviewed linked reversal; preserve closed session variance and attribute later refund to its own session | M3 / M6 |
| Receipt duplicated | Extend stable command IDs to receiving, one purchase/movement/payment on retry | M1 |
| Repacking interrupted | Atomic paired movements and batch, conservation test; no pack creation without bulk consumption | M4 |
| Wrong rice variety | Request reason/owner correction; reverse wrong movement and post correct variety, retain original | M3 / M4 |
| Correction after original synced elsewhere | Linked reversal idempotently pulls to other device; original remains | M2 / M3 |
| Operator changes protected price | Server owner role/version check; currently no production editing | M1 / M2 |
| Location access revoked offline | Cached lease policy; server rejects stale grant, quarantine event for owner without erasure | M2 |
| Migration with old pending events | M0 upgrade fixture preserves old payload verbatim; unknown versions require quarantine/import, no invented scope | M0 / M2 / M7 |
| IndexedDB cleared / storage eviction | Do not fabricate/reseed production history. Recovery requires independent backup; unavailable today | M7 |
| Corrupt backup | Validate schema, checksum, references and monetary/stock totals before any import | M7 |
| Restore onto non-empty DB | Refuse by default; isolated validated staging and explicit owner-reviewed replacement/merge | M7 |
| Late audit/outbox write fails | Abort all local writes, return failure; injected-failure unit test | M0 |
| Concurrent tabs open/close cash | Serialize and validate inside transaction; unit test. Session attribution by timestamp still requires M1 replacement | M0 / M1 |
| Future/stale device clock | Preserve event time and server receive time; business-day Asia/Manila policy and clock warning required | M1 / M2 |
| PWA update during entry | Waiting worker; no forced refresh; update lifecycle regression test remains M7 | M0 / M7 |
| Negative stock before receipt | Reject provisional cost refresh with reconciliation error; never silently erase negative quantity | M0 / M4 |

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
