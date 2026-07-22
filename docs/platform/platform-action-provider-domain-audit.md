# PF-009 Batch 1 — Platform Action Provider Domain Audit

## Audit status

| Attribute | Result |
| --- | --- |
| Deliverable | Canonical domain audit for the Platform Action capability |
| Runtime impact | None |
| Production code changes | None |
| Behavior changes | None |
| Schema changes | None |
| Architecture alignment | ADR-001 through ADR-005 in `docs/platform/platform-v1.md` |
| Implementation disposition | Ready for Batch 2, subject to the migration decisions in this document |

This document is the canonical design authority for PF-009. It defines the
target domain model; it does not claim that the current transitional
`src/platform/actions` package already implements that target.

## 1. Purpose and boundary

The Platform Action capability is the canonical representation of committed
business work. It answers one question:

> What work has been committed and now requires execution?

An Action is not an Observation, Evidence, Claim, Evaluation, Recommendation,
Decision, execution record, Outcome, or Learning artifact. Those concepts keep
their own canonical identities and capabilities. An Action may reference them
through lineage, but it must not duplicate their state or behavior.

Recommendations are proposals and are optional. Actions are commitments. A
manual, imported, API-created, or automated commitment does not require a
Recommendation, but it must retain its actual provenance.

## 2. ADR alignment and lifecycle position

PF-009 follows the Platform v1 lifecycle in ADR-002:

```text
Observation → Evidence → Claim → Evaluation → Recommendation → Decision
→ Action → Workflow → Automation → Outcome → Intelligence → Learning
```

For operational discussion, the downstream boundary may be summarized as:

```text
Action → Execution → Outcome → Learning
```

Here, **Execution** describes work performed through the Workflow, Automation,
and execution-record capabilities. It is not a replacement canonical lifecycle
artifact and does not alter ADR-002. Action owns what should be executed;
downstream execution capabilities own what happened.

The design applies the Platform v1 ADRs as follows:

| ADR | PF-009 consequence |
| --- | --- |
| ADR-001: domain-agnostic Platform | No property, hospitality, dashboard, Cleaner, Owner, or Admin vocabulary appears in the canonical model. |
| ADR-002: canonical lifecycle | Action represents commitment only and cannot absorb Recommendation, execution, Outcome, or Learning semantics. |
| ADR-003: Platform artifacts, feature policies | Platform owns Action structure and invariants; features decide when and why to commit work. |
| ADR-004: immutable artifacts | Every operation returns a new aggregate version and appends history; identity and prior versions are never rewritten. |
| ADR-005: explainability | Every Action has explicit provenance and actor/time history sufficient to explain its creation and transitions. |

## 3. Canonical aggregate boundary

There is exactly one canonical aggregate root:

```text
PlatformAction
├── PlatformActionAssignment
├── PlatformActionSchedule
├── PlatformActionHistory
├── PlatformActionOutcomeReference
└── PlatformActionSource
```

The root protects all lifecycle invariants. Child records do not have an
independent lifecycle outside their Action. Feature modules may define policies,
commands, and read models, but may not introduce another Action entity or use a
feature DTO as canonical state.

The implementation may use the shorter exported class name `Action` if package
context makes the meaning unambiguous, but its domain identity is
`PlatformAction`. Names such as `ExecutiveAction` or `RevenueAction` are allowed
only for explicitly labeled adapters/read models, never as competing aggregates.

### Aggregate responsibilities

`PlatformAction` owns:

- stable identity, workspace scope, creator, timestamps, and version;
- commitment content such as title, description, and feature-owned action type;
- lifecycle status and legal state transitions;
- ownership, assignments, priority, and schedule;
- provenance references;
- immutable transition history; and
- references to downstream Outcomes.

It does not own:

- recommendation or decision reasoning;
- workflow steps, automation runs, or execution history;
- business measurements or success calculations;
- Outcome contents; or
- Learning generation or lessons learned.

## 4. Identity and concurrency

Every Action has the following required identity fields:

| Field | Meaning | Invariant |
| --- | --- | --- |
| `ActionId` | Globally stable Action identity | Assigned once and never changed or reused |
| `WorkspaceId` | Tenant/workspace boundary | Required and immutable |
| `CreatedAt` | Time the first version was created | Valid timestamp and immutable |
| `CreatedBy` | Actor that created the Action | Required actor reference and immutable |
| `Version` | Aggregate concurrency/version number | Positive, monotonically increasing |

