# Phase 1 Acceptance Criteria

The numbered criteria are release targets, not a claim of complete implementation.

## Milestone 0 evidence (local Windows run, 2026-09-15/16)

- `npm run check`: final aggregate passed (typecheck → lint → 24 tests → standard
  PWA build), including the final mobile CSS correction.
- `npm run typecheck`: passed with TypeScript 6.0.3.
- `npm run lint`: passed, zero ESLint warnings.
- `npm test`: 24 tests passed in two files. Includes v1→v2 preservation, no automatic
  demo seed, atomic sale/outbox/audit rollback, same-command retries, local stock
  contention, invalid values/scope, refill vs container stock, payment totals,
  provisional weighted average, owner funding and cash variance/close concurrency.
- `npm run build`: standard Vite PWA build passed; manifest and precached shell
  generated. Browser suite separately builds standard and demo modes.
- `npm audit --audit-level=low`: passed, zero vulnerabilities on successful retry.
- `npx playwright test` (from `app`, against the final standard/demo builds):
  **6 passed** in desktop and Android-sized Chromium. Verified unseeded standard
  startup/offline reload; demo sale offline, tab close/reopen, stock/queue survival;
  offline refill, COD receiving, owner-funded expense and cash shortage reconciliation.
  Screenshots were inspected for desktop/mobile layout; no horizontal overflow.
- After the mobile CSS correction, `npm run build:demo` passed and
  `npx playwright test --project=android-sized-chromium --grep 'built PWA'`
  passed again (1 test). The refreshed mobile screenshot was inspected.

Initial test failure was test setup failing to reopen its disposable database
after deletion; fixed before rerun. Initial browser installation fetched Chromium
but its separate headless-shell download timed out. The harness uses installed
full Chromium in headless mode (`channel: chromium`, `install --no-shell`). An
initial standalone audit hit a registry DNS error; retry succeeded.

Browser setup initially exceeded a 45-second cold-run budget. Traces then identified
an exact-label selector that included dropdown option text; the harness now uses
the accessible combobox name. The final serial run passed all six scenarios with
unchanged business assertions. Screenshot review also moved the mobile CSS rule
after the base rules so the business picker fills the width and titles align left.

These are local results. GitHub Actions is configured but has not been run remotely.
No Supabase auth/RLS query, two-device cloud round trip, actual Android install,
power-failure durability or backup/restore has been validated in M0.

## Milestone 1 evidence (local Windows run, 2026-09-16)

**M1 core local-operation acceptance: met for the trusted local workspace.**
This is not a Phase 1 production-readiness or remote-authorization claim.

Baseline was executed before source changes: 24 unit tests, six browser tests,
standard/demo builds and audit passed. A duplicate baseline runner initially found
port 4173 occupied; the serial rerun passed before implementation.

| Final command | Executed result |
| --- | --- |
| `npm run check` (root) | Exit 0: TypeScript, ESLint with zero warnings, 63 Vitest cases in 3 files, standard Vite/PWA build |
| `npm test` (root, targeted core/migration coverage included) | Exit 0: 63 passed after report snapshot refactor |
| `npm run build:demo` (root) | Exit 0: demo PWA built; manifest/service worker and 11 precache entries generated |
| `npx playwright test` (from `app`, after final standard/demo builds) | Exit 0: complete suite, 12 passed in 5.3m |
| `npm audit` (root) | Exit 0: found 0 vulnerabilities; no dependency changes |
| `git diff --check` | Exit 0: no whitespace errors |

**75 automated cases:** 22 retained/extended foundation tests, 38 core-operation
tests, 3 migration/seed tests, plus 6 browser scenarios × 2 Chromium projects.
Parameterized cases are counted individually. Local desktop/mobile screenshots
of sales, dashboard/cash and inventory were inspected; overflow assertions passed.

