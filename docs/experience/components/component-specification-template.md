# Component Specification Template

Copy this template for every new canonical component.

```text
# ComponentName

Version:
Layer:
Owner:
Status:

## Mission
One sentence describing the customer or developer outcome.

## Purpose
Why the component exists and the one problem it owns.

## Inputs
Prop name, type, required/default, semantic meaning.

## Outputs
Events, callbacks, navigation, form participation, or rendered semantics.

## Anatomy
Required and optional visual/semantic regions.

## States
- Default
- Hover
- Focus
- Disabled
- Loading
- Error
- Empty
- Selected/expanded where applicable

## Accessibility
- Native semantic or ARIA role
- Accessible name and description
- Keyboard behavior
- Focus behavior/management
- Screen-reader announcements
- Color-independent status
- Contrast
- Touch target
- Reduced motion

## Responsive behavior
Desktop, tablet, mobile, zoom/reflow, and long-content behavior.

## Usage
When to use.

## Do not use
Cases requiring a different component or ordinary HTML.

## Examples
Minimal, common, stateful, and misuse comparison.

## Related components
Components typically composed with or chosen instead.

## Dependencies
Allowed lower-layer dependencies.

## Version history
Date, version, change, migration impact.
```

## Prop design rules

- Prefer semantic props over style toggles.
- Extend native element attributes when the component preserves native semantics.
- Keep required evidence required at the type boundary.
- Use controlled state for application-owned selection.
- Do not accept raw business models when a small public projection is enough.
- Avoid booleans that create contradictory combinations; use explicit variants or discriminated unions.

## Event rules

Name events for user outcomes (`onSelect`, `onConfirm`, `onRetry`) rather than implementation (`onDivClick`). Components never swallow native keyboard behavior or emit domain commands directly.