Every state-changing operation preserves `ActionId`, `WorkspaceId`,
`CreatedAt`, and `CreatedBy`, increments `Version`, and appends a history entry.
Repositories must use `Version` for optimistic concurrency rather than silently
overwriting a newer aggregate.

## 5. Lifecycle state

The canonical lifecycle is:

| State | Meaning |
| --- | --- |
| `Draft` | Work is being prepared but is not yet a commitment. |
| `Committed` | The business has committed to the work. |
| `Ready` | Preconditions are satisfied and execution may begin. |
| `InProgress` | Downstream execution has started. |
| `Blocked` | Progress cannot continue until a blocker is resolved. |
| `Completed` | The committed work is finished. This does not imply that an Outcome has been measured or Learning produced. |
| `Cancelled` | The commitment was intentionally withdrawn before completion. |
| `Archived` | The Action is retained but removed from active operational views. |

Canonical transitions are:

```text
Draft → Committed → Ready → InProgress → Completed → Archived
             │         │          │
             ├─────────┴──────────→ Blocked
             │                       │
             │                       ├→ Ready
             │                       └→ InProgress
             └────────────────────────→ Cancelled → Archived
```

Additional transition rules:

- `Draft` may be cancelled or archived without becoming committed.
- `Committed`, `Ready`, `InProgress`, and `Blocked` may be cancelled.
- A blocked Action returns to `Ready` when execution has not started, or to
  `InProgress` when resuming started work; history records the resume target.
- `Completed`, `Cancelled`, and `Archived` are terminal operational states,
  except that `Completed` and `Cancelled` may subsequently be archived.
- Completion does not require an Outcome and must not create one implicitly.
- There is no `Measured` or `Learned` Action state. Measurement and Learning are
  downstream lifecycle concerns.

## 6. Ownership and assignment

Ownership expresses accountability for the committed work. It is deliberately
generic:

| Owner type | Meaning |
| --- | --- |
| `User` | A platform user is accountable. |
| `Team` | A team is accountable. |
| `System` | A system capability is accountable. |
| `Automation` | An automation identity is accountable. |
| `Unknown` | Accountability has not yet been resolved. |

An owner is an actor reference containing an owner type and, when known, a
stable external or platform identifier. Display names are projection data and
must not be identity.

Assignment is independent from ownership. Ownership answers who is accountable;
assignment answers who or what is expected to perform the work. An Action may:

- have no active assignee;
- be assigned or reassigned;
- enter a queue without a named assignee;
- be claimed from a queue; or
- be assigned to an automation.

`PlatformActionAssignment` records assignee type, assignee reference or queue,
assignment state, assignment time, assigning actor, and optional release/claim
time. Reassignment appends a new assignment/history record rather than erasing
the previous assignment.

Feature roles such as Cleaner, Owner, and Admin must be mapped to generic actor
references by feature adapters and must never become Platform owner types.

## 7. Priority

Priority expresses execution urgency:

| Priority | Meaning |
| --- | --- |
| `Critical` | Immediate execution or intervention is required. |
| `High` | Execute ahead of normal committed work. |
| `Normal` | Standard execution order. |
| `Low` | Execute after higher-priority work. |
| `Deferred` | Intentionally postponed while remaining committed. |

Priority answers, “What should happen first?” It is not an HPM score,
Recommendation confidence, financial impact, severity, or business value.
Feature policies translate those concepts into priority explicitly.

## 8. Scheduling

Scheduling is owned by the Action and represented by
`PlatformActionSchedule`. The canonical time properties are:

| Property | Requirement |
| --- | --- |
| `Created` | Required; corresponds to aggregate creation time |
| `Scheduled` | Optional; time the schedule was established |
| `StartAfter` | Optional; execution must not begin before this time |
| `Due` | Optional; target completion time |
| `Completed` | Optional; actual completion time recorded by the Action transition |

An Action need not have a due date. When both are present, `Due` must not be
earlier than `StartAfter`. Schedule changes increment the aggregate version and
append history. Scheduling describes intent; it is not an execution record.

