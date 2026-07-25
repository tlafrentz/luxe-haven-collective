# Component Guidelines

## Headers

Use `WorkspacePage` and `WorkspaceHeader`. Eyebrow, title, purpose, context, and primary action are the canonical header sequence. Page-specific headers must not recreate spacing or typography.

## Cards

Every card has a title and a reason to exist. Metric cards present one primary value, one comparison or explanation, then supporting status. Cards are clickable only when the entire surface performs one clear navigation action.

## Shared components

- `StatusChip`: healthy, attention, unavailable, preview, or neutral status.
- `HelpTooltip`: short definitions for specialized product language.
- `ExpandablePanel`: reversible progressive disclosure.
- `WorkspaceEmptyState`: cause, consequence, and next action.
- `WorkspacePlaceholder`: Preview, Coming Soon, Needs Connection, or Needs Data.

## Forms

Labels remain visible. Selects and date inputs use 44px minimum targets, never overlap, and move to additional rows before becoming compressed. Option capitalization is explicit in content rather than dependent on CSS.

## Tables

Primary values and secondary context occupy separate lines. Cells align to the top. Responsive implementations may switch to cards, but must retain the same labels and reading order without duplicating text.

## Accessibility

All interactive controls provide keyboard operation, visible focus, sufficient contrast, and an accessible name. Selected rows use `aria-selected`; current navigation uses `aria-current`.

