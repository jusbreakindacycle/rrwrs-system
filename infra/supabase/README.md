# Supabase sync layer

**M0 status: original SQL scaffold preserved, not applied or remotely tested.**
The browser sync adapter is hard-disabled. Environment variables cannot enable it.
`001_sync_foundation.sql` is a design reference, not a complete migration history.
During M2, initialize the Supabase CLI locally, generate migrations with the CLI,
add least-privilege membership/business/location schemas and tests, and replace
the provisional text identifiers/event protocol through a reviewed migration.
Do not upload legacy/sample data or enable the former mutable upsert path.

A bare identity sequence is not a commit-ordered pull cursor; see the protocol
requirements in `docs/03-offline-sync.md`. No Supabase project was created or modified.

The app intentionally runs without Supabase. Cloud sync is disabled until authentication and workspace membership RLS are configured.

`001_sync_foundation.sql` is deny-by-default on purpose. Do not weaken it by placing a service-role key in the browser.

Recommended production sequence:
1. Create auth users for owners/operators.
2. Add `workspaces`, `workspace_members`, `business_access` tables.
3. Write RLS policies that check `auth.uid()` membership and business/location authorization.
4. Replace the local placeholder actor id with the authenticated user id.
5. Enable push/pull integration tests with two independent devices and deliberate retry/offline cases.
