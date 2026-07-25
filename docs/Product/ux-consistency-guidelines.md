# UX Consistency Guidelines

## Purpose

Every Luxe Haven workspace should feel like one operating system while preserving the mental model of its product. Consistency applies to hierarchy, interaction behavior, accessibility, and states—not identical page composition.

## Shared page anatomy

1. **Shell context:** lifecycle or product group, stable product title, and breadcrumbs.
2. **Page header:** product mission in plain language and one primary action where appropriate.
3. **Overview or health:** current condition, important counts, readiness, and attention.
4. **Primary workspace:** product-specific information architecture and workflow.
5. **Supporting context:** history, relationships, planned capability, or education.

Do not repeat the shell title without adding useful product context. Primary actions appear at the upper right on desktop and remain visible and unambiguous on mobile.

## Health and overview cards

- Answer a product question, not merely display totals.
- Use counts as evidence of condition: “3 need attention,” not “3 unread.”
- Distinguish healthy, incomplete, urgent, and unavailable states with text and icons in addition to color.
- Never fabricate live state. Representative data is labeled in implementation handoff; disconnected actions remain disabled.
- Health summaries should link or lead to the work that improves them.

## Information architecture

- Expose four to six essential sections before advanced configuration.
- Use section labels based on customer concepts.
- Preserve one selected state and one primary hierarchy at a time.
- Tabs represent peer views; nested navigation represents parent/child capability.
- Filters refine a view and never masquerade as product navigation.

## Empty, loading, error, and unavailable states

### Empty

Explain what will appear, how the customer creates or connects it, and why it matters. Prefer “Connect your PMS to begin…” over “No data.”

### Loading

Preserve final layout dimensions and meaningful hierarchy. Avoid generic full-page spinners when a workspace skeleton is possible.

### Error

State what could not be loaded, preserve safe surrounding context, offer a bounded retry, and avoid exposing provider or infrastructure detail.

### Unavailable

Coming-soon navigation is noninteractive and labeled. A visible action without a connected command is disabled with an explanation; it must not simulate persistence.

## Content and action language

- Headings describe business capabilities.
- Questions express operator intent.
- Buttons use verb + object: “Generate report,” “Manage connections,” “Publish version.”
- “Settings” is reserved for preferences within Workspace, not used as a miscellaneous product.
- “Admin” and infrastructure terminology never appears in the customer workspace.
- AI is described as assistance. Generated work is editable and requires explicit approval before sending, publishing, or executing.

## Layout and responsive behavior

- Use the shared shell gutter and page width appropriate to the work.
- Prefer a single column on small screens; collapse supporting panes after primary work, not before it.
- Horizontal tab sets may scroll with visible focus states.
- Dense list/detail/assistant workspaces become sequential regions on mobile.
- Avoid fixed widths that cause horizontal document scrolling.
- Sticky elements must not obscure headings, anchors, or focus.

## Accessibility baseline

- Use semantic `header`, `nav`, `main`, `section`, `article`, and `aside` landmarks.
- Give every navigation region and icon-only action an accessible name.
- Use buttons for actions and links for navigation.
- Preserve keyboard focus indicators and logical DOM order.
- Selected navigation uses `aria-current`; dialogs use `role="dialog"`, `aria-modal`, and a labelled title.
- Do not communicate status with color alone.
- Meet WCAG AA contrast and support reduced motion.
- Forms have programmatic labels, errors, instructions, and disabled-action explanations.

## Product definition template

Every product specification must define:

- Mission
- Primary users
- Primary business question
- Ownership and explicit non-ownership
- Inputs and outputs
- Information architecture
- Core workflows
- Empty/loading/error states
- Success metrics
- Future roadmap

## Suggested product success metrics

Metrics measure customer outcomes rather than screen activity:

- Time to identify the next important work
- Completion/readiness rate
- Time from insight to committed action
- Decision confidence and evidence coverage
- Guest response and friction outcomes
- Report publication and stakeholder engagement
- Improvement adoption and measured effectiveness

Product-specific metrics belong to the owning product and must not redefine another product’s success.