| M1 area | Demonstrated behavior |
| --- | --- |
| Local setup and master data | Empty standard workspace created offline; catalog, prospective price revision, bank account, supplier; separate business/location APIs and local owner-role checks |
| Quick sale | Single item and mixed refill/container basket; payment equals sales; immutable cost/price snapshots; backend split allocation; single-account UI |
| Atomicity | Late command/audit failure rolls back sale, receipt, expense, abono, adjustment, catalog and cash writes; stock projection cannot remain partially updated |
| Retry and interruption | Duplicate submit, concurrent same-command calls, same draft from two browser tabs, receipt retry after reopening DB, completed form lock after tab close/reopen; one movement/payment/outbox |
| Inventory and receipts | Movement-derived kg/unit stock, purchase header/line/payment, supplier reference duplicate rejection, per-location value, weighted average, fractional consumption and exact value exhaustion |
| Expenses and abono | Business expense outflow; one owner payable and no store payment for abono; invalid/foreign/empty owners and non-expense categories rejected |
| Cash lifecycle | Cash payments require explicit open session; electronic sales excluded; cash receipt/expense reduce expected; close/retry concurrency; next session cannot change closed history |
| Reconciliation | Both shortage and overage retained with required explanation; actual minus expected, no silent balancing payment |
| Owner report/history | Philippine report date; sales vs payment mix; estimated gross profit/unknown cost; purchases separate from expenses; owner payables, cash variance, low stock/failure states; read-only history |
| Scope and invalid input | Product/account/location availability; local member/grant/role; wrong workspace/business/location/supplier; zero/negative/nonfinite/fractional centavos and invalid quantities rejected |
| Upgrade and PWA | v1/v2 → v3 retention of old pending payloads and history, frozen v2 cash carry and separate payable recovery; built service worker offline reload |

### Failures found and fixed

- Exact dropdown label selectors included option text; browser tests now address
  the accessible combobox name. Financial assertions were retained.
- Real Chromium inventory reporting hit `PrematureCommitError` while unit tests
  passed. Readonly reports now queue their snapshot reads synchronously and do
  calculation after transaction completion. All six affected stock-related
  browser cases passed on the final run.
- Empty owner ID on abono is rejected before any payment write. Saved sale forms
  render the committed receipt total even when catalog prices change afterwards.
- Inventory cost allocation uses exact integer intermediate multiplication to
  avoid losing centavos near numeric limits; overflow is explicitly rejected.

The complete final command sequence was run serially: root `npm run check`, root
`npm run build:demo`, then `npx playwright test` from `app`. Earlier failed browser
runs were investigation evidence, not counted as acceptance. No remote CI,
deployment, production database, authenticated RLS or two-device synchronization
test was performed. Physical Android install, abrupt power loss and backup
recovery remain unverified; see the red-team residual risks.

## Phase 1 release targets (later milestone gates still apply)

1. A previously installed store device can open the app and create a sale with airplane mode enabled.
2. Offline sale creates local sale, payment and relevant stock movements atomically.
3. Offline operation appears as queued for synchronization rather than failed.
4. Reconnection can synchronize the queued operation without duplicate sale or duplicate stock movement.
5. A rice sale reduces rice by kilograms regardless of the displayed selling unit.
6. A water refill does not incorrectly reduce new-gallon inventory.
7. A new-gallon sale does reduce gallon inventory.
8. Store operator cannot destructively delete a finalized transaction.
9. Cash close computes expected drawer from opening float plus/minus cash movements and records actual count and variance.
10. GCash/Maya/bank payments do not inflate revenue beyond the sale total.
11. Account transfer does not appear as sales or operating expense.
12. Owner abono is distinguishable from owner contribution, expense, reimbursement and withdrawal.
13. Dashboard can filter one business or aggregate all authorized businesses without mixing payment totals into sales totals.
14. Compliance/action center can show due/overdue records without hard-coding a permanent legal requirement.
15. The system remains usable if cloud sync is unavailable for an entire business day.

## Progressive test gates

| Gate | Required behavior evidence |
| --- | --- |
| M1 | Catalog/account management, full purchase records, expense/payable ledger, explicit cash-session attribution, double-submit protection for every command, dashboard outflows/variance/actions |
| M2 | Authenticated push/pull, same-ID retry after lost response, atomic cursor, commit-order race, cross-workspace/business/location isolation, role/actor spoof rejection, two independently operating devices and remote owner review |
| M3 | Correction reason/request/decision, linked reversal, rejection path, original retained, correction after another device received original |
| M4 | 25/50 kg sack receiving, exact value/weighted average, ≥1 kg scoop sale, physical 5/10 kg repack conservation, spillage/damage/shrinkage, count variance |
| M5 | Configurable container loan/deposit return/loss/damage, dispenser asset rental, delivery transitions, maintenance/component replacement, configurable testing/compliance reminders |
| M6 | ₱700 split into ₱500+₱200, transfer never revenue/expense, capital/draw classifications, reimbursement clears payable without second expense, payment reconciliation, accountant export |
| M7 | Extended offline/restart, unknown event versions, quota/cleared storage, corrupt backup rejected, non-empty restore refused, rollback-safe import, PWA update and failed migration recovery |
| M8 | Water normal day, Bigasan normal day, separate stores, long outage/reconnect, duplicate retry, correction, cash shortage/overage, inventory discrepancy, owner viewing both remotely |

Each milestone must record exact commands, results and limitations here. Do not
mark a cloud or operational gate complete on the basis of a compile or mock alone.
