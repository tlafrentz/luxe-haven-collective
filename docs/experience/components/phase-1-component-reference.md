# Phase 1 Component Reference

All components below are version 1.0 and owned by Experience Design OS. Native HTML attributes remain available unless explicitly stated.

## Foundation

### `componentTokens`

- **Purpose:** Canonical non-rendered typography, color, spacing, radius, shadow, motion, and touch-target values.
- **Inputs/outputs:** No inputs; exports immutable values and density/status types.
- **States:** Not applicable.
- **Accessibility:** Focus color, motion, contrast roles, and 44px target minimum inform consuming components.
- **Responsive:** Breakpoint/grid behavior remains in ALS; tokens are device-independent.
- **Use:** Component implementation and design specification.
- **Do not use:** As product data or runtime theme preference.

## Primitives

### `Button`

- **Purpose:** Trigger one explicit action with consistent hierarchy.
- **Inputs:** Native button props, `variant`, `size`, `loading`, leading/trailing icon.
- **Outputs:** Native click/form events.
- **States:** Default, hover, focus, disabled, loading; destructive is a semantic variant.
- **Accessibility:** Native button, visible focus, `aria-busy`, disabled duplicate prevention, non-color label.
- **Responsive:** 44px standard target; labels may wrap only when consumers allow adequate width.
- **Use:** Primary, secondary, tertiary, and destructive actions.
- **Do not use:** Navigation; use a link.

### `IconButton`

- **Purpose:** Compact action whose visible content is an icon.
- **Inputs:** Required `label`, icon child, native button props.
- **Outputs:** Native click/form events.
- **States:** Default, hover, focus, disabled.
- **Accessibility:** Required accessible name and title; 44px target.
- **Responsive:** Same minimum target on every breakpoint.
- **Use:** Familiar contextual utilities.
- **Do not use:** Unfamiliar actions that require a text label.

### `Badge`

- **Purpose:** Concise status or category label.
- **Inputs:** Content and tone.
- **Outputs:** Rendered status text; no interaction.
- **States:** Neutral, success, warning, danger, dark, info.
- **Accessibility:** Text carries meaning; tone is supplemental.
- **Responsive:** Inline and wrapping.
- **Use:** Status adjacent to its subject.
- **Do not use:** Unexplained score, action, or decorative “new.”

### `TextField`

- **Purpose:** Collect one line of text with consistent validation presentation.
- **Inputs:** Native input props, required label, help text, error, prefix, suffix.
- **Outputs:** Native input/change/focus events.
- **States:** Default, hover through browser behavior, focus, disabled, invalid.
- **Accessibility:** Programmatic label, required cue, associated help/error, `aria-invalid`.
- **Responsive:** Full available width; prefix/suffix remain visible.
- **Use:** Text-like form input.
- **Do not use:** Currency, percentage, search, or rich text once their semantic primitives exist.

### `Progress`

- **Purpose:** Communicate bounded completion.
- **Inputs:** Numeric value and label.
- **Outputs:** Normalized 0–100 progress semantics.
- **States:** Values below/above bounds clamp; animated changes respect reduced motion.
- **Accessibility:** Native progressbar role and min/max/current values.
- **Responsive:** Fluid width.
- **Use:** Determinate completion.
- **Do not use:** Health score, indeterminate loading, or decorative percentage.

## Patterns

### `Card` family

- **Purpose:** Group one coherent subject using header, content, and actions.
- **Inputs:** Base HTML attributes; `CardHeader` title/description/accessory; children and actions.
- **Outputs:** Presentation only; child actions emit their events.
- **States:** Static by default. Consumers add interactive semantics only when the whole card is truly actionable.
- **Accessibility:** Semantic headings and controls come from composition; no false button role.
- **Responsive:** Content wraps; actions wrap; no fixed dimensions.
- **Use:** One bounded summary, recommendation, record, or supporting group.
- **Do not use:** As a page-within-a-page.

### ALS and PPB patterns

`WorkspaceHeader`, five workspace regions, state components, local navigation, health, and activity patterns retain their contracts in ALS-001 and PPB-001. CS-001 classifies rather than forks them.

## Product components

### `HealthSummary` and `HealthIndicator`

- **Purpose:** Present bounded product condition with evidence and meaning.
- **Inputs:** Label, status, value, required evidence and interpretation, optional action.
- **Outputs:** Child action events.
- **States:** Healthy, attention, degraded, inactive.
- **Accessibility:** Group label, status text in addition to color, semantic article.
- **Responsive:** One, two, then four-column composition.
- **Use:** Three to six primary product health dimensions.
- **Do not use:** Universal score or metric without decision relevance.

### `EvidenceList`

- **Purpose:** Preserve traceable support for an interpretation or recommendation.
- **Inputs:** Stable ID, statement, source, optional observation time and source link.
- **Outputs:** Optional source-link navigation.
- **States:** Normal; empty evidence is handled by the parent rather than rendering an unexplained blank list.
- **Accessibility:** Named list, text source, accessible link supplied by consumer.
- **Responsive:** Statements and metadata wrap in source order.
- **Use:** Recommendation, health, analysis, or AI explanation.
- **Do not use:** Generic insight copy without a source.

### `RecommendationCard`

- **Purpose:** Present a recommended outcome, rationale, evidence, and explicit actions.
- **Inputs:** Title, recommendation, rationale, priority, evidence, actions.
- **Outputs:** Child action events.
- **States:** Low, medium, high priority; loading/error belong to the owning region.
- **Accessibility:** Priority uses text and tone; actions remain explicit controls.
- **Responsive:** Content and actions stack/wrap.
- **Use:** A decision-relevant recommendation.
- **Do not use:** Automatically execute or hide rationale.

### `AiAssistantPanel`

- **Purpose:** Establish a consistent human-controlled relationship with AI assistance.
- **Inputs:** Title, summary, optional confidence explanation, reviewable content, actions.
- **Outputs:** Explicit child action events only.
- **States:** Summary/draft content, confidence present/absent; feature owns loading/error.
- **Accessibility:** AI identity and approval boundary are textual; confidence includes explanation.
- **Responsive:** Panel moves below primary work on narrow screens; essential content remains in flow.
- **Use:** Drafting, summarizing, explaining, translating, or suggesting.
- **Do not use:** Imply automatic sending, publishing, or execution.

### `ActivityTimeline`

- **Purpose:** Present chronological continuity.
- **Inputs:** Named timeline and stable items containing title, metadata, optional result.
- **Outputs:** Presentation; future item actions compose explicitly.
- **States:** Normal; empty/history loading use shared states.
- **Accessibility:** Ordered list and text chronology; decorative markers are ignored.
- **Responsive:** Single-column source order.
- **Use:** Low-to-medium volume configuration and product history.
- **Do not use:** High-volume sortable activity better served by a table.

## Templates

### Product page composition

- **Purpose:** Assemble product identity, current state, workflow, support, and continuity.
- **Inputs:** Domain-owned children, pattern, density, width.
- **Outputs:** Child events and navigation.
- **States:** Defined by PPB-001.
- **Accessibility:** One H1, one main landmark owned by AppShell, semantic regions.
- **Responsive:** Defined by ALS-001 and PPB-001.
- **Use:** Primary customer products.
- **Do not use:** Marketing pages or internal operations without deliberate adaptation.

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07-24 | Established foundation, Phase 1 primitives, card pattern, compatibility exports, and initial HPM product components |
