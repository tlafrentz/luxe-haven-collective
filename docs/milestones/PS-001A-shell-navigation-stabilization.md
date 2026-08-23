# PS-001A — Shell & Navigation Stabilization

**Parent:** PS-001 — Platform v1 Customer Readiness Stabilization

**Type:** Stabilization / release gate

**Priority:** P0/P1

**Status:** Active

## Release rule

PS-001 is feature-frozen. No new product scope is authorized during PS-001. Work is limited to stabilization, permanent regression coverage, verification, and defect correction required to pass an approved gate.

## Objective

Operate the customer platform through one canonical shell, one global navigation model, one shared business context, deterministic capability navigation, and canonical route/action contracts. The milestone stabilizes the approved information architecture; it does not redesign the platform.

## Canonical global navigation

```text
CURRENT WORKSPACE
Luxe Haven Collective

Home
Workspace

HPM LIFECYCLE
Observe
Understand
Decide
Execute
Learn

BUSINESS
Properties
Bookings
Guest Communications
Reports

SERVICES
Guidebook Studio
Furnishing Studio          (entitlement-aware)
Investment Intelligence   (only if product policy exposes it as a service)
```

There is no standalone HPM global destination. HPM is represented by the five lifecycle stages. Services are filtered by the canonical authorization and entitlement policy, not page-local conditionals.

## Ownership contracts

- Level 1 global navigation is owned only by `clientWorkspaceNavigation` and rendered by the shared customer shell.
- Level 2 capability navigation appears within content. It may not render another global sidebar.
- Level 3 contextual drill-down does not inherit irrelevant primary tabs and receives a deterministic return target.
- Shared workspace, scope, reporting period, comparison, and basis are owned by `WorkspaceContextProvider`. Local controls may alter analysis, not recreate shared business context.
- Capability-shell actions own Export and overflow. Tabs may not duplicate them. Every visible action must navigate, execute a command, change a filter, open a modal/drawer, open an external target, or be visibly disabled with an explanation.
- Customer paths are built through canonical route helpers or definitions. Components may not concatenate guessed entity paths.

## Lifecycle ownership

| Stage | Question | Capability ownership |
| --- | --- | --- |
| Observe | What is happening? | Revenue Intelligence, Financial Intelligence |
| Understand | Why is it happening, and what deserves attention? | Executive Intelligence, Portfolio Intelligence, Attention, Supporting Signals, Data Quality, property diagnosis |
| Decide | What should we do? | Investment Intelligence, evaluations, scenarios, opportunities requiring decisions |
| Execute | Who will do it, by when, and was it completed? | Action Center, action plans, assignments, recurring execution, evidence |
| Learn | Did it work, and what did we learn? | Outcomes, measured effects, learning, improvement evidence |

No capability may recreate the entire lifecycle inside itself.

## Permanent regression floor

Before PS-001A closes, automated coverage must permanently prevent:

- standalone HPM navigation;
- Guidebook-local global sidebars;
- Investment Reports or Settings primary tabs;
- duplicate Export, overflow, or New Analysis actions;
- Portfolio-local Period or Comparison controls;
- primary Portfolio tabs on contextual Data Quality/property pages;
- guessed property routes and Portfolio property 404s;
- retired parallel Executive workspace navigation;
- inert Attention filters or Action Center views;
- Add Property routing directly to Connected Systems.

The machine-readable foundation is `platformRouteDefinitions` plus `customerRouteSmokeRegistry`. Each safe smoke entry records its route, owning global destination, authorization class, and context behavior. Dynamic entity routes remain registered and require controlled fixture IDs.

## Verification matrix

- Automated: full tests, typecheck, lint, production build, navigation regression suite, registered-route contract suite, and authorization tests.
- Responsive: expanded and collapsed desktop, tablet navigation, and mobile drawer use identical IA and accessible labels.
- Browser behavior: Back/Forward and deep-link refresh preserve applicable shared context, capability tab, contextual filter, and deterministic return state.
- Controlled authenticated smoke: load every registered safe route; reject unexpected 404/500; assert canonical shell, exactly one active global destination, no duplicate global navigation, and no duplicate page actions.
- Manual pass: Home, Workspace, all five lifecycle stages, Properties, Bookings, Guest Communications, Reports, Guidebook Studio, and entitled Furnishing Studio. At each page verify location, purpose, available actions, next destination, and return behavior.

## Definition of done

PS-001A closes only when all engineering gates are green, desktop/tablet/mobile behavior is verified, there are no known P0/P1 shell or navigation defects, controlled production smoke passes, evidence is retained, and synthetic resources are cleaned. Any deployment-only or controlled-identity gate must remain explicitly open until observed; local architectural tests are not production evidence.

## Non-goals

No redesign, new lifecycle stage, new global group, new product feature, Financial Intelligence expansion, Guidebook/Furnishing expansion, or routing-framework rewrite. Multi-bank enhancements, transaction editing/categorization, reconciliation tooling, payments, additional providers, and unrelated Cash Flow work remain outside PS-001A.
