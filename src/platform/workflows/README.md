# Workflow Platform (PF-010)

Workflows are the canonical platform capability for organizing Actions into
repeatable processes. The dependency direction is:

```text
platform/kernel + platform/execution + platform/actions
                              ↓
                     platform/workflows
```

The package contains no hospitality, UI, scheduling, notification, or
automation behavior. Feature modules provide immutable `WorkflowDefinition`
instances; `WorkflowExecutor` resolves those definitions against an
`ActionCollection` and returns a `WorkflowSession`.

## Definition and resolution semantics

A step definition declares required Action types rather than concrete Action
IDs. This keeps definitions reusable. At construction time, every supplied
Action matching a required type is attached to the step. Every distinct
required type must have at least one matching Action or the definition is
skipped with a diagnostic. A definition with no steps is valid and creates an
empty, completed Workflow.

Step identifiers and execution orders must be unique. Dependencies reference
step identifiers and must exist, cannot reference the same step, and cannot
form cycles. Steps are always normalized into ascending execution order.

## State and progress

Workflow status describes process state only; it does not execute or mutate an
Action. The builder derives initial state deterministically:

- all steps complete (including zero steps): `completed`
- current step contains a blocked Action: `blocked`
- current step contains an in-progress Action: `active`
- an incomplete dependency-ready step exists: `ready`
- incomplete work exists but no step is dependency-ready: `waiting`

The current step is the first incomplete step whose dependencies are complete.
Progress is the ratio of completed steps to total steps. Each Workflow carries
an immutable status history, and `withStatus` appends rather than overwrites
that history.

Completion criteria are declarative. `all-actions-completed` accepts completed
or measured Actions; an archived Action qualifies only when it retains a
completion timestamp. `all-actions-measured` requires measured Actions, with an
archived Action qualifying only when it retains a measurement timestamp. This
distinguishes completed work from Actions archived before completion. It is
state coordination, not Action execution.

## Public API

Import the complete capability from `@/platform/workflows`. Public artifacts
include `Workflow`, `WorkflowDefinition`, `WorkflowStep`, `WorkflowCollection`,
`WorkflowBuilder`, `WorkflowRegistry`, `WorkflowExecutor`, and
`WorkflowSession`, together with their identifiers, inputs, statuses, progress,
history, and execution options.
