# Luxe Haven Application Design System v1

**ID:** DS-001  
**Version:** 1.0  
**Owner:** Experience Design OS  
**Consumers:** Product, Engineering, Growth, Strategy  
**Status:** Adopted

## Decision

Luxe Haven Application Design System v1 is the default system for all new customer-facing application work. Workspace is the first reference implementation. Existing products migrate incrementally. Exceptions are documented and reviewed rather than introduced silently.

## Mission

The system lets Luxe Haven scale into a complete Hospitality Performance Management operating system without losing clarity, consistency, accessibility, or quality.

## Seven layers

```text
Brand Foundations
      ↓
Design Tokens
      ↓
Primitives
      ↓
Patterns
      ↓
HPM Components
      ↓
Product Templates
      ↓
Governance and Documentation
```

The system governs customer software, intelligence and operational workspaces, services, future portals, and the internal Operations Console. Internal products may use a different density or dark surface while preserving semantic tokens, interaction, state, and accessibility.

## Principles

- Premium means calm hierarchy, exact language, strong information presentation, and considered interaction—not ornament.
- Intelligence is communicated as State → Evidence → Interpretation → Decision or Action.
- Comfortable, standard, and dense products share one visual language.
- Consistency reduces relearning across navigation, forms, states, filters, history, and actions.
- Accessibility exists in tokens, components, templates, content, and testing.
- Recurring product needs justify components; visual novelty does not.

## Prior foundations

DS-001 incorporates and governs:

- [ALS-001](../application-layout-system.md): shell, layout, widths, rhythm, states
- [PPB-001](../product-page-blueprint.md): product anatomy, workflows, health, actions, history
- [NIA-001](../navigation/navigation-architecture.md): hierarchy, routes, permissions, responsive navigation
- [CS-001](../components/component-architecture.md): component layers, APIs, accessibility, documentation

Those specifications remain detailed canonical references. DS-001 resolves conflicts in favor of the newest explicit decision.

## Engineering boundaries

Stable imports:

```text
@/design-system/tokens
@/design-system/primitives
@/design-system/patterns
@/design-system/hpm
@/design-system/templates
@/design-system/icons
@/design-system/utilities
```

Shared components solve reusable problems. Feature-specific components remain inside their feature until reuse is demonstrated. The design system never becomes a dumping ground for route-specific code.

## Current implementation state

- Typed and CSS semantic token foundations exist.
- ALS, PPB, NIA, and Phase 1 component standards are implemented.
- Initial HPM evidence, recommendation, health, AI, and activity components exist.
- Workspace is the reference composition.
- Light remains the default while dark/system adoption proceeds surface by surface.
- High-complexity tables, dialogs, charts, and advanced workspaces follow the adoption plan rather than claiming premature readiness.
