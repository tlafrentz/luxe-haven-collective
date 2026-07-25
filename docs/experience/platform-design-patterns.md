# Platform Design Patterns

Status: Canonical  
Sprint: PI-UX-002B

## First-viewport contract

Every platform screen establishes, in order:

1. capability or lifecycle stage;
2. page title;
3. one-sentence operator purpose;
4. context and primary action;
5. primary insight or workflow.

Supporting evidence, history, and configuration follow the primary workflow.

## Progressive disclosure

Dense explanation uses the sequence overview → expand → inspect → edit → execute. Expandable regions use native `details`/`summary`, remain keyboard operable, and display both `Show details` and `Hide details`.

## Surface hierarchy

- Level 1: primary insight or workflow, `rounded-3xl`, restrained shadow.
- Level 2: standard content card, `rounded-2xl`, white surface.
- Level 3: supporting, unavailable, or placeholder content, quiet stone surface.

Dark surfaces are reserved for a true primary command or insight—not arbitrary summary rows.

## Affordance

Links and buttons have visible hover and focus states. Selected controls use `aria-current` or `aria-selected`. Disabled and preview actions use subdued contrast, `disabled` or `aria-disabled`, and explanatory text.

## Contextual help

Specialized terms such as Confidence, Freshness, Availability, and Evidence use the shared `HelpTooltip`. Tooltips are reachable by pointer and keyboard and supplement, rather than replace, visible labels.

