# Repository engineering contract

Read `HANDOFF.md` completely, then the relevant numbered documents in `docs/`.
Preserve the approved Water/Rice product. Work in the requested milestone; do not
equate prototype screens with completed milestones.

## Commands (repository root)

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e` (install Chromium with `npx playwright install --no-shell chromium` first)
- `npm run dev:demo` for explicitly isolated sample operations

## Implementation loop

Inspect → state change/invariants → implement a coherent increment → run relevant
checks → exercise the business flow → review offline/security/regressions → fix →
document evidence. Never invent passing results. This user-authorized development
workflow is separate from parent-directory scheduled report-only triage loops.

## Conventions and boundaries

- Strict TypeScript; React views call application services; Dexie owns persistence.
- Integer centavos; finite validated quantities; kg is rice's base inventory unit.
- Shared core in `domain/`, `db/`, `services/`; module rules must not leak into money.
- Explicit workspace/business/location scope. A business is not a location.
- M1 UI drafts persist command UUIDs in IndexedDB. Completed drafts stay locked
  until an explicit new operation. Every mutating form must use this contract.
- Cash entries require an open session and carry its ID. Closed expected/actual
  counts and variances are historical snapshots; never recompute them from later
  payments. Abono creates an owner payable with no business payment.
- Catalog revisions retain identity/unit behavior and optimistic versions. Sale
  lines freeze price, cost and product version. Location valuation is separate
  from product pricing. Quantity is derived from the movement ledger.
- No network requests inside local transactions. Read/validate/write all related
  rows, audit and outbox in one Dexie transaction. Never catch a failed write inside
  that transaction and continue. Stable command/event IDs must survive retries.
- Append financial and stock history; corrections require linked owner-reviewed
  reversals. Do not add silent edits/deletes of finalized transactions.
- Keep old IndexedDB versions. Add migrations; test upgrade with pending events.
  Never delete/reseed user databases to resolve migration or boot errors.
- Demo seed is explicit, atomic, repeat-safe and confined to the demo database.
- Cloud remains disabled until membership/RLS, ingestion, pull and two-device
  tests pass. No service-role keys, permissive policies, or credentials in Git.
- Financial, offline and authorization changes require behavior tests. Browser
  tests exercise built PWA assets; fake IndexedDB tests alone do not prove offline.
- Document deferred risks in `docs/06-red-team.md` and acceptance evidence in
  `docs/05-acceptance-criteria.md`. Keep `HANDOFF.md` current.
- Do not implement Laundry, Coffee, credit, payroll or tax certification.
