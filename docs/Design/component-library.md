# Component Library

## Foundations

- `SurfaceCard`: primary, secondary, informational, status, and preview surfaces.
- `SectionHeader`: capability, section title, purpose, and optional action.
- `SemanticBadge` / `Chip`: semantic compact states.
- `PrimaryButton`: canonical high-priority action.
- `TextAction`: low-emphasis navigation action.

## Decision-support cards

- `MetricCard` / `MetricTile`: one label, one value, optional status and supporting text.
- `SummaryCard`: bounded summary context.
- `InsightCard`: interpretation and evidence.
- `DecisionCard`: decision state and action.
- `EvidenceCard`: provenance, confidence, and freshness.
- `StatusCard`: condition, reason, and recovery.
- `PlaceholderCard`: explicit Preview or unconnected capability.

## States

- `EmptyState`: purpose, explanation, and next action.
- `WorkspaceSkeleton`: structured loading without a generic spinner.
- `ExpandablePanel`: reversible disclosure with keyboard-native details/summary.
- `HelpTooltip`: pointer- and keyboard-accessible terminology help.

## Tables and forms

Tables use `.ui-table` for quiet headers, top-aligned reading, restrained row hover, and semantic surfaces. Form controls use `.ui-control`; buttons use `.ui-button`. Both retain 44px minimum targets and tokenized focus rings.

## Usage

Components are compositional and do not own business logic. Feature modules supply labels, values, status, evidence, and actions.