## 9. Provenance

Every Action retains at least one `PlatformActionSource`. Supported source types
are:

- `Recommendation`
- `Decision`
- `Manual`
- `Automation`
- `Import`
- `API`

A source contains its type, the originating object identifier when one exists,
the originating capability or external system, and the time/actor that recorded
the link. Sources reference origin objects; they do not copy their content.

Manual creation uses a `Manual` source and records the creating actor. Automated,
imported, and API-created Actions identify the responsible system. A Decision or
Recommendation source uses the canonical upstream identifier. Multiple sources
are permitted when one commitment consolidates upstream context, but duplicate
source references are not.

Provenance is immutable. Corrections append a superseding history record or
create a new Action; they do not rewrite historical lineage.

## 10. Execution boundary

The Action Provider does not execute work. It owns the commitment and exposes
state transitions that acknowledge externally initiated execution events.

| Action capability | Execution capabilities |
| --- | --- |
| Defines what should be executed | Define and run how work is executed |
| Owns readiness, priority, assignment, and schedule | Own workflow steps, attempts, runs, errors, and execution records |
| Records `start`, `block`, and `complete` transitions | Supplies the facts that authorize those transitions |
| References downstream results | Produces execution and Outcome records |

An application service may coordinate an execution result with an Action
transition, but execution details must not be embedded in the aggregate.

## 11. Outcomes and Learning

Actions contain references to Outcomes, never Outcome metrics or measured
impact directly:

```text
PlatformAction → PlatformActionOutcomeReference → Outcome
```

`PlatformActionOutcomeReference` contains only the canonical `OutcomeId`, link
type, and link metadata needed for lineage. The Outcomes capability remains the
single source of truth for success, measurements, business metrics, and result
interpretation.

Learning is further downstream:

```text
Action → Outcome → Intelligence → Learning
```

The Action aggregate does not compute Learning, store lessons learned, or enter
a learned state. Consumers may project downstream Outcome or Learning data next
to an Action without making that data part of the aggregate.

## 12. History and immutability

`PlatformActionHistory` is an append-only record of business operations. Each
entry includes:

- Action identifier and resulting aggregate version;
- operation/transition type;
- prior and resulting status when applicable;
- occurrence timestamp;
- actor reference;
- reason or rationale where the operation requires one; and
- references to commands or external events needed for traceability.

History is not execution history. It explains how the commitment changed.
Execution attempts and runtime diagnostics stay in the Execution capability.

## 13. Provider and repository contracts

The Action Provider is the application-facing entry point for Action business
operations. The repository persists and retrieves aggregate versions. Neither
contract should make generic CRUD the dominant domain API.

Target operations include:

```text
createDraft()
createCommitted()
commit()
assign()
releaseAssignment()
claim()
schedule()
markReady()
start()
block()
unblock()
complete()
cancel()
archive()
linkOutcome()

findById()
findByOwner()
findByAssignee()
findByStatus()
findBySource()
```

Command operations require workspace scope, expected version, acting identity,
and operation time. The repository may internally persist a complete aggregate,
but a generic public `save()` must not bypass invariants or replace meaningful
business operations.

Query results must remain workspace-scoped. Cross-workspace lookup by raw Action
ID is not an approved consumer operation.

## 14. Consumer map

Initial consumers are:

| Consumer | Allowed dependency | Consumer-owned responsibility |
| --- | --- | --- |
| Executive Intelligence | Platform Action Provider/query contract | Executive summaries and projections |
| Revenue Intelligence | Platform Action Provider/command contract | Revenue policy that proposes or commits work |
| Investment Intelligence | Platform Action Provider/command and query contracts | Investment policy and projections |
| Action Center | Platform Action query contract | Action Center read model, controls, and presentation |
| Automation | Platform Action command/query contracts | Automated assignment and execution coordination |

Consumers depend on the Platform Action Provider, never on one another. Platform
Actions must not import any feature module. Feature adapters may translate
canonical Actions into local read models, but cannot add canonical lifecycle
behavior.

## 15. Current-state audit

The existing `src/platform/actions` package establishes useful canonical
primitives, immutable transitions, collections, and feature-independent types,
but it is a transitional implementation rather than the Batch 2 target.

