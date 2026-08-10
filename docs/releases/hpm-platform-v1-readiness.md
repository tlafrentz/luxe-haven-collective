# Platform/HPM v1 release readiness

Status: development controls implemented; external rollout evidence pending. This document is not a production approval.

## Slice inventory

| Slice | Commit | Local evidence | Production state |
| --- | --- | --- | --- |
| HPM-001A integration contracts | `b3c93cfe` | contract and compatibility tests | deployed code; integrated experience not enabled by this record |
| HPM-001B lifecycle projection | `fd18b559` | deterministic projection, lineage, freshness, partial-source tests | disabled by rollout flags |
| HPM-001C attention and routing | `e0e12271` | attention, authorization, routing, concurrency tests | command routing must remain disabled until rollout approval |
| HPM-001D unified experience | `dcdb76c4` | component, responsive, recovery, and accessibility tests | workspace visibility controlled independently |
| HPM-001E reporting and operations | `853147b8` | report, export, cache, authorization, bounded-operation tests | report and operations flags default off |
| HPM-001F rollout controls | milestone commit pending | release-policy, flag, cohort, threshold, autonomy, and manifest tests | no external rollout executed |

## Required external evidence

The following are `Blocked` until produced against an approved production-like environment:

- Exact migration rehearsal with representative state and measured lock behavior.
- PostgreSQL RLS matrix using authorized tenant/property, unauthorized same-tenant property, other tenant, inactive, anonymous, and narrowly authorized service contexts.
- Complete and degraded lifecycle verification using production-composed EX-002, LR-001, and LR-002 boundaries.
- Application rollback against expanded schema, job suspension/resume, cache invalidation, and interrupted-migration recovery rehearsal.
- Capacity, security/static-analysis, responsive/accessibility, and critical-journey evidence from the release candidate.
- Backup/recovery confirmation, named release owner, incident commander, support coverage, SLI baseline, alert delivery, and cohort approvals.
- Flag-off production smoke tests, followed by separately approved internal and customer-cohort tests.
- Stabilization evidence and final release approval.

These are not deferrals and cannot be interpreted as passing gates. Production deployment, migration, cohort enablement, final release record, and tag must not occur from local evidence alone.

## Versioned release policy

- Platform release: `hpm-platform-v1`
- Release policy: `hpm-release-v1`
- Lifecycle: `hpm-lifecycle-v1`
- Stage vocabulary: `hpm-stage-v1`
- Projection: `hpm-projection-v1`
- Presentation: `hpm-presentation-v1`
- Attention: `hpm-attention-v1`
- Command vocabulary: `hpm-command-v1`
- Routing: `hpm-routing-v1`
- Health: `hpm-health-v1`
- Freshness: `hpm-freshness-v1`
- Lineage: `hpm-lineage-v1`
- Report/cache: report definitions `v1`, `hpm-report-cache-v1`

## HPM dependency migrations

The rollout inventory includes these source-capability migrations; their remote applied state must be established rather than inferred from the repository:

| Migration | Classification | Recovery posture |
| --- | --- | --- |
| `20260809020000_ex001_execute_workspace_foundation.sql` | additive schema, RLS | forward recovery; preserve expanded schema |
| `20260809021000_ex001b1_plan_activation_outbox.sql` | additive schema, RPC, RLS | idempotent verification; forward recovery |
| `20260809022000_ex001b2_execution_controls.sql` | additive schema, constraints, RLS | forward recovery |
| `20260809023000_ex002_outcome_measurement_v1.sql` | additive measurement schema, RLS | forward recovery; never rewrite finalized history |
| `20260809024000_lr001_learn_workspace_v1.sql` | additive learning schema, RLS | forward recovery; preserve source versions |
| `20260809025000_lr002_learning_recommendations.sql` | additive recommendation schema, RLS | forward recovery; preserve downstream ownership |

Checksums, duration, locks, row counts, transaction behavior, compatibility, verification queries, rehearsal results, owners, and approvals belong in the environment-specific evidence package. HPM-001A–F itself introduces no new public database table.

## Feature groups

All release definitions default disabled and are evaluated on the server. Dependencies are fail-closed:

`workspace → lifecycle → attention / command-routing / reporting / learn → recommend`

Operations depends on workspace. Any kill switch forces its feature off; dependants then resolve off. A flag exposes a feature but never grants tenant, property, record, reviewer, or command authority.

## Predeclared thresholds

- Projection availability: at least 99%.
- Projection p95: at most 3 seconds.
- Required-source failure: at most 1%.
- Report and export success: at least 99% each.
- Client error rate: at most 1%.
- Oldest active rollout job: at most 5 minutes.
- Cross-tenant signal, unauthorized mutation, corrupted lineage, or autonomous authority event: exactly zero and an immediate halt.

Threshold changes require a new reviewed policy version; they cannot be relaxed during a phase merely to advance it.
