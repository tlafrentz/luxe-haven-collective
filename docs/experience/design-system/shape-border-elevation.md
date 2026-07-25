# Shape, Border, and Elevation

## Radius

| Role | Radius |
|---|---:|
| Control | 12px |
| Card | 16px |
| Panel/overview | 24px |
| Modal | 24px |
| Pill | Fully rounded |

Pills are reserved for buttons, compact status, tags, and intentionally capsule-shaped controls. Primary workspaces should not look like collections of unrelated bubbles.

## Borders

Borders communicate containment, hierarchy, interaction, focus, and state. Use subtle borders for ordinary grouping, default for controls, strong for deliberate separation, and the focus token for keyboard focus.

Avoid outlining every nested region equally.

## Elevation

- None: in-flow surfaces
- Raised: ordinary cards
- Overlay: menus and floating panels
- Modal: blocking dialogs

Most application cards use surface contrast plus a border rather than heavy shadow. Elevation communicates layering and must remain perceptible in light and dark appearances.
