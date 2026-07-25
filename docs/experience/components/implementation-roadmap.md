# Component System Implementation Roadmap

## Phase 1 — Core Foundation

**Implemented foundation:**

- tokens for typography, color, spacing, radius, border, shadow, motion, and touch targets;
- App Navigation and product headers through ALS/NIA;
- primary, secondary, tertiary, and destructive Button;
- Icon Button;
- Text Field;
- Badge;
- Progress;
- Card anatomy;
- Empty, loading, error, attention, degraded, permission, and archived states;
- compatibility exports for legacy `ui/button`, `ui/card`, and `ui/badge`.

**Next Phase 1 increments, built only with consumers:**

- checkbox, radio, toggle;
- search/date/currency/percentage fields;
- confirmation dialog, toast, progress banner;
- overflow menu and dropdown;
- responsive standard table.

## Phase 2 — HPM Components

**Implemented prototypes:**

- Health Summary and Indicator;
- Evidence List;
- Recommendation Card;
- Activity Timeline;
- AI Assistant Panel.

**Next:**

- Executive Brief;
- Recommendation Panel;
- Action Queue;
- Conversation Card/List;
- Report Card;
- Guidebook Progress Card;
- domain timeline compositions;
- AI summary, draft, confidence, and action-suggestion contracts.

Phase 2 components consume public projections and never calculate intelligence or execute actions.

## Phase 3 — Advanced Workspaces

- Investment Workbench
- Guidebook Editor
- Report Builder
- Guest Communications Workspace
- Complex split-view and master-detail templates

Build these after their lower-layer components are validated in real products. Avoid a monolithic “workspace framework” that hard-codes unrelated domain workflows.

## Adoption strategy

1. New work uses canonical components by default.
2. Existing pages migrate when touched for product work.
3. Compatibility exports prevent flag-day rewrites.
4. Duplicated variants are inventoried before removal.
5. Visual regression and accessibility review accompany high-use component migration.

Sprint 2D does not authorize a broad rewrite of mature intelligence products.
