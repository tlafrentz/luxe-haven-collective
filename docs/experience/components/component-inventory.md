# Canonical Component Inventory

## Status legend

- **Implemented:** reusable production foundation exists.
- **Prototype:** contract exists and is ready for feature validation.
- **Specified:** behavior is defined; build when a consuming product needs it.

## Navigation

| Component | Layer | Status | Responsibility |
|---|---|---|---|
| App Navigation | Pattern | Implemented | Customer or Operations navigation landmark |
| Navigation Group | Pattern | Implemented | Concept grouping and active ancestry |
| Navigation Item | Pattern | Implemented | Product route, focus, hover, active state |
| Navigation Badge | Primitive/pattern | Specified | Actionable count or attention |
| Workspace Switcher | Pattern | Specified | Real multi-workspace selection |
| User Menu | Pattern | Prototype | Identity and account actions |

## Headers and layout

| Component | Layer | Status |
|---|---|---|
| Workspace/Product Header | Pattern | Implemented |
| Section Header | Pattern | Implemented |
| Panel Header | Pattern | Specified |
| Inline Header | Pattern | Specified |
| Sticky Header | Pattern | Specified |
| Product Page regions | Template | Implemented |

## Health and evidence

| Component | Layer | Status |
|---|---|---|
| Health Summary | Product pattern | Implemented |
| Health Indicator/Card | Product | Implemented |
| Status Badge | Primitive | Implemented |
| Evidence List | Product | Implemented |
| Recommendation Card/Banner | Product | Implemented |
| Executive Brief | Product | Phase 2 specified |

Every health component uses Status → Evidence → Interpretation → Recommended Action.

## Cards

The shared anatomy is `Card` → `CardHeader` → `CardContent` → optional `CardActions`.

| Family | Layer | Status |
|---|---|---|
| Base Card | Pattern | Implemented |
| Metric/Summary/Insight | Pattern/Product | Specified through composition |
| Recommendation | Product | Implemented |
| Property | Product | Existing; migration candidate |
| Conversation | Product | Phase 2 |
| Report | Product | Phase 2 |
| Guidebook | Product | Phase 2 |
| Action | Product | Phase 2 |

Cards are not miniature pages and do not create their own global navigation or unrelated workflows.

## Tables and lists

| Family | Status | Shared behavior |
|---|---|---|
| Standard/Compact Table | Phase 2 | Semantic headers, sorting, loading, empty result |
| Property/Booking/Report/Action Table | Phase 2 | Compositions of shared table |
| Activity Timeline | Implemented | Time, event, supporting result |
| Evidence List | Implemented | Statement, source, observation time |
| Conversation/Recommendation/Task/Property lists | Phase 2 | Selection, state, keyboard semantics |

Pagination, bulk selection, responsive collapse, and sticky headers are opt-in behaviors—not automatic complexity.

## Forms

| Component | Status |
|---|---|
| Text Field | Implemented |
| Currency/Percentage Field | Phase 1 next |
| Property/Workspace Selector | Existing context pattern; domain variants next |
| Date Range/Search | Phase 1 next |
| Checkbox/Radio/Toggle | Phase 1 next |
| Stepper | Product Step Nav implemented |
| Upload/Rich Text | Phase 3 |

All fields provide label, validation association, error presentation, help text, disabled state, and success semantics where applicable.

## States and actions

| Family | Status |
|---|---|
| Empty, Loading, Error | Implemented in ALS |
| Attention, Degraded, Permission, Archived | Implemented in PPB |
| Success | Phase 1 next |
| Primary/Secondary/Tertiary/Destructive Button | Implemented |
| Icon Button | Implemented |
| Confirmation Dialog/Toast/Progress Banner | Phase 1 next |
| Overflow/Dropdown | Phase 1 next |

## Panels and AI

| Component | Status |
|---|---|
| Information/History/Context Panel | Composable from Card; named variants specified |
| Evidence Panel | Evidence List composition implemented |
| Recommendations Panel | Phase 2 |
| AI Assistant Panel | Prototype implemented |
| AI Summary/Recommendation/Draft/Explanation/Confidence/Action Suggestion | Phase 2 |

AI components always disclose AI involvement, preserve confidence explanation where present, produce reviewable output, and never imply autonomous sending, publishing, or execution.

## Templates

| Template | Status |
|---|---|
| Workspace Settings | Reference implementation |
| Product Page | Implemented |
| Dashboard-to-detail | PPB specified |
| Master-detail | PPB specified |
| Report Builder | Phase 3 |
| Guidebook Editor | Phase 3 |
| Investment Workbench | Existing feature; future standards adoption |
