# RRWRS Business Manager

Mobile-first, local-first Water Refilling Station and Bigasan management PWA.
React + TypeScript + Vite + Dexie/IndexedDB. Supabase is reserved for authenticated
remote synchronization in Milestone 2.

**Current stage: Milestone 0 foundation. Practice use only; not production-ready.**
The existing sale/receiving/expense/cash prototypes are preserved and tested as
foundation smoke flows. They do not establish completion of Milestone 1.

## Start (repository root)

Use Node 24 LTS and npm 11 (Node 22.12+ is also supported by the declared engines).

```sh
npm ci
npm run dev:demo
```

The demo opens two sample businesses at separate locations with sample prices,
stock and payment accounts. It uses the isolated `RRWRS-Demo` IndexedDB database.
It never synchronizes. `npm run dev` opens the unseeded production-setup shell.
Both run at the URL printed by Vite. No environment values are needed for M0.

## Build and offline preview

```sh
npm run build:demo
npm run preview --workspace app -- --mode demo --host 127.0.0.1
```

Load the preview once while connected, wait for the offline-ready message, then
disconnect and reload. Android installability requires HTTPS; localhost is suitable
for desktop testing. An ordinary LAN HTTP address is not an Android PWA test.
Use a stable origin: browser storage is scoped by protocol, host and port.

`npm run build` creates the unseeded shell in `app/dist`.
`npm run build:demo` creates practice assets in `app/dist-demo`.
`npm run preview` previews `app/dist`. These are local previews, not deployments.
The app waits for all tabs to close before activating an update; it does not force
a reload during transaction entry. Browser persistence is optional and not backup.

## Validation

```sh
npm run check
npx playwright install --no-shell chromium
npm run test:e2e
npm audit
```

`check` runs strict type checking, ESLint, Vitest and the standard PWA build.
Playwright builds both modes and tests desktop/mobile-sized Chromium against the
built service worker, offline reloads and store flows. Tests use disposable browser
contexts and fake IndexedDB databases, never the user's existing browser data.
GitHub Actions runs the same checks; a local pass is not a claimed CI run.

## Structure and source of truth

- `HANDOFF.md`: current state, evidence, limits, next milestone
- `AGENTS.md`: implementation loop, invariants and commands
- `docs/00-product-brief.md` through `08-tax-compliance-boundary.md`: approved scope
- `app/src/domain`: shared business types and numeric boundaries
- `app/src/db`: versioned local schema and explicit demo seed
- `app/src/services`: local atomic business operations, reporting, disabled sync boundary
- `app/src/components`: mobile/desktop store UI
- `app/src/test`, `app/e2e`: behavior and browser verification
- `infra/supabase`: original deny-by-default SQL design scaffold, not applied

## Security and data

The standard database name remains `LocalFirstBusinessManager`. An existing v1
database upgrades additively; old rows and queued payloads remain verbatim. They
are not reclassified as authenticated data. No delete/reseed recovery is automatic.

Copy `.env.example` to `app/.env.local` only when M2 provides secure synchronization.
All `VITE_` values are public. Never put secrets/service-role keys there. Setting
a URL and publishable key cannot activate transport in this milestone.

## Accounting boundary

This is an internal operations system, not an official BIR POS, invoice system,
registered computerized book, or automated tax filing service. Inventory purchases,
expenses, sales, transfers and owner funding remain distinct. Dashboard profit
means **Estimated Gross Profit**, before operating expenses.
