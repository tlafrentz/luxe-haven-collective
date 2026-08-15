# Guidebook Studio Product Blueprint

| Field | Definition |
|---|---|
| Mission | Design, publish, and improve the guest experience for each property |
| Primary users | Owner, property manager, guest-experience manager, designer |
| Business question | How do I prepare guests for a successful stay? |
| Primary action | Publish reviewed guidebook version |
| Health model | Completion: readiness, published state, missing content, freshness, guest reach |
| Dominant pattern | Workbench |
| Density | Comfortable |
| Local navigation | Overview, Guest Journey, Content, Recommendations, Brand, Publish tabs |
| Supporting information | Missing experiences, recommendations, content guidance, future Learning evidence |
| History model | Published version list and recent change timeline |
| Success metrics | Guidebook completion, guest reach, reduced repeated questions, measured guest outcomes |
| Out of scope | Property records, reservations, conversations, automatic AI publishing |

First use creates one primary guidebook for a selected property. Attention identifies missing guest experiences and resulting friction. Degraded state preserves authoring when analytics or connected reservation context is unavailable. Permissions distinguish editing, reviewing, and publishing. Archived versions remain historical; restoration produces a new reviewable draft rather than mutating history.

Mobile prioritizes guidebook health, preview/publish action, current journey stage, essential guidance, and publication history.

## Creation Assistant experience

The new-guidebook entry presents Auto-create with AI, Start from a template,
and Start blank. Auto-create is recommended but optional; all three paths enter
the canonical Builder.

The assistant experience is a seven-stage sequence:

1. choose creation method and authorized property context;
2. upload source documents, text, and photos with a visible source checklist;
3. review extracted facts, sources, confidence, missing values, and conflicts;
4. choose an approved template, tone, branding, sections, and language;
5. monitor asynchronous extraction, organization, photo matching, and draft
   creation with safe leave-and-resume behavior;
6. review the generated draft in the shared Builder with lineage, confidence,
   readiness, editing, and section regeneration; and
7. complete the existing human review and publication workflow.

Progress never implies publication. The generation state communicates: “AI
creates a draft. Humans review. Nothing auto-publishes.” Technical component
compatibility is handled in a separate administrator exception lane and is not
shown to ordinary customers.
