# Application Layout System (ALS-001)

**Version:** 1.0  
**Owner:** Experience Design OS  
**Consumers:** Engineering, Design, Product  
**Status:** Implemented foundation

## Mission

The Application Layout System defines the canonical structure, hierarchy, responsive behavior, and state patterns for every customer-facing Luxe Haven workspace.

The governing question is: **Can a user instantly understand where they are, what they should do next, and how every workspace behaves without relearning the interface?**

ALS favors consistency over local novelty, business hierarchy over decoration, progressive disclosure over density, and decisions over disconnected metrics.

## Canonical shell

```text
AppShell
├── Global navigation
├── Shell workspace header and breadcrumbs
└── Main landmark
    └── WorkspacePage
        ├── WorkspaceHeader
        ├── WorkspaceOverview
        ├── WorkspaceContent
        ├── WorkspaceSupporting
        └── WorkspaceActivity
```

`AppShell` is the authenticated customer shell and delegates navigation behavior to the shared platform shell. It is owned by route-group layouts and must not be recreated inside feature pages. `WorkspacePage` lives inside the shell’s existing `main` landmark and therefore renders a `div`, preventing nested-main accessibility defects.

Only workspace content changes. Navigation position, shell header, responsive drawer, focus behavior, and content gutter remain stable.

## Five-part workspace blueprint

### 1. WorkspaceHeader

**Purpose:** Orient the user and expose current context and next action.

Required:

- One `h1`
- One concise sentence describing the capability
- Optional product/lifecycle eyebrow
- Zero or one primary action group
- Optional context selector

Rules:

- Use at most one visually primary action and one adjacent secondary action.
- Place actions at the upper right on desktop and below orientation on smaller screens.
- Put Workspace, portfolio, property, date range, or scenario selectors here—not again in page content.
- Resource-level dialogs and embedded panels may use their own local headers, but never another `h1`.

### 2. WorkspaceOverview

**Purpose:** Provide immediate situational awareness.

Use three to six highest-value measures or readiness states. Each measure communicates status, meaning, or attention—not only a number. The overview usually uses level-one cards and appears within 32px of the header.

Examples include revenue health, workspace readiness, conversations needing attention, guidebook completion, and learning reliability.

### 3. WorkspaceContent

**Purpose:** Support the product’s primary workflow and receive the greatest visual and spatial emphasis.

Examples include an analysis workspace, conversation thread, report generator, journey designer, or configuration panels. Primary content typically uses level-two cards and the twelve-column grid.

### 4. WorkspaceSupporting

**Purpose:** Supply recommendations, filters, templates, related records, or secondary context without competing with the primary workflow.

It uses an `aside` landmark when rendered through the ALS primitive. Supporting regions normally use level-three cards and appear after or alongside primary content only when space permits.

### 5. WorkspaceActivity

**Purpose:** Explain change over time.

Examples include analysis history, publication versions, recent configuration changes, conversation history, action history, and learning timelines. Activity belongs at the bottom unless history is itself the primary workflow.

Products may omit a region only when it has no meaningful content yet, but the product specification must still define the future state and loading/error/empty behavior.

## Layout grid

The canonical grid is twelve columns on desktop, six on tablet, and one on mobile:

```tsx
<WorkspaceGrid>
  <section className="lg:col-span-8">Primary</section>
  <aside className="lg:col-span-4">Supporting</aside>
</WorkspaceGrid>
```

Maximum page width is 1440px. The shell owns its sidebar and outer content gutter; `WorkspacePage` owns page padding. Feature pages must not add a second centered page container.

## Content widths

| Width token | Maximum | Use |
|---|---:|---|
| `wide` | 1440px | Dashboards, Revenue, Guest Communications, Guidebook Studio |
| `medium` | 1152px | Workspace, Reports, reading-oriented workspaces |
| `narrow` | 768px | Forms, focused setup, review steps |

Choose width from reading and workflow needs, not aesthetic preference.

## Spacing tokens

ALS uses the Tailwind spacing scale with these semantic intervals:

| Token | Size | Intended use |
|---|---:|---|
| XS | 8px | Icon and inline spacing |
| SM | 16px | Related controls and card padding minimum |
| MD | 24px | Card groups and grid gaps |
| LG | 32px | Header-to-overview and major local sections |
| XL | 48px | Supporting and activity separation |
| XXL | 64px | Rare page-level transitions |

Feature work must use these intervals or a component’s built-in spacing. Arbitrary pixel spacing requires design-system review.

## Card hierarchy

Exactly three semantic levels exist:

| Level | Purpose | Treatment |
|---|---|---|
| 1 | Health, overview, executive synthesis | Strongest grouping, 24px radius, white surface and shadow |
| 2 | Primary workspace interaction | 16px radius, bordered white surface |
| 3 | Supporting context, metadata, states | Reduced-emphasis stone surface |

Card level describes information priority, not nesting depth. Avoid placing multiple full cards inside another card when ordinary sections or dividers communicate the relationship.

## State patterns

### Empty

Every empty state answers:

