# SA-001G — Saved Analysis Regression Suite

Status: automated repository coverage implemented; database replay, authenticated RLS
parity, and deployed-preview acceptance remain release blockers.

Date verified: 2026-07-27

## Result

The Saved Analysis lifecycle now has a focused, requirement-named regression pack
covering canonical fixtures, deterministic golden snapshots, idempotency conflicts,
purchase and rental-arbitrage round trips, zero/null/absence fidelity, immutable
reads, hydration, lineage, authorization policy, and the database migration
manifest.

This document separates executable evidence from static SQL inspection. Static
architecture tests prove that required statements remain present and connected;
they do not prove that PostgreSQL accepted a migration or that authenticated RLS
contexts produce the intended decisions.

## Test architecture

| Level | Primary responsibility | Evidence |
| --- | --- | --- |
| Domain | version semantics, lineage, compatibility, immutability, change detection | `src/features/investment-opportunity/tests/*.test.ts` |
| Application | save orchestration, immutable projection, hydration, authorization | feature tests plus `src/app/actions/investment-workspace-security.test.ts` |
| Adapter | payload-hash receipt behavior, gateway mapping, provider independence | in-memory and Supabase adapter tests |
| SQL manifest | transaction boundary, constraints, RLS policy wiring, legacy remediation order | `tests/architecture/saved-analysis-*.test.ts` |
| Database integration | real rollback, constraints, migration replay, authenticated RLS | **Not executed: no Docker daemon/local Supabase stack** |
| Preview acceptance | production-like lifecycle and role journey | **Not executed: no deployed preview context or credentials** |

Assertions are placed at the smallest boundary that owns the guarantee. The
architecture tests provide cross-layer wiring checks without duplicating all
domain assertions.

## Fixture strategy

`src/features/investment-opportunity/test-support/saved-analysis-fixtures.ts`
provides deterministic builders for:

- workspace access contexts and role identities;
- subject property;
- purchase and rental-arbitrage snapshots;
- scenario and report lineage;
- notes, activity, and idempotency receipts.

The clock, stable identifiers, currencies, periods, units, modes, and provenance
are explicit. Builders accept overrides so a test changes only the fact under
test. Runtime-generated aggregate IDs are not asserted unless identity stability
is the behavior under test.

Golden snapshots currently cover:

- financed purchase;
- rental arbitrage;
- user overrides;
- provider observations;
- platform defaults;
- fixed monthly and annual expenses;
- percentage expenses;
- explicit zero and nullable values in focused round-trip cases.

Cash purchase remains represented by the existing lifecycle fixtures rather than
a separate Saved Analysis golden builder.

## Regression packs

### Pack 1 — Canonical Persistence

- `saved-analysis-regression.test.ts`
- `saved-analysis-canonical-persistence.test.ts`
- `investment-opportunity/tests/application.test.ts`
- `investment-opportunity/tests/workflow.test.ts`

Primary guarantees: one canonical opportunity/version, sequential versions,
source lineage, retry receipt reuse, payload conflict rejection, activity
attachment, and note validation.

### Pack 2 — Immutable Read

- `immutable-analysis-read-path.test.ts`
- `investment-opportunity/tests/workflow.test.ts`

Primary guarantees: exact requested version, canonical latest version, projection
contract, provider-free read boundary, and downstream use of persisted snapshots.

### Pack 3 — Reanalysis Hydration

- `saved-analysis-regression.test.ts`
- `reanalysis-hydration.test.ts`
- `reanalysis-hydration-boundary.test.ts`

Primary guarantees: complete supported assumption contract, purchase/rental
isolation, zero/null/absence distinction, provenance, explicit refresh, no-change
policy, branching lineage, and source immutability.

### Pack 4 — Downstream Lineage

- `downstream-analysis-lineage.test.ts`
- `investment-opportunity/tests/scenarios.test.ts`
- `platform/reporting/reporting.test.ts`

Primary guarantees: scenarios and reports retain one source analysis version,
activity carries version identity, and newer versions do not move old artifacts.

### Pack 5 — Authorization and RLS

- `investment-opportunity/tests/authorization.test.ts`
- `investment-authorization-alignment.test.ts`
- `investment-workspace-security.test.ts`

Primary guarantees: authentication, workspace membership, property scope,
read/manage distinction, early authorization, and application/RLS policy
structure. Real RLS parity is not yet verified.

