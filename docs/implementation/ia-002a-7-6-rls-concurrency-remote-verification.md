# IA-002A.7.6 — RLS, Concurrency, and Remote Verification

## Verification record

| Field | Value |
|---|---|
| Commit under verification | `HEAD` at execution time |
| Remote project | Not executed; no approved project URL/credentials available |
| Verification timestamp | 2026-07-23 |
| Fixture prefix | `verify-ia002a76-*` |
| Owner contexts | Not created |
| Anonymous context | Not executed |
| Cleanup | No remote fixtures created |

The guarded harness is `scripts/verification/verify-acquisition-persistence.ts`. It refuses to run without `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `IA002A76_REMOTE_CONFIRM=YES`, and an `IA002A76_FIXTURE_PREFIX` beginning with `verify-ia002a76-`. It prints no secrets and is inventory-only by default.

## Inventory and matrix

The intended remote inventory covers the acquisition parent, commercial children, requirement children, agreement bases, closing state, and command receipts. Each table must be tested under Owner A, Owner B, and anonymous contexts for select, insert, update, and delete according to its append-only policy. Child access must be inherited through the trusted pipeline owner relationship.

Required evidence cases remain pending remote execution:

`RLS-001` owner isolation; `RLS-002` other-owner and anonymous denial; `IDEM-001` sequential replay; `CONC-001` duplicate race; `LOCK-001` stale pipeline/opportunity rollback; `IMM-001` append-only and submitted-offer protection; `ROLL-001` receipt/child failure rollback; `HYDR-001` complete remote round-trip and deterministic ordering.

## Known limitations

Remote migration application, authenticated RLS matrices, concurrent RPC calls, rollback injection, function/grant inspection, and cleanup verification were not claimed because this environment does not expose an approved remote project or test identities. The harness must be run against an isolated Supabase project before IA-002A.7.6 can be marked fully verified.