1. What is this?
2. Why does it matter?
3. What should I do next?

Use `WorkspaceEmptyState` with a specific action. Do not use “No data available.”

### Loading

Use `WorkspaceSkeleton`, feature-specific skeletons, or equivalent structural placeholders. Preserve final dimensions, include `aria-busy`, avoid layout shift, and disable animation under reduced-motion preferences. Use spinners only for small actions whose surrounding UI remains stable.

### Error

Use `WorkspaceErrorState` or the feature equivalent. State the failed customer outcome in plain language, provide a bounded recovery action, and optionally disclose technical details. Do not expose provider credentials, stack traces, or internal infrastructure language.

### Unavailable

Disable controls and explain the missing connection or future service. Never simulate successful persistence, sending, generation, execution, or publication.

## Responsive behavior

### Desktop: 1024px and above

- Persistent sidebar
- Twelve-column grid
- Header actions and context aligned right
- List/detail/supporting panes may coexist

### Tablet: 768–1023px

- Drawer navigation
- Six-column grid
- Reduced simultaneous panes
- Summary cards usually become two or three columns

### Mobile: below 768px

- Single-column document flow
- Primary workflow before supporting information
- Horizontally scrollable peer tabs when necessary
- Secondary regions collapse into tabs or disclosed sections
- Actions wrap below header context and remain reachable

Do not reorder DOM content purely for desktop composition if it produces an illogical keyboard or screen-reader sequence.

## Navigation and context

The global navigation is persistent on desktop and available through a focus-managed drawer on smaller screens. Active items use `aria-current`, parent/child hierarchy is explicit, and unavailable destinations are labeled and noninteractive.

Use `WorkspaceContextSelector` in `WorkspaceHeader` for global workspace, portfolio, property, date range, or scenario context. Filters local to a list or chart remain within that workspace.

## Action placement

- Primary: header upper right.
- Secondary: directly adjacent, visually subordinate.
- Contextual row actions: within the affected row or card.
- Destructive: overflow or clearly labelled danger area plus confirmation.
- Mobile task completion: bottom placement is allowed when it remains in logical DOM order.

No header should contain more than two immediately visible actions.

## Accessibility requirements

- One `h1` per workspace and semantic descending headings.
- A single application `main` landmark supplied by the shell.
- Named navigation, section, dialog, form, and status regions.
- Keyboard-operable controls with visible focus.
- Links for navigation and buttons for actions.
- Text or icon reinforcement for all color-coded status.
- WCAG AA contrast.
- Logical source order at 200% zoom and narrow reflow.
- `prefers-reduced-motion` support.
- Skeletons and asynchronous states announced without excessive live-region output.
- Dialog focus containment and restoration when modal workflows are introduced.

Accessibility is a release criterion, not a post-design audit.

## Engineering primitives

Import from `@/components/application-layout`:

```tsx
<AppShell role={role}>
  {children}
</AppShell>

<WorkspacePage width="wide">
  <WorkspaceHeader
    eyebrow="Observe"
    title="Revenue Intelligence"
    description="Monitor revenue performance across your portfolio."
    context={<WorkspaceContextSelector aria-label="Property">...</WorkspaceContextSelector>}
    actions={<PrimaryAction />}
  />
  <WorkspaceOverview>...</WorkspaceOverview>
  <WorkspaceContent>...</WorkspaceContent>
  <WorkspaceSupporting>...</WorkspaceSupporting>
  <WorkspaceActivity>...</WorkspaceActivity>
</WorkspacePage>
```

Also available: `WorkspaceGrid`, `WorkspaceCard`, `WorkspaceSectionHeading`, `WorkspaceEmptyState`, `WorkspaceErrorState`, and `WorkspaceSkeleton`.

## Implementation checklist

- [ ] Customer route uses `AppShell`.
- [ ] Feature root uses `WorkspacePage` with an intentional width token.
- [ ] `WorkspaceHeader` contains the only `h1`.
- [ ] Header description is one sentence.
- [ ] No more than one primary and one secondary header action.
- [ ] Shared context selectors appear in the header.
- [ ] Overview contains three to six meaningful measures when applicable.
- [ ] Primary workflow receives the most space and emphasis.
- [ ] Supporting content cannot be confused with the primary workflow.
- [ ] Activity or history is represented or intentionally deferred.
- [ ] Cards use only levels one through three.
- [ ] Spacing follows the semantic scale.
- [ ] Empty state explains purpose, value, and next action.
- [ ] Loading state preserves final geometry.
- [ ] Error state explains recovery in customer language.
- [ ] Desktop, tablet, mobile, zoom, and long-content behavior are reviewed.
- [ ] Keyboard, focus, landmarks, headings, labels, contrast, and reduced motion pass review.

## Acceptance status

The canonical shell and primitives are implemented under `src/components/application-layout`. Dashboard and portal route groups consume `AppShell`. Workspace, Guest Communications, Reports, and Guidebook Studio consume the shared page and header primitives. New products must use ALS by default; migration of earlier intelligence workspaces can proceed incrementally without changing their domain behavior.