### Pack 6 — Migration and Legacy Recovery

- `saved-analysis-migration-regression.test.ts`
- `saved-analysis-canonical-persistence.test.ts`
- `supabase/migrations/20260727020000_saved_analysis_canonical_recovery.sql`

Primary manifest guarantees: scenario clones are copied before removal,
unresolvable lineage aborts, current-version references and sequence numbers are
repaired, source foreign keys restrict deletion, immutable triggers exist, and
the atomic save RPC contains all writes.

## Authorization matrix

The executable policy matrix lives in
`src/features/investment-opportunity/tests/authorization.test.ts`.

| Context | Read opportunity/history | Create version/scenario/report/note | Archive/restore |
| --- | --- | --- | --- |
| Owner | Allow | Allow | Allow |
| Administrator | Allow | Allow | Allow |
| Authorized operator | Allow | Allow according to permission set | Allow according to permission set |
| Read-only member | Allow when property is in scope | Deny | Deny |
| Restricted member, allowed property | Role-dependent allow | Role-dependent allow | Role-dependent allow |
| Restricted member, disallowed property | Deny | Deny | Deny |
| Suspended/inactive member | Deny | Deny | Deny |
| Other workspace | Deny without disclosure | Deny | Deny |
| Anonymous | Deny | Deny | Deny |

The migration expresses the corresponding database decisions through
`can_read_investment_opportunity` and `can_manage_investment_opportunity`.
Authenticated database contexts were not available, so application/RLS parity is
not yet empirically demonstrated.

## Migration scenarios

| Scenario | Observed result |
| --- | --- |
| SQL migration manifest and ordering | Passes static architecture assertions |
| Legacy scenario clone identification | Present and asserted |
| Scenario payload copied before clone deletion | Present and asserted |
| Unresolvable scenario source | Migration raises and aborts |
| Current-version and version-number repair | Present and ordered after clone removal |
| Source/report/activity foreign keys | Present and asserted |
| Clean database replay | Blocked: Docker daemon unavailable |
| Prior-schema forward migration | Blocked: Docker daemon unavailable |
| Representative contaminated rows | Not executed against PostgreSQL |
| Authenticated RLS contexts | Not executed against PostgreSQL |

The CLI check returned: `Cannot connect to the Docker daemon`. No destructive
database command was attempted.

## Requirements-to-tests traceability

| Requirement | Primary test/evidence | Level | Status |
| --- | --- | --- | --- |
| G.01 strategy | this document | Documentation | Complete |
| G.02–G.03 fixtures/goldens | `saved-analysis-fixtures.ts`, `saved-analysis-regression.test.ts` | Domain/application | Pass |
| G.04–G.05 save/version | canonical persistence and workflow tests | Application | Pass |
| G.06 atomic rollback | save RPC manifest; live fault injection | SQL/static + DB | Static pass; DB blocked |
| G.07 idempotency | `saved-analysis-regression.test.ts`, save RPC manifest | Adapter/SQL | Sequential pass; concurrent DB blocked |
| G.08–G.09 version/scenario separation | canonical persistence, scenario, migration tests | Domain/architecture | Pass |
| G.10–G.11 immutable history | immutable read and lineage tests | Application/architecture | Pass |
| G.12–G.15 round trip/provenance | saved regression and hydration tests | Application | Pass for supported contract |
| G.16–G.18 reanalysis/change set | hydration and workflow tests | Domain/application | Pass |
| G.19–G.20 scenario/report lineage | lineage, scenario, reporting tests | Application | Pass |
| G.21–G.22 activity/notes | workflow, scenario, reporting tests | Domain/application | Pass; DB rollback blocked |
| G.23 authorization matrix | authorization tests | Application | Pass |
| G.24 RLS parity | authorization SQL manifest | DB | Static pass; authenticated DB blocked |
| G.25–G.26 tenant/property isolation | authorization and security tests | Application/route | Pass; direct DB blocked |
| G.27 concurrency | application tests and save RPC locking manifest | Application/SQL | Sequential conflict pass; concurrent DB blocked |
| G.28 bundle consistency | immutable read and bundle RPC manifest | Application/SQL | Static pass; concurrent DB blocked |
| G.29 constraints | migration manifest tests | SQL | Static pass; DB rejection blocked |
| G.30–G.31 migration/legacy | migration regression tests | SQL/DB | Static pass; replay blocked |
| G.32 errors | workflow/security tests | Application | Partial; see known limitations |
| G.33 observability | architecture tests and runtime tests | Application | Structural pass; telemetry sink not verified |
| G.34 caching/revalidation | action architecture tests | Route | Structural pass |
| G.35 UI workflow | existing component/action tests | Component/route | Partial; preview blocked |
| G.36 provider independence | immutable-read architecture and hydration tests | Application | Pass |
| G.37 performance | no provider dependencies and single bundle RPC | Architecture | No benchmark evidence |
| G.38 isolation | deterministic local fixtures | Test architecture | Pass for in-process tests |
| G.39 naming/traceability | requirement-prefixed focused tests and this matrix | Documentation | Complete |
| G.40 CI groups | commands below | CI design | Defined; not wired to hosted CI |

