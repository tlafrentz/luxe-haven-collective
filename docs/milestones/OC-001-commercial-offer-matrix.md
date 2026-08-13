# OC-001 Commercial Offer Matrix

Status: **Approved by Todd for production implementation on 2026-08-12.** This document is the authoritative OC-001 commercial input. Publication remains gated per offer on exact catalog reconciliation, live Stripe mapping, correct entitlement/onboarding resolution, accurate customer presentation, and passed production purchase verification.

Published prices exclude applicable sales tax unless Checkout states otherwise. Required tax must be calculated and disclosed before payment. No manual tax waiver is permitted without documented authority.

## HPM

| Code | Offer | Launch | Price | Limits | Purchase action |
|---|---|---|---:|---|---|
| `HPM-STARTER` | Starter | Yes | $99/month or $950.40/year | 1 property, 2 users | Start Subscription |
| `HPM-GROWTH` | Growth | Yes | $199/month or $1,910.40/year | 3 properties, 5 users | Start Subscription |
| `HPM-GROWTH-PROPERTY` | Additional Growth Property | Add-on | $49/month per property | Growth customers only | Add to Subscription |
| `HPM-PORTFOLIO` | Portfolio | Deferred | Custom proposal | Custom | Unavailable |

Starter targets an independent host operating one property. It includes an HPM workspace, performance overview, prioritized insights/actions, core operating workflows, source/freshness/confidence/limitation disclosures, and standard email support with a two-business-day target. It excludes additional properties, custom reporting, done-for-you operations, Guidebook, Furnishing, and Investment Intelligence. It is strictly capped at one property; the Growth property add-on is ineligible. Expected setup is 1–2 business days after a qualifying data connection. It grants HPM access for one property and two users and routes to HPM onboarding.

Growth targets growing independent operators with up to three base properties. It includes Starter, portfolio views, expanded intelligence/execution support, priority email support with a one-business-day target, three properties, and five users. Additional properties cost $49/month each, require an active Growth subscription, add only property capacity, and must update the subscription and entitlement limit atomically. It grants HPM Growth access for three properties/five users plus purchased property increments and routes to HPM onboarding.

Portfolio remains an internal draft with no active public price, public pricing, purchase action, or live Stripe mapping.

## Guidebook Studio

| Code | Offer | Launch | Price | Included scope | Purchase action |
|---|---|---|---:|---|---|
| `GB-SELF` | Self-Service | Yes | $99 one-time | 1 property, 1 guidebook, 12 months hosting | Buy Now |
| `GB-GUIDED` | Guided Setup | Yes | $249 one-time | 1 property, 1 guidebook, 12 months hosting | Buy Now |
| `GB-DFY` | Done-for-You | Yes | $499 one-time | 1 property, 1 guidebook, 12 months hosting | Buy Now |
| `GB-HOSTING-RENEWAL` | Annual Guidebook Hosting | Renewal | $49/year per guidebook | 12 additional months | Renew Hosting |
| `GB-SELF-ADDITIONAL` | Additional Self-Service Guidebook | Add-on | $79 one-time | 1 additional guidebook and first 12 months hosting | Buy Now |
| `GB-GUIDED-ADDITIONAL` | Additional Guided Guidebook | Add-on | $99 one-time | Guided scope and first 12 months hosting | Buy Now |
| `GB-DFY-ADDITIONAL` | Additional Done-for-You Guidebook | Add-on | $199 one-time | Managed scope and first 12 months hosting | Buy Now |

All Guidebook offers operate without HPM, create a standalone property context, grant no HPM access, keep draft creation separate from publishing, require customer approval before publishing, and permit secure export before hosting ends. Each base/additional guidebook includes 12 months hosting.

Self-Service includes workspace, templates, editor, preview, customer-approved publishing, customer-managed revisions, and standard support. It excludes content creation, done-for-you setup, custom branding, additional guidebooks, and HPM. Availability is immediate after verified activation.

Guided Setup adds guided intake, content-structure assistance, one review call, and one consolidated revision. It excludes full copywriting, unlimited revisions, guest communications, and HPM. Delivery is 5–7 business days after complete inputs.

Done-for-You includes managed setup, organization/drafting from customer information, branded layout, one review call, one consolidated revision, and customer-approved publishing. It excludes photography, legal/accessibility certification, unlimited revisions, ongoing concierge/guest communication, and HPM. Delivery is 7–10 business days after complete inputs.

