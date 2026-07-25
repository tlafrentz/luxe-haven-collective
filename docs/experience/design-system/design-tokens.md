# Design Tokens

## Source of truth

Typed tokens live at `src/design-system/tokens`. CSS semantic variables live in `src/app/globals.css`. Shared components consume semantic roles or mapped system classes rather than raw values.

Tokens cover:

- semantic light/dark color;
- typography roles;
- constrained spacing;
- semantic spacing aliases;
- radii;
- elevation;
- motion;
- sizing and content widths.

## Token policy

- Foundation changes are system-wide changes.
- Prefer semantic names such as `textPrimary` over raw `stone950`.
- Status tokens include foreground, background, border, and icon.
- Raw values are allowed only where no reusable design decision exists, such as a data-derived chart position.
- Feature code does not add new “almost the same” spacing, color, or shadow.
- Token changes require design and engineering review plus contrast/visual regression checks.

## Appearance

Light and dark token sets share semantic keys. CSS uses light by default, explicit `data-theme="dark"` for dark, and `data-theme="system"` with `prefers-color-scheme`.

Existing screens remain light until their fixed surfaces are migrated to semantic tokens. Appearance support is released incrementally to avoid partially inverted interfaces.

## Type and CSS alignment

TypeScript tokens support component logic, examples, testing, and non-CSS consumers. CSS variables drive rendered theming. Their semantic keys and values are reviewed together. A future token-build step may generate both from one structured source; DS-001 does not introduce a build dependency prematurely.
