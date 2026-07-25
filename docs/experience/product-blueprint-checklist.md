# Product Blueprint Checklist

## Required product handoff

- [ ] Mission
- [ ] Primary users
- [ ] Core business question
- [ ] Primary action
- [ ] Product health model and dimensions
- [ ] Dominant workspace pattern
- [ ] Local navigation model
- [ ] Supporting intelligence
- [ ] History/continuity model
- [ ] First-use state
- [ ] Attention state
- [ ] Degraded state
- [ ] Empty-result state
- [ ] Loading state
- [ ] Error state
- [ ] Permission state
- [ ] Archived-state behavior
- [ ] Desktop, tablet, and mobile behavior
- [ ] Success metrics
- [ ] Explicit out-of-scope capabilities

## Five-region review

- [ ] Header has one H1, one-sentence purpose, stable context, and at most one dominant action.
- [ ] Overview uses one stable model with three to six decision-relevant indicators.
- [ ] Primary workspace clearly dominates and declares one approved pattern.
- [ ] Supporting information improves the task without repeating it.
- [ ] History is distinguishable from live state and supports continuity.
- [ ] Conceptual regions are preserved even when composed into fewer visible blocks.

## Navigation and density

- [ ] Local navigation uses tabs, sections, steps, or records intentionally.
- [ ] Tabs are stable sections rather than filters and number approximately six or fewer.
- [ ] Global navigation is not duplicated.
- [ ] Density is declared as comfortable, standard, or dense.
- [ ] Density remains consistent through the primary workspace.

## Health and evidence

- [ ] Each indicator has status, evidence, interpretation, and action when applicable.
- [ ] Freshness or snapshot semantics are clear.
- [ ] Health does not become a universal or unexplained score.
- [ ] Critical attention is distinguished from degraded availability.

## Actions

- [ ] One primary action matches the current state.
- [ ] Labels describe outcomes.
- [ ] Disabled actions explain missing requirements.
- [ ] Long-running actions expose progress and prevent duplicates.
- [ ] Destructive actions are separated and confirmed.
- [ ] Sending, publishing, execution, and AI application require explicit initiation.

## State and responsive review

- [ ] First use is distinct from filtered empty results.
- [ ] Partial failure preserves available regions.
- [ ] Permission language does not expose protected information.
- [ ] Archive does not imply deletion.
- [ ] Loading preserves hierarchy and final geometry.
- [ ] Mobile prioritizes state, action, workflow, critical support, then history.
- [ ] Essential right-rail information moves into mobile flow.
- [ ] Keyboard order follows reading and task order.

## Engineering boundary

- [ ] ALS owns shell, width, spacing, grid, and card primitives.
- [ ] PPB composition owns product structure and state presentation.
- [ ] Feature code owns business logic, status derivation, permissions, routing, and persistence.
- [ ] The product declares `ProductWorkspacePattern` and `ProductDensity`.
- [ ] Structural tests cover the five-region composition.
- [ ] Adoption does not require unrelated domain refactoring.

## Approval record

```text
Product:
Blueprint version:
Dominant pattern:
Density:
Health model:
Primary action:
Local navigation:
History model:
State gaps:
Responsive risks:
Out-of-scope:
Product approval:
Design approval:
Engineering approval:
Date:
```
