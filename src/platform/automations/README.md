# Automation Platform (PF-011)

Automation is the canonical platform capability for determining whether
Decision-backed Actions and Workflows may begin without human intervention.
Its dependency direction is:

```text
platform/kernel + platform/execution
platform/decisions → platform/actions → platform/workflows
                                      ↓
                            platform/automations
```

Automation does not create Decisions, perform business reasoning, or execute
the work represented by an Action. It evaluates immutable configuration and
governance, then asks an `AutomationInvoker` to initiate an eligible canonical
Action or Workflow. The default invoker performs only canonical lifecycle
transitions. External execution engines can supply another invoker.

## Rules, triggers, and conditions

An `AutomationRule` declares one Action or Workflow target, a platform-event
trigger, independently evaluable conditions, an execution window, retry limit,
and concurrency limit. Feature modules own rule configuration; no hospitality
categories are embedded in this package.

Triggers match an event type and optional event name. Supported platform event
types include Decision creation, Action completion, Workflow start/completion,
Observation creation, schedules, external events, and manual triggers.

Conditions compare a named event-data or target field using `equals`,
`not-equals`, `greater-than-or-equal`, `less-than-or-equal`, `includes`, or
`exists`. Conditions contain no callbacks or execution logic, keeping evaluation
deterministic and serializable.

Scheduling is represented as an inclusive `notBefore`/`notAfter` execution
window evaluated against the event occurrence time. Calendar production and
persistent job queues remain outside PF-011.

## Governance and execution

Every matching rule is evaluated by every registered `AutomationPolicy` that
supports its context. Any denial prevents invocation and is preserved in the
audit trail. Applicable policy constraints cap rule-level retries and
concurrency; they cannot broaden a rule's configured limits.

Automation cannot bypass reasoning. A targeted Action must reference at least
one Decision. Every Action organized by a targeted Workflow must also retain
Decision provenance. Manual or legacy Actions without that provenance are
recorded as skipped.

Eligible invocations run with a deterministic concurrency cap. Failures are
retried up to the governed attempt limit. The executor preserves input rule
order in cycle results even when invocation is concurrent.

## Audit model

Every rule considered during a cycle creates an `AutomationExecution`:

- `succeeded` records initiated Actions or Workflows and attempt count
- `failed` records exhausted retries and diagnostics
- `skipped` records disabled rules, mismatched triggers, closed execution
  windows, missing targets, missing Decision provenance, failed conditions, or
  policy denials

`AutomationHistory` is immutable and append-only. `AutomationSession` exposes
the current cycle executions, accumulated history, execution statistics,
diagnostics, status, and metadata.

Import the public capability from `@/platform/automations`.
