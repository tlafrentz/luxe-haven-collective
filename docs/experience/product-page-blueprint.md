# Product Page Blueprint (PPB-001)

**Version:** 1.0  
**Owner:** Experience Design OS  
**Consumers:** Product, Engineering, Strategy  
**Status:** Reference implementation

## Mission

PPB-001 defines the reusable experience architecture for every primary Luxe Haven product. ALS-001 owns the application shell, grid, spacing, widths, cards, and foundational states. PPB-001 composes those foundations into a recognizable product story:

```text
Product identity
      ↓
Current state
      ↓
Primary workflow
      ↓
Supporting intelligence
      ↓
History and continuity
```

The governing question is: **What structure should every product page share, regardless of its specific workflow?**

The frame is standardized; the work remains domain-specific.

## Canonical five regions

### 1. Product Header

Answers where the user is, what the product does, the current scope, and the highest-value next action.

Required:

- Product family or lifecycle eyebrow
- One `h1`
- One-sentence purpose
- Current context
- One dominant action when a forward action exists

Optional: secondary action, status badge, date range, property/portfolio/scenario selector, saved view, and overflow menu.

Routine filters follow product identity. Context remains stable within the product. There is never more than one visually dominant action.

### 2. Product Overview / Health

Explains configuration, current condition, material change, and attention before work begins. Use three to six indicators and one stable model per product:

| Model | Best fit | Examples |
|---|---|---|
| Performance | Intelligence | Revenue health, ADR, RevPAR, opportunity |
| Configuration | Workspace | Organization, team, systems, notifications |
| Work queue | Communications, Action Center | Open, attention, waiting, scheduled, urgent |
| Completion | Guidebook Studio | Completion, published state, missing content |
| Publishing | Reports | Recent, scheduled, shared, drafts, delivery issues |

A health indicator requires status, evidence, interpretation, and a recommended action where intervention is possible. Metrics that do not influence a decision belong below the primary workspace or do not appear.

### 3. Primary Product Workspace

Owns the product’s defining workflow and receives the greatest space and interaction priority. It should be reachable without scrolling through extensive supporting material. Save, pending, completion, and unsaved state must be unambiguous.

Approved dominant patterns:

| Pattern | Structure | Suitable products |
|---|---|---|
| Workbench | Inputs/navigation · canvas · evidence | Investment, Guidebook, report builder |
| Master-detail | Collection · selected record · contextual actions | Communications, Properties, Bookings |
| Guided flow | Progress · current step · review | Onboarding, generation, creation |
| Dashboard-to-detail | Summary · priorities · analysis · evidence | Executive, Portfolio, Learning |
| Settings sections | Section navigation · configuration · save state | Workspace |

Each product declares one dominant pattern. A secondary pattern is allowed only for a bounded task, such as opening a guided report generator from a report library.

### 4. Supporting Intelligence and Related Work

Provides context that improves the current decision without competing with the workflow.

Primary support directly affects the task: evidence, recommendations, risks, connection health, AI drafts, or missing content. Secondary support is useful but optional: education, documentation, templates, related records, and historical benchmarks.

Recommendations explain why they matter. Evidence preserves source lineage. Dense support is collapsible or movable, and essential content never exists only in a desktop right rail.

### 5. Activity, History, and Continuity

Distinguishes live state from what happened previously. It identifies time, actor, action, version, and outcome when relevant, and allows meaningful work to resume.

Approved history models:

- Timeline for chronological operational events
- Version list for reports, analyses, and guidebooks
- Activity table for high-volume changes
- Recent-item cards for low-volume product entry pages

Published or immutable records are labelled. Archive never implies deletion.

The regions are conceptually required but may be compositionally integrated. Conversation history may live inside the master-detail workspace, while Workspace configuration activity appears below supporting guidance.

## Product-level navigation

| Model | Use | Constraint |
|---|---|---|
| Tabs | Stable peer sections | Approximately six; never temporary filters |
| Section navigation | Settings and long-form configuration | Stable order and selected state |
| Step navigation | Guided creation | Shows progress, current step, and review |
| Record navigation | Master-detail selection | Preserves route back and selected context |

Local navigation never duplicates the application sidebar. On mobile, tabs may scroll or collapse into a labelled selector.

## Content density

| Profile | Use | Character |
|---|---|---|
| Comfortable | Onboarding, settings, guidebook authoring, first use | More whitespace and guided explanation |
| Standard | Reports, executive products, properties, bookings | Balanced reading and operation |
| Dense | Conversations, action queues, operational tables | Compact but keyboard-operable |

A workspace declares one default profile. Dense information is reduced and prioritized on mobile—not merely compressed.

## Responsive composition

### Desktop

Header → overview grid → primary workspace, with optional support beside it → history. Split views are allowed.

### Tablet

Header actions wrap, overview reduces columns, primary workspace remains first, support moves below or becomes collapsible.

### Mobile

Compact identity → critical status → primary action → primary workflow → expandable critical support → history. Desktop pane arrangements must not compromise task completion or reading order.

## Product specification contract

Before implementation, document:

1. Mission
2. Primary users
3. Core business question
4. Primary action
5. Product health model
6. Dominant workspace pattern
7. Local navigation model
8. Supporting information
9. History model
10. First-use state
11. Attention and degraded states
12. Responsive behavior
13. Permission behavior
14. Success metrics
15. Explicit out-of-scope capabilities

## Engineering boundary

PPB primitives compose ALS primitives and accept domain-owned children. They contain no business calculation, persistence, routing, or feature policy.

```tsx
<ProductPage pattern="settings-sections" density="comfortable">
  <ProductHeader />
  <ProductOverview />
  <ProductWorkspace />
  <ProductSupport />
  <ProductActivity />
</ProductPage>
```

Supporting prototypes include `ProductTabs`, `ProductSectionNav`, `ProductStepNav`, `HealthSummary`, `HealthIndicator`, product-state components, and `ActivityTimeline`.

Workspace is the reference implementation. Other products adopt these compositions incrementally; PPB-001 does not authorize broad feature refactors.
