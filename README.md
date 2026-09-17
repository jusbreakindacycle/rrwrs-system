# RRWRS Business Manager

Mobile-first, local-first Water Refilling Station and Bigasan management PWA.
React + TypeScript + Vite + Dexie/IndexedDB. Supabase is reserved for authenticated
remote synchronization in Milestone 2.

**Current stage: Milestone 1 core local operations. Not production-ready.**
Catalog, configurable accounts, sales, stock receiving, expenses/abono, explicit
cash sessions, reconciliation and local owner reports are implemented. Cloud
transport remains disabled. See the handoff for executed validation and limits.

## Start (repository root)

Use Node 24 LTS and npm 11 (Node 22.12+ is also supported by the declared engines).

```sh
npm ci
npm run dev:demo
```

The demo opens two sample businesses at separate locations with sample prices,
stock and payment accounts. It uses the isolated `RRWRS-Demo` IndexedDB database.
It never synchronizes. `npm run dev` opens an unseeded local-workspace setup form.
Both run at the URL printed by Vite. No environment values are needed for M1.

## Local store workflow

1. In the standard build, explicitly create the workspace, owner profile, first
   Water/Rice business and location. This trusted-device profile is not sign-in.
   Setup creates one empty cash drawer, no sample products, stock or transactions.
2. Choose the business/location in the header. **Manage** adds products/services,
   current prices, location availability, payment accounts and suppliers. Additional
   businesses and locations can be added without equating a business to a branch.
3. In **Ops → Cash close**, enter the physically available opening float before
   accepting or spending cash. Electronic accounts do not need a cash session.
4. Receive paid stock in **Ops**, using total kg for rice or whole containers.
   Supplier references prevent a second receipt of the same supplier document.
   **Stock** supports owner-only, explained opening/manual movements; no direct
   stock balance edit exists. Paid stock acquisition belongs in receiving.
5. **Sale** supports a quick item or a basket. All selected items are fully paid to
   one selected account in the current UI. The service model supports split
   allocations; split-payment entry belongs to M6. A refill does not consume new
   containers; a separately selected container does.
6. Record operating expenses in **Ops**. Choose the paying owner for abono. It
   creates an owner payable and no store payment. Reimbursement is deferred to M6.
7. Count and close the drawer. A shortage/overage requires an explanation and
   stays visible. **Overview** reports Philippine-date sales, estimated gross
   profit, payment mix, outflows, owner payables and cash variance. **History**
   exposes finalized records and audit entries without edit/delete actions.

Completed forms remain locked across reloads. Use **New sale/receipt/expense**
for a new operation; retrying the existing form returns the original transaction.
Cash opening is a float, not revenue. No transfer, withdrawal, contribution or
reimbursement should be entered through sales or operating expenses.

## Build and offline preview

```sh
npm run build:demo
npm run preview --workspace app -- --mode demo --host 127.0.0.1
```

Load the preview once while connected, wait for the offline-ready message, then
disconnect and reload. Android installability requires HTTPS; localhost is suitable
for desktop testing. An ordinary LAN HTTP address is not an Android PWA test.
Use a stable origin: browser storage is scoped by protocol, host and port.

`npm run build` creates the unseeded local setup/application in `app/dist`.
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

The standard database name remains `LocalFirstBusinessManager`. IndexedDB v3
adds purchase, supplier, owner-payable, valuation, command-receipt, draft and product
revision stores. v1/v2 history and queued payloads are retained. v2 catalog metadata
and open cash sessions are upgraded additively; old expense owner liability is
recovered only when a single owner is unambiguous. No delete/reseed is automatic.

Local scope/role checks protect application workflows, not against a person with
browser developer tools or access to the device. There is no authenticated remote
owner monitoring yet. Keep independent records until secure sync, correction and
backup/recovery gates pass. Losing browser data currently has no app recovery path.

Copy `.env.example` to `app/.env.local` only when M2 provides secure synchronization.
All `VITE_` values are public. Never put secrets/service-role keys there. Setting
a URL and publishable key cannot activate transport in this milestone.

## Accounting boundary

This is an internal operations system, not an official BIR POS, invoice system,
registered computerized book, or automated tax filing service. Inventory purchases,
expenses, sales, transfers and owner funding remain distinct. Dashboard profit
means **Estimated Gross Profit**, before operating expenses.
