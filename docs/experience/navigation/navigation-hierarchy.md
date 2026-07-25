# Navigation Hierarchy

## Maximum depth

The primary sidebar supports three levels.

| Level | Purpose | Examples | Route behavior |
|---|---|---|---|
| 1 | Conceptual group or top utility | Observe, Understand, Home, Workspace, Business, Services | Groups are non-routable; utilities may route |
| 2 | Primary product | Revenue Intelligence, Executive Intelligence, Properties | Normally routable |
| 3 | Subordinate product | Portfolio Intelligence | Routable and used sparingly |

A fourth level moves into product-local navigation, breadcrumbs, or record detail.

## Canonical parent chain

```text
Understand                      level 1, active ancestor
  Executive Intelligence        level 2, active parent
    Portfolio Intelligence      level 3, selected product
```

Portfolio Intelligence never appears as a peer of Understand or as a duplicate Business link. Its deeper indentation, quieter icon, parent continuity, and active treatment communicate its subordinate diagnostic role.

## Indentation tokens

- Level 1: 0px relative inset
- Level 2: 16px relative inset
- Level 3: 32px relative inset plus parent-continuity rule

Indentation is encoded by `NavigationLevel`, not arbitrary page classes. Icons align within their level. Level three uses a slightly quieter icon treatment but retains the same accessible label and touch target.

## Group semantics

Lifecycle stages are `kind: "group"` and non-routable. Products are `kind: "product"`. Home, Workspace, and internal utilities may be `kind: "utility"` or top-level products.

Groups:

- carry the operator-intent question as description;
- are always exposed when an authorized descendant is visible;
- are hidden in icon-only collapsed mode while descendant spacing and tooltips preserve recognition;
- use ancestor emphasis when a descendant route is active.

## Expansion model

HPM lifecycle groups are expanded on desktop because the lifecycle is the product differentiation. Business and Services use structural section headings and visible products. Future optional groups may persist expansion state, but active descendants always force their ancestors open.

Collapse never changes the route or authorization model. Expanded/collapsed preference is user interface state, not navigation truth.

## Duplicate prevention

Typed IDs and unique canonical hrefs are tested. Cross-links may route into another product from relevant content, but do not add a second sidebar placement. Legacy paths redirect to the canonical destination when route migration occurs.

## Deep product navigation

Once inside a product:

- tabs choose peer sections;
- section navigation chooses configuration areas;
- steps navigate a guided flow;
- record navigation chooses a selected record;
- breadcrumbs orient record/workflow depth.

These mechanisms do not restate Observe, Business, or the global product list.
