# Navigation and Product Review Checklist

Use this checklist for every new destination and for material changes to an existing product. The reviewer records evidence or a link beside each item. A destination is not navigation-ready when any required item is unresolved.

## 1. Identity

- [ ] The product has one stable, customer-understandable name.
- [ ] Its mission fits in one sentence without implementation jargon.
- [ ] It answers one primary business question.
- [ ] Its primary user and usage context are named.
- [ ] The proposed navigation label matches the canonical product name or an approved compact label.

## 2. Ownership and boundaries

- [ ] One authoritative capability or record set is named.
- [ ] Referenced products and projections are listed.
- [ ] Explicit non-ownership is documented.
- [ ] No existing product answers the same question or mutates the same records.
- [ ] Cross-product commands pass through the owning application boundary.
- [ ] The product belongs to customer Workspace or internal Operations Console—not both.

## 3. Placement

- [ ] Placement matches operator intent rather than technical implementation.
- [ ] Lifecycle products belong to Observe, Understand, Decide, Execute, or Learn.
- [ ] Systems of record belong under Business.
- [ ] Customer value extensions belong under Services.
- [ ] Customer configuration belongs in Workspace.
- [ ] Internal support, infrastructure, audit, monitoring, and service delivery stay in Operations Console.
- [ ] A new top-level item is justified by a distinct operator responsibility.

## 4. Relationships

- [ ] Inputs, outputs, and principal consumers are documented.
- [ ] IDs, timestamps, versions, and evidence lineage are preserved where required.
- [ ] Freshness semantics are explicit: live projection or point-in-time snapshot.
- [ ] Missing dependencies produce a clear state rather than duplicate logic.
- [ ] Learning and execution feedback paths are defined where applicable.

## 5. Information architecture and workflow

- [ ] The primary workflow begins with operator intent.
- [ ] Essential sections are visible before advanced capability.
- [ ] Parent/child navigation is modeled explicitly.
- [ ] Empty, loading, error, permission, and unavailable states are defined.
- [ ] The future roadmap can fit without renaming or relocating the product.
- [ ] Destructive, sending, publishing, and execution actions require explicit approval.

## 6. UX consistency

- [ ] Shared shell title, group context, and breadcrumbs are correct.
- [ ] Page header states the mission and uses one clear primary action.
- [ ] Overview/health summarizes condition and directs attention.
- [ ] Spacing, cards, states, and action placement follow platform guidance.
- [ ] Mobile layout preserves primary work before supporting context.
- [ ] Links and buttons use correct semantics.
- [ ] Keyboard access, focus, landmarks, labels, status text, and contrast meet the accessibility baseline.

## 7. Engineering contract

- [ ] Navigation uses a stable typed ID, group, route, active-match policy, availability, and capabilities.
- [ ] Route metadata agrees with navigation placement and authorization.
- [ ] Direct route authorization is enforced independently of navigation visibility.
- [ ] Customer and Operations Console routes cannot leak across capability resolution.
- [ ] Navigation order, hierarchy, active matching, duplicate routes, and boundaries have tests.
- [ ] Product documentation uses the canonical product definition template.

## 8. Release decision

- [ ] Product, Experience Design, and Engineering agree on ownership.
- [ ] Security or privacy review is complete where required.
- [ ] Representative data is not presented as persisted production state.
- [ ] Nonfunctional controls are disabled and explained.
- [ ] Success metrics and post-release review owner are named.

## Required review output

```text
Product:
Navigation ID:
Placement:
Primary question:
Owns:
References:
Does not own:
Inputs:
Outputs:
Route and capabilities:
Availability:
Open risks:
Decision:
Reviewers and date:
```
