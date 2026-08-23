# FI-003C5 Production verification

Date: 2026-08-23

Status: complete.

## Release evidence

- Final Production deployment: `dpl_AGhtAWuEQyehmUVY3QEBWuRZepXB` (`READY`, aliased to `luxehavencollective.co`).
- Controlled Sandbox correlation: `fi003c5-6d45f2c4-a9f4-4da3-80c5-f588cef1031b`.
- Controlled identity: synthetic profile `75a61a17-dc15-41c3-b4b8-f93ebb12d476`, synthetic workspace `52dc92e7-7052-4ed8-a67e-409b55a2105e`, profile role `owner`, workspace role `owner`.
- The harness verified that exact identity and workspace before performing any Plaid operation.
- Institution: one controlled First Platypus Bank Sandbox Item using `user_transactions_dynamic`; exactly one account selected.
- Cleanup: provider data, canonical data, receipts, audits, membership, owner, profile, and auth user were removed. The following run's orphan preflight count was zero.

## Lifecycle result

The deployed walkthrough passed:

1. Connect → Link → public-token exchange → `syncing` → one canonical account → one canonical balance.
2. The authenticated workspace owner read exactly one balance through the canonical customer read boundary.
3. Initial sync produced 69 canonical transactions: 3 pending and 66 posted.
4. Forecast rendered `✓ Cash position Ready` after the canonical balance arrived.
5. A Sandbox refresh proved pending-to-posted handling: 3 pending records became voided and 3 new posted records appeared; totals became 75 records (3 pending, 69 posted, 3 voided).
6. Repeated signed webhook delivery retained the same durable receipt and transaction counts.
7. Sandbox login reset rendered `Needs attention`; Update Link returned the same provider connection and one canonical account to `Connected`, with no duplicate canonical history.
8. Controlled provider degradation rendered `Provider degraded`; Cash Flow retained the last reliable balance and transactions with stale freshness and no raw Plaid/runtime error.
9. Disconnect rendered `Disconnected`; the canonical account changed to `disconnected`, future token-using actions were disabled, and one balance plus all 75 transaction records were retained.
10. Cash Flow continued rendering retained history with stale provenance after disconnect.

Customer-visible lifecycle: Connect → Syncing → Connected → Needs attention → Reconnected → Provider degraded → Disconnected. Connected Systems and Cash Flow agreed throughout.

## Security sanity check

- Plaid access tokens are encrypted before persistence and are never returned to client components.
- Logs contain stable error codes only; token values, public tokens, decrypted access tokens, and arbitrary provider messages are not logged.
- Provider connections, provider accounts, webhook receipts, and provider audit events revoke access from `anon` and `authenticated`; only `service_role` has table access.
- Every customer-triggered service-role action first resolves the exact workspace membership and `financial.administration` permission.
- The webhook is the only unauthenticated service-role entry point and requires Plaid ES256 verification, a five-minute token-age bound, and a constant-time SHA-256 body match.
- Receipts retain only delivery hashes, event type/code, bounded counters, status, attempts, and safe error codes—never raw payloads or credentials.
- Disconnect marks the connection disabled before attempting provider revocation. Sync, account selection, Link update, and update completion all reject disconnected connections before subsequent provider access.
- The temporary Sandbox verification endpoint was removed before the final Production deployment.

## Migration and repository gates

Applied migrations:

- `20260823180000_fi003c_plaid_ingestion.sql`
- `20260823190000_fi003c5_plaid_recovery.sql`
- `20260823193000_fi003c5_canonical_read_authorization.sql`

The final remote migration dry run reported `upToDate: true` with no pending migrations.

- Tests: 753 files, 4,119/4,119 passed.
- Typecheck: passed.
- Lint: passed with zero errors; three unrelated pre-existing warnings remain.
- Production build: passed as part of final deployment.

## Known limitations and backlog

- Verification used Plaid Sandbox; institution-specific Production behavior still depends on live-bank rollout controls.
- Plaid operational monitoring—connection health, reauth rates, sync failures, webhook failures, and freshness—is recorded as a post-close operational improvement and does not hold FI-003C open.
- Multi-bank enhancements, transaction editing, categorization UI, obligation detection, reconciliation tooling, payments/ACH, additional providers, and additional Cash Flow functionality remain explicitly out of scope.