## CI execution groups

Fast gate:

```bash
npm run lint
npm run typecheck
npx vitest run src/features/investment-opportunity/tests tests/architecture/saved-analysis-canonical-persistence.test.ts tests/architecture/immutable-analysis-read-path.test.ts tests/architecture/reanalysis-hydration-boundary.test.ts tests/architecture/downstream-analysis-lineage.test.ts tests/architecture/investment-authorization-alignment.test.ts tests/architecture/saved-analysis-migration-regression.test.ts
```

Persistence gate, once a local Supabase stack is available:

```bash
supabase db reset
supabase db lint --local
npm test
```

The persistence gate still requires a real authenticated-context test harness for
the role/property RLS matrix and fault injection at each write boundary.

Full release gate:

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```

It must also run clean and forward migration replay plus the preview acceptance
journey before deployment.

## Defects discovered

1. The in-memory opportunity repository stored only an idempotency result. A
   reused command ID with a different payload was incorrectly treated as a valid
   replay. It now stores the payload hash with the receipt and rejects a mismatch.
2. The Saved Analysis error vocabulary does not yet expose a dedicated
   idempotency-conflict code; the adapter maps the conflict to
   `OPPORTUNITY_PERSISTENCE_FAILED`.
3. The repository has no executable PostgreSQL test harness for authenticated RLS,
   migration replay, transaction fault injection, or concurrent bundle reads.
4. There is no automated deployed-preview acceptance suite or preview environment
   supplied to this workspace.

## Known limitations and deferred coverage

The following are release blockers for declaring SA-001G complete:

- atomic rollback inspected after injected PostgreSQL failures at every write;
- simultaneous duplicate-command and version-creation tests against PostgreSQL;
- clean and prior-schema migration replay with representative contaminated data;
- application/RLS parity under real owner, administrator, operator, read-only,
  restricted, other-workspace, and anonymous database contexts;
- provider-disabled deployed-preview journey;
- archive/restore and concurrent reanalysis in preview;
- performance measurements;
- a clean working tree and final milestone commit.

Several assumptions named by SA-001D/SA-001G are not calculation inputs in the
current workspace contract (for example financing fees, HOA, licensing, rent
escalation, ancillary revenue, and working capital as distinct fields). Tests
cover every field currently supported by `REANALYSIS_ASSUMPTION_CONTRACT`; adding
those product inputs belongs to their owning calculation/persistence milestone.

## Preview acceptance evidence

Not executed. No deployed preview URL, production-like Supabase credentials, or
test identities were available. No claim is made for the 30-step preview journey.

## Completion report

- Focused SA-001G test files added: 2.
- Canonical fixture modules added: 1.
- Focused SA-001G tests added: 12.
- Focused Saved Analysis gate: 9 files and 42 tests passed.
- Full repository gate: 487 files and 2,702 tests passed.
- Quality commands: lint, typecheck, production build, and `git diff --check`
  passed.
- Migration verification: static manifest coverage only; database replay blocked.
- RLS contexts verified in PostgreSQL: 0.
- Preview journey: not run.
- Defects discovered: 4, including one corrected adapter defect.
- Explicitly deferred risks: live database, concurrency, RLS parity, performance,
  and preview evidence as listed above.
- Final commit identifier: unavailable; the milestone is uncommitted. Baseline
  HEAD at audit time was `7ab1ed1c`.

SA-001G must not be marked complete until every release blocker above has passing
evidence.
