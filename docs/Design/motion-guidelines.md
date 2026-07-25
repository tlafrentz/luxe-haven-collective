# Motion Guidelines

Motion communicates continuity and state. It is never decorative.

## Durations

- Fast — 120ms: hover, focus, selected state.
- Standard — 180ms: disclosure and local state change.
- Slow — 240ms: overlay and page-level composition.

Use the standard easing curve `cubic-bezier(0.2, 0, 0, 1)`. Avoid bounce, elastic motion, parallax, and chained fades.

## Patterns

- Buttons may rise 1px on hover and return immediately on press.
- Cards gain elevation only when the full card is interactive.
- Expand/collapse uses native disclosure and no forced height animation.
- Loading uses structured skeletons with a restrained pulse.
- Selection changes color or border without scaling.

## Reduced motion

`prefers-reduced-motion: reduce` disables smooth scrolling, collapses animation and transition durations, and removes hover transforms. Meaning must never depend on motion.

