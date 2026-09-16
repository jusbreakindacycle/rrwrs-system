# Handoff — Milestone 0 repository foundation

## Source and scope

The initial handoff and all nine numbered product documents were read before code
changes. The repository already held a React/Dexie PWA and operation prototypes,
all untracked with no Git commit history. Useful code and approved Water/Rice scope
were retained. This handoff updates the original's unverified executable claims.

Current work is **Milestone 0 only**. No cloud project, deployment, commit or push
is implied by this work. This is not ready for real business records.

## Foundation delivered

- Root npm workspace, pinned dependencies/lockfile, strict TypeScript, ESLint,
  Vitest/fake IndexedDB, Playwright and a GitHub Actions validation workflow.
- Safe environment template, ignore rules, editor/line-ending conventions and
  repository agent instructions. Existing numbered specifications retained.
- Separate workspace, business, location, member/access, audit, checkpoint and
  applied-event tables; additive IndexedDB v2 migration retaining v1 payloads.
- Explicit demo mode with isolated `RRWRS-Demo` database, repeat-safe atomic seed,
  sample UUIDs and device identity in IndexedDB. Default mode never auto-seeds.
- Demo business writes validate scope and amounts, read/check/write inside a
  serialized local transaction, and include an audit record and versioned outbox.
- Quick-sale command retry protection, local stock contention checks and startup
  errors that preserve data. Cloud transport is hard-disabled; queued/failed event
  counts are visible without a fake Sync action.
- PWA shell cache, 192/512 PNG icons, mobile touch/focus improvements, update-waiting
  notice, optional persistent storage request and explicit backup limitation.

## Preserved operational prototypes

- Water/rice catalog and business switching; separate demo locations
- Dashboard sales, estimated gross profit, payment mix and low-stock action center
- Single-line fully paid sales, stock-movement-derived quantities
- COD receipt movement/payment and provisional rounded weighted-average cost
- Expenses with owner funding flag; owner-funded expense creates no store outflow
- Opening/expected/actual cash close and saved variance

These prototypes are foundations for M1, not finished production workflows.
Purchases are currently outbox bundles without full purchase/supplier tables.
Abono is recorded on the expense and outbox; a dedicated owner-payable/settlement
ledger and reimbursement workflow are still required. Cash entries currently use
timestamps, not explicit session IDs. Operation forms other than sales still need
command-level duplicate protection. Inventory costing needs M4 valuation precision.

## Verification

Executed locally: typecheck and lint passed, 24 Vitest tests passed, both PWA builds
passed, six Playwright desktop/mobile-sized Chromium tests passed, and npm audit
reported zero vulnerabilities. Offline sale persistence and Water operation/cash
flows were exercised through the actual built UI. Desktop/mobile screenshots were
inspected. See the acceptance document for initial failures and fixes.

See `docs/05-acceptance-criteria.md` for executed results and the distinction between
M0 evidence and remaining Phase 1 gates. Do not infer two-device synchronization,
real Android installation, server authorization or backup recovery from local tests.

## Intentional gaps / production gates

- Authentication, workspace provisioning, role enforcement, membership revocation,
  business/location RLS and real push/pull/retry/checkpoints: M2. Demo identities
  are not authentication. Legacy unscoped events require a reviewed import decision.
- Products/prices/account management; complete purchases; split-payment entry;
  complete cash controls/dashboard; dedicated owner payable: M1 and M6.
- Owner-reviewed correction requests, reversals, stock counts and audit browsing: M3.
- Sack configurations, precision costing, physical 5/10 kg repacking, spillage,
  damage, shrinkage and stock-count variance: M4. Repacking must conserve rice.
- Container loans/deposits/loss/damage, dispenser rentals, deliveries, consumables,
  maintenance, testing and configurable compliance records: M5.
- Owner contribution, withdrawal, reimbursement, account transfers, reconciliation
  and accountant exports: M6. Never conflate these with sales or second expenses.
- Verified backup/restore, import validation, storage-loss recovery and migration
  recovery drills: M7. Browser persistence is not a permanent backup.
- Full normal-day Water/Bigasan simulations, separate stores, long offline periods,
  remote owner review, duplicate retries, corrections and discrepancies: M8.

## Before real money is entered

Complete the relevant acceptance gates, replace sample values with actual approved
catalog/pricing/accounts, witness opening stock, validate secure two-device sync,
and complete backup/restore drills. Keep official invoicing/books outside this
internal system. No Laundry, Coffee, customer credit or supplier credit is in scope.

## Exact next milestone

**Milestone 1 — Core Local Operations.** Finish products/services, configurable
payment accounts, quick sales, ledger-backed stock, full purchases/receiving,
expenses, owner-payable abono semantics, cash sessions/reconciliation and the owner
dashboard. Retain atomic audit/outbox commits and add behavioral coverage for every
new invariant. Do not activate cloud sync as a shortcut around local operations.
