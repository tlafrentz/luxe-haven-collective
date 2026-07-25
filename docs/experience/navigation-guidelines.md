# Navigation Guidelines

## One route, one active destination

Each route has exactly one active product destination. Lifecycle groups may be highlighted as ancestors but never receive `aria-current="page"`.

Route state synchronizes:

- sidebar destination;
- lifecycle group;
- shell title and eyebrow;
- breadcrumbs;
- local tabs;
- context selector.

Exact matching is used for Home. Prefix matching is bounded by a path segment so `/dashboard` does not match every dashboard route.

## HPM lifecycle

Observe, Understand, Decide, Execute, and Learn are peer groups. Products within a lifecycle stage are peers unless one is a true drill-down route. Executive Intelligence and Portfolio Intelligence therefore share the Understand badge and indentation.

## Responsive behavior

Desktop navigation may collapse to labeled icons. Mobile navigation is modal, closes on selection or Escape, restores trigger focus, and prevents background scrolling. Navigation containers never expose horizontal scrollbars.

## Labels

Navigation uses product names, not campaign language. Abbreviations reinforce lifecycle stage:

- OB — Observe
- UN — Understand
- DC — Decide
- EX — Execute
- LN — Learn

