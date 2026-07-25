# Shared Component Anatomy

## Health

```text
Label and status
Primary condition
Evidence
Interpretation
Recommended action
```

Required inputs: label, bounded status, evidence, interpretation. Action is required when the customer can resolve or continue the condition. The component emits only the provided action event; domain code derives health.

Do use health to answer the product’s business question. Do not show a score without explanation, mix unrelated dimensions, or calculate health in the component.

## Card

```text
Header: title, description, accessory
Primary content
Supporting content
Actions
```

Header and content are required only when that anatomy improves comprehension; simple cards may use the base surface directly. Actions affect the card’s subject. A card does not contain unrelated page sections, nested page headers, or multiple dominant workflows.

States: default, hover only when interactive, keyboard focus when actionable, disabled only for an actual control, loading through preserved content skeleton, and error/empty through shared state patterns.

## Empty state

```text
Icon
Headline — what this is
Explanation — why it matters
Primary CTA — what to do next
Optional documentation link
```

First-use empty differs from empty search results. Empty state icons are decorative unless they convey status not present in text. CTA follows the page action hierarchy.

## Buttons

| Variant | Meaning |
|---|---|
| Primary | One dominant forward outcome |
| Secondary | Supports the primary workflow |
| Tertiary | Low-emphasis utility |
| Destructive | Consequential removal or revocation |

Button inputs include native button props, variant, size, loading, and optional icons. Output is the native click/form event. Loading disables duplicate action, exposes `aria-busy`, and uses reduced-motion behavior.

Do use outcome labels. Do not use “Submit” when “Publish report” is known, create multiple primaries, or enable a control without a command.

## Text field

```text
Visible label
Control with optional prefix/suffix
Help text or error
```

The field automatically associates description/error, exposes `aria-invalid`, provides visible focus, and retains native input semantics. Domain validation remains outside the primitive.

## Evidence

Each entry contains statement, source, optional observation time, and optional accessible source link. Evidence stays traceable and never becomes decorative “insight” copy.

## Recommendation

```text
Title and priority
Recommended outcome
Rationale
Evidence
Explicit actions
```

The card presents a recommendation but never executes it automatically.

## AI Assistant

```text
AI identity and assistance boundary
Summary or draft context
Confidence plus explanation
Reviewable content
Explicit actions
```

AI components must say that approval is required. Confidence labels without explanations are prohibited. Generated work remains distinguishable from source evidence and human-authored content.

## Timeline

All timeline variants share:

- stable item ID;
- timestamp or ordered metadata;
- actor when relevant;
- event;
- result or supporting detail;
- current vs historical distinction.

Conversation, analysis, publication, and learning timelines may add domain content without redefining chronology or accessibility.