| Concern | Current state | Target disposition |
| --- | --- | --- |
| Aggregate name | Canonical class is `Action` | Treat as `PlatformAction`; retain short export only if unambiguous |
| Identity | `ActionId` and `createdAt` exist | Add `WorkspaceId`, `CreatedBy`, and `Version` |
| Lifecycle | `proposed`, `accepted`, `scheduled`, `in-progress`, `blocked`, `completed`, `measured`, `archived` | Replace/map to the canonical eight-state lifecycle; remove `Measured` |
| Cancellation/readiness | No `Cancelled` or `Ready` state | Add both with explicit transitions |
| Ownership | User, team, automation, and system; ID/display name required | Add `Unknown`; keep display data outside identity |
| Assignment | Not modeled independently | Add assignment records and operations |
| Priority | Critical, high, medium, low | Rename `medium` to `Normal`; add `Deferred` |
| Scheduling | Only `scheduledFor` plus lifecycle timestamps | Add the canonical schedule value object |
| Provenance | Decision IDs only; manual/legacy may have none | Require typed sources for every Action |
| Outcome boundary | Outcome summary, success, impact, and lessons are embedded | Replace with canonical Outcome references |
| Learning boundary | Lessons learned are stored and `measure()` changes Action state | Remove from Action; Learning remains downstream |
| Execution boundary | `ActionExecutor` executes Action-creation policies and uses execution session types | Rename/reframe policy evaluation to avoid implying that Actions execute committed work |
| History | New immutable snapshots exist but no explicit history entries | Add append-only Action history |
| Repository/provider | No repository or provider contract | Implement business-operation contracts in Batch 2 |

Existing feature compatibility DTOs, including `ExecutiveAction`, remain
adapters only. They must not shape the new aggregate or survive as parallel
domain models. Migration must preserve current consumers through explicit
adapters until each consumer adopts the Provider.

## 16. Batch 2 implementation contract

Batch 2 may begin without reopening the foundational domain questions in this
audit. It must:

1. Introduce the required identity, actor, source, assignment, schedule, history,
   and Outcome-reference contracts.
2. Implement the canonical lifecycle and transition matrix.
3. Remove embedded Outcome metrics and Learning semantics from the aggregate.
4. Introduce workspace-scoped Provider and repository interfaces with optimistic
   concurrency.
5. Preserve feature compatibility only through clearly named adapters.
6. Add architecture tests preventing Platform-to-feature imports and parallel
   canonical Action models.
7. Provide a deliberate compatibility/migration map for existing status,
   priority, owner, outcome, and policy APIs before removing them.

Schema design, persistence adapters, runtime wiring, and consumer adoption are
subsequent implementation concerns. This Batch 1 audit introduces none of them.

## 17. Architectural constraints

The following constraints are mandatory:

1. Exactly one canonical `PlatformAction` aggregate exists.
2. Feature modules may not introduce parallel Action models.
3. Platform modules must not depend on feature modules.
4. Action records commitments, not Recommendations.
5. Recommendation provenance is optional; provenance itself is required.
6. Execution, Outcomes, Intelligence, and Learning remain separate capabilities.
7. Actions reference upstream and downstream artifacts rather than duplicating
   them.
8. Aggregate identity is immutable and all changes are versioned and auditable.
9. Ownership is not assignment, and neither is encoded with feature roles.
10. Priority is execution urgency, not HPM score or business impact.

## 18. Acceptance criteria and conclusion

Batch 1 is complete because this audit:

- defines the canonical Action purpose and lifecycle position;
- specifies one aggregate root and its child boundaries;
- defines identity, lifecycle state, ownership, assignment, priority, schedule,
  provenance, history, and Outcome references;
- separates Action from execution, Outcome, Intelligence, and Learning;
- identifies initial consumers and dependency direction;
- audits the transitional implementation and records its migration gaps;
- defines the Provider/repository contract and Batch 2 implementation boundary;
  and
- introduces no production code, runtime behavior, or schema changes.

The domain is ready for Batch 2 implementation. All later PF-009 work—Provider,
repository, Action Center adoption, Executive adoption, Revenue adoption,
Investment adoption, and Automation integration—must trace back to this audit or
to an explicit, versioned architectural amendment.
