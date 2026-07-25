# Semantic Color

## Families

- Brand: primary, accent, surface, ink
- Surface: canvas, subtle, raised, overlay, inverse
- Text: primary, secondary, muted, inverse, link, disabled
- Border: default, subtle, strong, focus
- Status: positive, attention, critical, neutral, information

Every status supplies foreground, background, border, and icon values in light and dark appearances.

## Rules

- Color never communicates state alone.
- Accent is reserved for interaction and meaningful emphasis.
- Large saturated regions are rare.
- Muted text still meets applicable contrast.
- Customer and Administration experiences share semantic meaning.
- Dark mode is designed through surface hierarchy, not inversion.
- Charts use accessible series distinctions including line style, marker, label, or pattern.

## Appearance review

Review surface separation, text and icon contrast, focus rings, status combinations, disabled states, charts, shadows, and images in every supported appearance.

Explicit light/dark values are defined in typed tokens. CSS aliases maintain compatibility with existing `background`, `card`, `border`, `primary`, and `accent` variables.
