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

## Phase 1 release targets

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
