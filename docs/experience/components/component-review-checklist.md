# Component Review Checklist

## Need and ownership

- [ ] Existing component inventory was searched.
- [ ] Existing primitives cannot compose the requirement cleanly.
- [ ] Component owns one problem.
- [ ] Correct layer is selected.
- [ ] Name describes capability.
- [ ] No product logic leaked into a Primitive or Pattern.

## API

- [ ] Purpose, inputs, outputs, states, and examples are documented.
- [ ] Native element props are preserved where appropriate.
- [ ] Required semantic data is required by types.
- [ ] Variants cannot create contradictory states.
- [ ] Events describe outcomes.
- [ ] Loading and duplicate-action behavior are explicit.

## Visual system

- [ ] Typography uses canonical roles.
- [ ] Spacing uses 8/16/24/32/48/64 tokens.
- [ ] Radius, border, shadow, and status colors use foundation tokens or mapped classes.
- [ ] Motion communicates loading, success, expansion, or hierarchy.
- [ ] Motion is subtle, interruptible, and reduced-motion compliant.
- [ ] Component is consistent with its family.

## Accessibility

- [ ] Correct native semantic is used before ARIA.
- [ ] Accessible name and description are complete.
- [ ] Full keyboard behavior is defined and tested.
- [ ] Focus is visible; managed focus returns logically.
- [ ] Status is not communicated by color alone.
- [ ] Contrast passes WCAG AA.
- [ ] Touch targets meet 44px where interactive.
- [ ] Loading/error/success announcements are proportionate.
- [ ] 200% zoom and mobile reflow work.

## Responsive behavior

- [ ] Desktop, tablet, and mobile behavior are documented.
- [ ] Long labels and translated content do not break structure.
- [ ] Dense information is reduced or restructured on mobile.
- [ ] Essential content does not exist only in hover or a right rail.

## Quality and adoption

- [ ] Structural and semantic tests cover the component contract.
- [ ] Do/Don’t guidance is included.
- [ ] Related components and migration path are named.
- [ ] Compatibility exports do not fork behavior.
- [ ] Another product team can use the component without reading its implementation.
- [ ] Version history and owner are recorded.

## Decision

```text
Component:
Layer:
Existing alternatives:
Consumers:
Accessibility reviewer:
Design reviewer:
Engineering reviewer:
Decision:
Exceptions:
Version/date:
```