Hosting renewal extends exactly one guidebook by 12 months and never creates another guidebook. Failure does not immediately delete content. Notice and export/renew opportunities precede expiration; protected access instructions are disabled at expiry. A short transition requires an authorized administrative operation.

## Furnishing

| Code | Offer | Launch | Price | Included scope | Purchase action |
|---|---|---|---:|---|---|
| `FS-CONSULT` | Consultation | Yes | $249 one-time | 1 property consultation | Request Consultation |
| `FS-DESIGN` | Design Plan | Yes | $1,495 one-time | Base 2BR/2BA property | Configure |
| `FS-DESIGN-ROOM` | Additional Room | Add-on | $250 per room | One approved room | Add During Configuration |
| `FS-DESIGN-REVISION` | Additional Revision | Add-on | $150 | One consolidated revision | Admin/Customer Request |
| `FS-FULL` | Full-Service Engagement | Deferred | Custom proposal | Custom | Unavailable |

Consultation includes a pre-call questionnaire; supplied listing/photo/plan/measurement review; a 60-minute virtual consultation; target guest/design direction; preliminary budget range; priority room/product recommendations; and a written summary within two business days. It excludes mood boards, detailed layouts, complete shopping lists, procurement, ordering, delivery coordination, assembly, and installation.

The $249 consultation fee is credited once toward `FS-DESIGN` when purchased within 30 days. The credit is customer- and property-bound, cannot make the amount negative, and must use a registered discount/credit mapping.

Design Plan covers one 2BR/2BA property: living room, dining area, kitchen, workspace, and applicable TVs/mounts. It includes a design profile; cohesive direction; color/material palette; room-by-room plan; customer-measurement layouts; mood boards; curated purchase links; room quantities/budgets; substitutes; STR durability/capacity considerations; one consolidated revision; implementation guide; and presentation/review call. It excludes purchasing, procurement, delivery management, assembly, installation, styling, and photography.

The customer configures scope, Luxe Haven reviews it, and the server calculates the base plus $250 per approved additional room and $150 per approved additional revision, less one eligible consultation credit. Checkout is unavailable before scope approval. Verified payment activates the furnishing project. Full-Service remains deferred, unpublished, and unmapped and makes no procurement/delivery/installation/styling promise.

## Investment Intelligence

| Code | Offer | Launch | Price | Allowance | Purchase action |
|---|---|---|---:|---|---|
| `II-SINGLE` | Single Analysis | Yes | $199 one-time | 1 analysis credit | Buy Now |
| `II-BUNDLE` | Analysis Pack | Yes | $399 one-time | 5 analysis credits | Buy Now |

Both operate without HPM and grant no HPM access. They produce persisted decision-ready analyses, separate user assumptions from provider observations, disclose provider limitations/fallbacks, retain saved analysis access, and consume credits atomically.

Single includes one credit, one persisted analysis, financial outputs, market evidence, score/recommendation, and saved opportunity access. A materially new analysis/reanalysis consumes a credit; a retry for verified platform failure does not. The single credit does not expire under this version.

Analysis Pack includes five account-bound, non-transferable credits and priority support. Credits expire 12 months after purchase. Used credits are non-refundable; each materially new analysis consumes one. Credits consumed by verified platform failure may be restored administratively.

## Deferred Launch Bundle

`BUNDLE-LAUNCH` remains an internal draft with no price, Stripe mapping, publication, or entitlements. It may be reconsidered only after individual products pass production purchase verification.

## Approved commercial policies

- Pending Checkout may be cancelled at any time. HPM cancellation is effective at paid-term end. One-time services may be cancelled before work begins; earlier termination/exceptions require authorization.
- One-time/service fees are refundable before work begins. After work begins, refunds are limited to undelivered scope. Subscription charges are non-refundable after term start except where law requires. Partial refunds, goodwill credits, and launch-stage exceptions require Todd’s approval.
- HPM renews monthly or annually. Guidebook hosting renews annually at $49 per guidebook. Material price/terms changes require advance notice. Entitlements follow provider-confirmed payment state.
- HPM upgrades may be immediate with provider proration. Downgrades take effect at renewal and cannot reduce below current usage. Starter cannot buy the Growth property add-on.
- HPM failed payments have a seven-day grace period; suspension after grace preserves data. Guidebook expiration follows its notice/transition policy.
- Completed/exportable deliverables remain accessible where included. Editing, hosting, and provider-dependent intelligence may end with entitlement. Cancellation/refund never automatically deletes artifacts.
- Complimentary/discounted access requires an approved administrative offer or grant, exact scope and entitlements, reason, and expiration/review date; it grants no unrelated access.
