# Design Tokens

The source of truth is `src/design-system/tokens/tokens.ts`; runtime CSS variables live in `src/app/globals.css`.

## Token groups

- Color: brand, surface, text, border, semantic status, chart.
- Typography: capability, display, page, section, panel, metric, body, label, caption, metadata, code.
- Spacing: 4–80px scale plus control, card, section, and page roles.
- Radius: control 12px, card 16px, panel/modal 24px, pill full.
- Elevation: none, raised, interactive, overlay, modal.
- Border: width and subtle/strong opacity.
- Opacity: disabled, muted, overlay.
- Motion: 120ms, 180ms, 240ms with professional easing.
- Grid: 12 columns with 16/24/32px responsive gutters.
- Sizing: 44px touch target and narrow/medium/wide content bounds.

## Semantic rule

Feature code consumes semantic roles instead of raw palette values. For example, use `--surface-raised`, not white; `--text-secondary`, not stone-600; `--chart-primary`, not a hex value.

## Dark mode

Light and dark contracts expose identical keys. Dark mode changes semantic values, not component structure or hierarchy.

