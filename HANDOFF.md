# Handoff — Milestone 1 core local operations

## Source, branch and boundary

The existing AGENTS, prior HANDOFF, README, numbered specifications, implementation,
tests and PWA were inspected before changes. M0 was retained. Work is on
`milestone-1/core-local-operations`. No commit, push, merge, deployment or remote
project modification is part of this task. No credentials were introduced.

M1 implements trusted local store operations. **Not production-ready:** there is
no authenticated staff access, remote owner monitoring, secure synchronization,
financial correction approval or backup/restore. Cloud transport is hard-disabled.
M1 acceptance for trusted local operations is met with the evidence below. This
does not establish the later production-readiness gates.

## Delivered implementation

- Explicit empty local workspace/owner/business/location setup in the standard
  build. Isolated demo seed remains repeat-safe and contains only practice data.
  Additional businesses/locations are owner-managed; UI selects operation scope.
- Additive IndexedDB v3: suppliers, purchase headers/lines, owner payables,
  location valuations, durable command receipts/drafts and product revisions.
  All earlier versions remain declared; pending old event payloads are retained.
- Owner catalog management: product/service kind, kg/unit/service behavior,
  SKU, price/version, active state, location availability, optional metadata.
  Units/identity cannot be rewritten; price revisions do not alter old sale lines.
- Configurable cash/e-wallet/bank accounts and suppliers. Cash drawers are assigned
  to one location; electronic accounts can have explicit shared availability.
- Quick single-item and basket sales. Price/version checks, full payment, frozen
  costs, applicable stock movements, audit/outbox and command receipt commit as
  one local transaction. Refill services leave container inventory unchanged.
- Paid receiving records a purchase/line, supplier/reference snapshot, payment and
  inventory movement atomically. Same command is retry-safe; repeated non-empty
  supplier reference in that business is rejected even with a different command.
- Ordinary expenses create a business-account outflow. Owner-funded expenses
  create exactly one payable to a valid owner and no store payment. Initial abono
  is usable; reimbursement/settlement is deliberately not implemented.
- Cash open/close requires explicit session attribution for every cash payment.
  Electronic sales and abono cannot inflate physical cash. Close freezes opening,
  expected, counted amount, variance and explanation; shortage/overage remains.
- Movement-derived stock and per-location value projection. kg permits three
  decimals; other units are whole. Receipt centavos are consumed proportionally,
  with exact integer intermediate arithmetic and one rounding at the boundary.
  Explained owner manual movements are allowed; operator adjustments are denied.
- Durable form intent in IndexedDB. Save waits for its draft write. Successful
  forms remain locked across reloads until explicit New; same-ID retry returns
  the original committed result. A changed payload cannot overwrite the intent.
- Local owner report: Philippine business date, sales, estimated gross profit or
  incomplete-cost notice, payment mix, purchase/expense outflows, owner payables,
  cash reconciliation, low stock and outbox failures. No accounting Net Profit.
  Read-only transaction, movement and audit history; no financial delete/edit UI.

## Key modules

- `app/src/db/database.ts`, `seed.ts`: v3 upgrade and isolated seed.
- `app/src/domain/{types,money}.ts`: entities, identifiers, numeric precision.
- `app/src/services/{commands,local-context,payments,stock}.ts`: atomic command,
  local scope/role, session payment and stock invariants.
- `services/{catalog,setup,sales,operations}.ts`: command workflows.
- `services/{read-model,analytics,queries}.ts`: snapshots and scoped reports.
- `app/src/hooks/local.ts`: reactive reads and durable form command lifecycle.
- `app/src/components`: setup, management, sales, Ops, inventory, dashboard/history.
- `app/src/test`, `app/e2e`: domain, migration, rollback and built offline harness.

## Final verification (local Windows run, 2026-09-16)

Baseline before changes: `npm run check` passed with 24 tests, standard/demo builds
passed, full Playwright baseline passed 6/6, and `npm audit` found 0 vulnerabilities.
A parallel baseline invocation initially encountered port 4173 in use; it was
rerun serially and passed before source work began.

