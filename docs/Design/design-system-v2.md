# Luxe Haven Design System v2

Status: Canonical  
Version: 2.0.0  
Sprint: PI-UX-002C

## Visual direction

Luxe Haven is a quiet hospitality operations center: editorial hierarchy, architectural spacing, restrained surfaces, and one intentional teal accent. The system avoids decorative color, heavy elevation, dense dashboard grids, and competing focal points.

## Hierarchy

The canonical reading order is capability → page → section → card → label → value → supporting text. Typography and spacing establish this order before color or decoration.

## Surface hierarchy

- Primary panel: major insight or workflow; 24px radius.
- Secondary surface: standard card; 16px radius.
- Informational surface: quiet supporting content.
- Status surface: semantic state with evidence.
- Preview surface: dashed, subdued, explicitly unavailable.

Elevation uses layered low-opacity shadows. Hover elevation is reserved for genuinely interactive surfaces.

## Accent policy

Teal identifies focus, links, charts, and the single primary action. Gold is limited to brand/editorial comparison context. Semantic colors are reserved for success, warning, critical, information, and neutral states.

## Theme behavior

The document defaults to `data-theme="system"` and supports explicit light and dark themes. Workspace compatibility styles map legacy palette utilities to semantic surfaces while feature code migrates incrementally.

## Governance

New presentation code imports from `@/design-system` or shared application-layout components. New hard-coded colors, arbitrary radii, one-off shadows, or unversioned motion values require design-system review.

