# Security and Permissions

Permissions below are the target production model. M1 has no authenticated user
sessions or production workspace provisioning. A trusted local profile is not
server identity; demo and local setup cannot grant remote access.

## Store Operator
Can:
- create/finalize sales
- receive COD purchases
- record expenses within policy
- open/close cash session
- perform stock count and submit explained adjustments
- create correction requests

Cannot by default:
- delete finalized transactions
- overwrite historical price on a finalized sale
- approve own high-risk correction
- change business registration/compliance identity
- grant roles
- silently change starting inventory

## Owner
Can perform store operations plus:
- manage products/prices/payment accounts
- approve/reject corrections
- post owner contributions/withdrawals/reimbursements
- configure compliance records
- review all locations
- resolve sync/master-data conflicts

## Security design
- No sensitive secret key in frontend.
- Cloud uses authenticated user identity and row-level security.
- Publishable/anon client keys are not treated as authorization.
- Every high-risk change produces an audit event.
- Local-device lock/session timeout is recommended for shared store hardware.

## M1 boundary and M2 authorization gate

The standard build allows explicit setup of an empty local workspace; sample
data remains confined to the demo. `localContext` checks active workspace member,
owner/operator role, location grant, business/location relationships and device
identity. Products/accounts must belong to that workspace/business and be available
at the selected location. Owner-only services manage master data, store setup and
explained stock adjustments; operators may perform normal assigned store operations.
Reports filter by current local grants. There is no role-switching/sign-in UI or
membership management until M2. Local setup creates the trusted owner profile.

These are validation checks, not security against a device owner who can edit
IndexedDB. Browser storage is not encrypted or tamper-proof by this app. Use trusted
hardware/profiles only; no claim of secure shared-device staff access is made.
Removed local grants reject subsequent writes, but independent devices cannot
learn remote revocation in this milestone.

Cloud transport is hard-disabled, including when public environment variables
are provided. No browser client, automatic upload, background request or anonymous
write exists. The original SQL is retained as an unapplied deny-by-default design
scaffold; it is not a complete remote schema or tested RLS implementation.

Before M2 activation:

1. Create reviewed migrations for workspaces, authenticated members/roles, business
   access and location access; prove each foreign-key scope relationship.
2. Use authenticated server identity, never client actor claims or editable
   `user_metadata`, as authority. Verify current membership on each request.
3. Enable RLS on exposed tables; grant only required operations and restrict both
   USING and WITH CHECK where applicable. No permissive catch-all policies.
4. Keep financial events insert-only. Restrict mutable master data to owner grants
   and version checks; corrections require owner-approved linked events.
5. Test anonymous denial, inactive membership, wrong workspace/business/location,
   forged actor, role escalation, update/delete denial and duplicate payload abuse.
6. Prove owner visibility over assigned locations and operator writes only to
   assigned locations using real authenticated requests in a disposable database.
7. Establish cached-session/offline-lease behavior and device-loss response; preserve
   queued transactions when the server rejects revoked authorization.

Supabase table grants and row policies are separate controls; new-table exposure
defaults are changing. Review explicit grants with migrations rather than assuming
table creation exposes an API. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[Data API grant change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).
