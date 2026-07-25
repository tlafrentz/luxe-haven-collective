# Component Architecture

The design system exposes stable composition boundaries through `@/design-system/*`.

```text
src/design-system/
  tokens/
  primitives/
  patterns/
  hpm/
  templates/
  icons/
  utilities/
```

## Boundaries

| Layer | Responsibility | Examples |
| --- | --- | --- |
| Tokens | Typed, theme-aware decisions | Color, spacing, motion |
| Primitives | Domain-neutral controls | Button, field, badge |
| Patterns | Repeated interaction structures | Header, state, timeline |
| HPM | Hospitality domain expression | Evidence, recommendation, AI |
| Templates | Stable page compositions | Settings, master-detail |

Product-specific components remain in their feature boundary until reuse is demonstrated or strongly justified. The shared system is not a general component dumping ground.

Shared components consume semantic tokens rather than route-specific raw values. Product templates compose content; they do not own business calculations. HPM components display application-layer evaluation and provenance without inventing alternate scores.

The detailed inventory and component contracts remain in [Component Standards](../components/component-standards.md). The canonical exports in `src/design-system` allow migration without requiring a platform-wide rewrite.

## Implementation contract

- Imports use the narrowest appropriate boundary.
- Tokens are typed and centrally defined; CSS semantic variables mirror them.
- Components are composition-first and accept domain content through explicit properties or children.
- Feature code may wrap shared components but must not silently fork their interaction behavior.
- Foundational changes require system review because every consumer may inherit them.
