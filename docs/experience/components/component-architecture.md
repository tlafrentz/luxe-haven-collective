# Component Standards (CS-001)

**Version:** 1.0  
**Owner:** Experience Design OS  
**Consumers:** Experience Design, Engineering, Product  
**Status:** Phase 1 implemented

## Mission

The Luxe Haven component system makes product development an act of composition rather than page-by-page reinvention.

The governing question is: **Can every Luxe Haven product be assembled from common components while still expressing its unique workflow?**

Components solve one problem, prefer consistency over uncontrolled variants, include accessibility and responsive behavior at their boundary, and compose rather than inherit.

## Five layers

```text
Foundation
    ↓
Primitives
    ↓
Patterns
    ↓
Product Components
    ↓
Templates
```

### Foundation

Visual and behavioral language with no rendered product or business logic: typography, colors, spacing, grid, radii, borders, shadows, motion, icons, density, and status semantics.

Source: `src/components/foundation`

### Primitives

Small UI elements with no hospitality knowledge: buttons, fields, badges, icon buttons, links, controls, progress, tooltips, menus, and dividers.

Source: `src/components/primitives`

### Patterns

Reusable interaction and information groups: headers, health summaries, empty/error states, filters, context selection, cards, timelines, wizards, drawers, dialogs, split views, and master-detail layouts.

Source: `src/components/patterns`, `application-layout`, and `product-page-blueprint`

### Product Components

Components with stable HPM semantics: evidence, recommendations, revenue health, guidebook progress, conversation cards, action queues, executive briefs, and AI assistance.

Source: `src/components/product`

Product components may understand hospitality language and public domain projections. They do not own queries, commands, routing, authorization, or calculations.

### Templates

Whole product compositions: Workspace, dashboard-to-detail, settings, report builder, guidebook editor, investment workbench, and master-detail communication workspace.

Source: `src/components/templates`

Templates define region composition, not business logic.

## Dependency rule

A layer may depend only on layers below it:

```text
Template → Product → Pattern → Primitive → Foundation
```

Temporary compatibility barrels may re-export canonical components but may not introduce variants or behavior. Foundation never imports React product components. Primitives never import product models.

## Single-responsibility examples

`HealthIndicator` owns status, evidence, interpretation, and action presentation. It does not own status calculation, page layout, filtering, or navigation.

`RecommendationCard` owns recommendation anatomy. It does not execute the recommendation.

`TextField` owns labels, descriptions, error association, focus presentation, and input behavior. It does not validate hospitality business rules.

## Folder and naming rules

```text
src/components/
  foundation/
  primitives/
  patterns/
  product/
    health/
    reports/
    guidebook/
    communications/
    workspace/
    investment/
    learning/
  templates/
```

Current product components may remain at the `product/` root until a family contains multiple components.

Names describe capability: `WorkspaceHeader`, `RecommendationCard`, `ConversationList`, `ActivityTimeline`. Numbered names, `Widget`, `Card2`, `Component`, and context-free `Panel` are prohibited.

## Ownership boundary

The library owns presentation semantics, interaction mechanics, accessibility, responsive behavior, and documented variants. Features own business state, permissions, persistence, orchestration, and customer-specific language.

## Exception process

A product may diverge only when:

1. existing composition cannot express a validated workflow;
2. the difference is documented in the component review;
3. accessibility and responsive behavior remain complete;
4. the exception either becomes a reusable variant or stays explicitly feature-local.

Local visual preference is not an exception.