- `npm run check`: passed, exit 0. TypeScript, ESLint (zero warnings), **63 tests
  in three files**, and the standard Vite/PWA build all passed on the final code.
- `npm run build:demo`: passed, exit 0. Standard and demo each generated a manifest,
  service worker and 11 precache entries.
- `npx playwright test` from `app`, after those builds: **12 passed in 5.3m**,
  exit 0. Complete suite, six scenarios each in desktop and Android-sized Chromium.
- `npm test`: the new core/migration tests and retained foundation suite also ran
  independently; **63 passed** after the report refactor.
- `npm audit`: **0 vulnerabilities**, exit 0. Dependencies were not changed.
- `git diff --check`: passed. Desktop/mobile sale, dashboard/cash and inventory
  screenshots were inspected. Tested layouts have no horizontal overflow.

Total: **75 automated cases** (63 unit/integration + 12 browser cases). Offline
standard setup/catalog/account/supplier management, receipt, sale, adjustment,
historical price display, tab-close/reopen, two-tab retry, mixed Water basket,
electronic/cash separation, abono and both cash variance signs were exercised.

Initial browser runs exposed an exact-label selector issue (fixed) and an actual
inventory-report `PrematureCommitError`. Reports now queue snapshot queries
synchronously and calculate after commit. Both formerly failing stock workflows
and the new setup-to-report workflow passed in both browser projects. Review also
fixed empty owner IDs on abono and kept completed-form totals tied to receipts.
No existing business assertion was removed to hide a failure.

See `docs/05-acceptance-criteria.md` for acceptance mapping. These are local results,
not a claimed remote CI run, physical Android install or two-device cloud test.

## Assumptions and residual risks

- A local owner profile is a trusted-device convenience, not authentication or
  tamper resistance. M2 must enroll/map local IDs and reject client role claims.
- Commands created by explicit New represent new operations. Matching values do
  not prove economic duplication. Drafts are shared per browser/location/form;
  one operator tab is advised for independently entering customers.
- v2 open cash sessions preserve a frozen legacy carry from scoped old payments.
  Closed sessions and historical sales/payments/expenses are not rewritten.
- Legacy inventory carries the frozen old cost estimate until consumed. Legacy
  purchase headers never existed; payments remain in outflow reports and original
  outbox bundles remain available. No purchase history is fabricated.
- Legacy abono becomes a payable only with a single unambiguous owner. Ambiguous
  funding and unscoped old history require review; existing records are preserved.
- Browser clearing, eviction, hardware/power failure and lost devices still need
  verified independent backup. Persistent storage permission is not a backup.
- Physical Android installation/process eviction, multi-device stock merging,
  large-history performance, clock drift and full store-day drills remain open.
  Current reports read a local snapshot and histories are unpaginated.
- Expected cash can go negative if recorded outflows exceed float/inflows. The
  discrepancy remains visible; no fake capital/transfer fixes it automatically.

## Deliberately deferred

M2: authenticated membership, server authorization/RLS, push/pull/checkpoints,
retry/backoff/quarantine, revocation policy and real two-device validation.

M3: correction requests, owner decisions, linked reversals and stock counts.
M4: sacks, physical 5/10 kg repacking, specialist losses and multi-device costing.
M5: container ownership/deposit/loan, rental, delivery, maintenance/compliance.
M6: split-payment UI (API is tested), transfers, contributions, withdrawals,
reimbursement, payment reconciliation and accountant exports.
M7: backup/restore/recovery and migration/update failure drills.
M8: realistic independent-store and remote-owner production-readiness simulations.

No customer/supplier credit, payroll, tax filing/certification, Laundry or Coffee.

## Next milestone

**Milestone 2 — Identity + Secure Sync.** Do not
enable transport before server-enforced scope/role policies and real two-device
tests pass. See `docs/05-acceptance-criteria.md` and `docs/06-red-team.md`.
