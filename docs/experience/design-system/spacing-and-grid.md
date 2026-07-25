# Spacing and Grid

## Scale

The constrained scale is 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, and 80px.

Semantic aliases:

- `space-inline`: 8px
- `space-control`: 12px
- `space-card`: 24px
- `space-section`: 40px
- `space-page`: 48px

ALS’s 8/16/24/32/48/64 rhythm remains the default for workspace composition. Smaller intermediate values serve component internals.

## Vertical rhythm

Header to overview: 32–40px. Overview to primary workspace: 32px. Major primary-to-support transition: 40–48px. Support to history: 32–48px. Density may compress intervals consistently, not individually.

## Grid

Use a responsive 12-column desktop, six-column tablet, and one-column mobile grid when relationships benefit. Ordinary document flow remains preferable for simple pages.

Widths:

- Narrow 768px: forms and focused setup
- Medium 1152px: Workspace and reading-oriented products
- Wide 1440px: intelligence and guidebook work
- Fluid: master-detail/operational work only when task value justifies it

The shell owns sidebar and global gutter. Product pages own one content container; nested centered page containers are prohibited.
