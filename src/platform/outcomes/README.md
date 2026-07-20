# Outcomes Platform (PF-012)

Outcomes are the canonical, immutable record of what happened after platform
execution. The dependency direction is:

```text
platform/actions → platform/workflows → platform/automations
                                           ↓
                                  platform/outcomes
```

The package records facts. It does not analyze, forecast, recommend, notify, or
render them.

## Measurement model

An `Outcome` records identity, title, summary, extensible type, execution
status, success, start and completion times, calculated duration, numeric
metrics, structured result data, notes, metadata, and causal lineage.

Terminal statuses require a completion timestamp. Completed Outcomes must be
successful; failed, cancelled, and timed-out Outcomes cannot be successful.
Durations are calculated from source execution history and are also recorded as
the canonical `durationMs` metric. Policy metrics can add platform-agnostic
measurements without interpretation.

`OutcomeCollection` provides immutable lookup, filtering, status/type grouping,
lineage queries, and numeric sum/average aggregation. These operations describe
recorded facts and contain no analytical inference.

## Policies and orchestration

`OutcomeExecutor` accepts terminal canonical Actions, Workflows, and Automation
executions. For each source it selects the first registered `OutcomePolicy`
whose `supports` method returns true. The policy supplies completion and success
facts, metrics, result payload, notes, timeout limits, and upstream lineage.
`OutcomeBuilder` validates and normalizes that result; `OutcomeSession` records
the generated collection, statistics, diagnostics, and metadata.

Policies measure execution only. They must not introduce business reasoning.
Unsupported sources are skipped with diagnostics. Policy or validation failures
are isolated to the affected source. When a measured duration exceeds the
policy timeout, the canonical result is `timed-out` and unsuccessful.

## Traceability

Execution artifacts supply the lineage they own:

- Actions supply Action and Decision IDs
- Workflows supply Workflow IDs and the Action/Decision IDs organized by steps
- Automation executions supply Automation execution IDs and the lineage of
  successfully initiated Actions and Workflows

The current Action boundary does not embed the full earlier reasoning graph.
Therefore an Outcome policy must provide Recommendation, Evaluation, Claim,
Evidence, and Observation IDs. The builder merges and deduplicates both sources
and rejects Action-derived Outcomes if any reasoning level is absent.

Lineage follows the actual causal path. An Action Outcome cannot reference a
later Workflow or Automation that did not cause it, and direct Action automation
does not fabricate a Workflow reference. Manual or external Outcome types may
carry empty execution levels only when those levels do not exist. This preserves
complete applicable history without inventing false ancestry.

## Public API

Import from `@/platform/outcomes`. The package exports `Outcome`,
`OutcomeCollection`, `OutcomeBuilder`, `OutcomePolicy`,
`OutcomePolicyRegistry`, `OutcomeExecutor`, `OutcomeSession`, identifiers,
statuses, lineage contracts, policy contexts, and executor inputs.
