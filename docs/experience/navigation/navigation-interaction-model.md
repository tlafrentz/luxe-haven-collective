# Navigation Interaction Model

## Canonical states

### Default

Products use neutral text and icon treatment. Concept groups use quieter uppercase labels. Full descriptions do not appear under customer product entries.

### Hover

Available products receive a subtle background and stronger text. Hover never substitutes for active or focus state.

### Focus

All links and controls show a high-contrast focus ring with offset. Collapsed labels and tooltips are keyboard-accessible. DOM order follows visible hierarchy.

### Active product

The exact or prefix-matched product receives a contrasting background, text, icon, and `aria-current="page"`. Selection is not communicated by color alone.

### Active parent and group

Ancestors receive stronger text without `aria-current`. They remain visibly subordinate to the selected product. This lets Understand and Executive Intelligence show continuity while Portfolio Intelligence remains current.

### Expanded

Groups expose descendants and use `aria-expanded`. HPM groups are expanded by default. Future collapsible groups use a labelled button and announce state.

### Unavailable preview

A preview product remains noninteractive unless a route and preview capability exist. It shows a concise availability badge and accessible status. Permission denial is never represented as preview.

## Workspace context

The current workspace appears directly below the Luxe Haven identity. A switcher is introduced only when multiple workspaces and a real selection command exist; until then, context is text rather than a fake dropdown.

## Labels and descriptions

Approved labels:

- Home
- Workspace
- Revenue Intelligence
- Executive Intelligence
- Portfolio Intelligence
- Investment Intelligence
- Action Center
- Learning Intelligence
- Properties
- Bookings
- Guest Communications
- Reports
- Guidebook Studio
- Administration

Avoid Analytics, Insights, Tools, Resources, Manage, More, or miscellaneous buckets. Customer product descriptions belong in headers, first-use states, accessible descriptions, or collapsed tooltips—not permanently beneath every item.

## Icon semantics

One consistent icon family and stable semantic mapping:

| Product | Semantic role |
|---|---|
| Home | Home |
| Workspace | Settings/building |
| Revenue Intelligence | Trend |
| Executive Intelligence | Overview/gauge |
| Portfolio Intelligence | Portfolio/layers |
| Investment Intelligence | Analysis |
| Action Center | Execution/check |
| Learning Intelligence | Learning/loop |
| Properties | Building |
| Bookings | Calendar |
| Guest Communications | Message |
| Reports | Document |
| Guidebook Studio | Book/map |
| Administration | Controls/shield |

Icons never carry meaning alone or use decorative color as product identity.

## Badges

Only actionable state receives a badge:

- unread or urgent guest conversation;
- actions due;
- integration attention;
- failed report delivery;
- unfinished setup.

Counts are capped at `maximum` such as 99+. A low-detail attention condition may use a dot. Badges include an accessible label and disappear when resolved. Static “new,” inventory totals, and vanity counts are prohibited.

`NavigationBadgeDefinition` declares allowable badge semantics; live values come from a safe navigation projection and are never hard-coded in configuration.

## Selection

Selecting an available destination records its stable navigation ID and canonical route, then closes a mobile drawer. Selecting a group does not navigate. Disabled or preview entries do not emit successful-selection analytics.

## Persistence

Persist:

- expanded/collapsed desktop sidebar;
- future optional group expansion;
- last selected workspace after workspace switching exists;
- safe recent product context.

Do not persist warning counts, loading state, unauthorized routes, or unsaved destructive workflow state. Active route always wins over stored presentation preferences.
