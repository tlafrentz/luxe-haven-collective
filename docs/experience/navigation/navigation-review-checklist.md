# Navigation Review Checklist

## Destination identity

- [ ] Label represents a real product or necessary conceptual group.
- [ ] Product answers one operator question.
- [ ] Name is explicit and capability-oriented.
- [ ] Product has one primary sidebar location.
- [ ] No placeholder landing page is created for a group.

## Hierarchy

- [ ] Item declares `kind`, `level`, and canonical `parentId` when nested.
- [ ] No visible hierarchy exceeds level three.
- [ ] Parent/child relationship is clear through indentation and active ancestry.
- [ ] Portfolio Intelligence remains below Executive Intelligence below Understand.
- [ ] Deep capabilities move into local navigation or breadcrumbs.

## Ownership and route

- [ ] Route is stable, human-readable, and mapped to the owning product.
- [ ] Legacy paths have an explicit redirect plan.
- [ ] Canonical href is not duplicated.
- [ ] Global and local navigation do not repeat the same choices.
- [ ] Breadcrumbs describe record/workflow depth, not the entire sidebar.

## Interaction

- [ ] Default, hover, focus, active product, active parent, expanded, collapsed, and unavailable states are defined.
- [ ] Group is routable only when a real landing page exists.
- [ ] Collapsed product labels are available to pointer and keyboard users.
- [ ] Active state uses more than color.
- [ ] Navigation selection closes the mobile drawer and restores focus appropriately.

## Badges and state

- [ ] Badge represents actionable attention.
- [ ] Numeric badge affects prioritization and has a maximum.
- [ ] Badge has an accessible label and a resolution rule.
- [ ] Setup-required and degraded states remain distinct.
- [ ] Warning/loading state is not persisted.

## Permissions

- [ ] Required capabilities are declared.
- [ ] Server route and command authorization are independently enforced.
- [ ] Feature flags do not grant authorization.
- [ ] Empty groups disappear after capability filtering.
- [ ] Customer Workspace and Administration remain separate.
- [ ] Permission revocation has a safe redirect and explanation.

## Responsive and accessibility

- [ ] Desktop full and collapsed modes remain understandable.
- [ ] Tablet uses a full-hierarchy drawer.
- [ ] Mobile has adequate targets, wrapping labels, and no icon rail.
- [ ] Keyboard traversal and visible focus are complete.
- [ ] `aria-current`, group expansion, badges, and tooltips are accurate.
- [ ] Drawer focus, Escape, scroll lock, and focus return are verified.
- [ ] Reduced motion and contrast pass review.

## Validation tasks

- [ ] A new user can find Portfolio Intelligence through Understand.
- [ ] A new user can find Guest Communications through Business.
- [ ] A new user can find Connected Systems through Workspace.
- [ ] Navigation backtracking and failed-route analytics reveal no systemic confusion.

## Review record

```text
Destination:
Navigation ID:
Kind and level:
Parent:
Canonical route:
Legacy routes:
Owner:
Question:
Capabilities:
Feature flag:
Setup requirement:
Allowed badges:
Local navigation:
Responsive risks:
Decision:
Reviewers/date:
```
