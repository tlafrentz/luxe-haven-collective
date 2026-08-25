# FS-008D Catalog Baseline

## Authoritative business input

- Source filename: `Catalog Review (1).xlsx`
- Preserved copy: `docs/evidence/FS-008D/source/Catalog Review (1).xlsx`
- SHA-256: `ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823`
- Source timestamp observed: 2026-08-25 15:22 (workbook ZIP entries)
- Import status: unverified seed only; no publication or activation
- Superseded inputs: earlier Catalog Review and Todd Furniture Calculator workbooks

The source workbook is retained unchanged. Any future business update must be a newly versioned workbook; the preserved copy is never overwritten.

## Workbook inventory

Visible sheets: Dashboard, Catalog Review, Gap Register, Room Standards, Vendors, Source Reference, and Data Dictionary.

The importer must preserve workbook/sheet/source-row lineage, content hash, upload timestamp, correlation ID, and deterministic replay. Formula, macro, unsafe URL, malformed file, and unsupported-format checks remain mandatory. Rows marked Needs review remain unavailable.

## Approved baseline recorded from requirements

Two-bedroom/two-bath property, up to six guests, warm-modern style; two queen beds and a queen sleeper sofa; living room, two bedrooms, dining, kitchen, two bathrooms, workspace; 55-inch TVs for living room and both bedrooms with compatible mounts, surge protection, and cable management; target $11,000–$14,000; exception ceiling $15,500 with explicit approval. Products and delivery included; tax, assembly, installation, mounting labor, and service fees excluded. Retailers: Costco, Walmart, Amazon, Wayfair, and IKEA.

## Safe-state boundary

FS-008D catalog import, product activation, offer activation, package approval, customer publication, and project catalog visibility remain disabled. No checkout, entitlement, onboarding, project, procurement, installation, notification, retailer, or provider effect is authorized during baseline or closure.

## Baseline limitation

This is a read-only source inventory. No implementation, import, publication, catalog activation, or Production change has occurred.

## Existing architecture inventory

Persistence already contains the legacy Furnishing Studio tables (`furnishing_projects`, package/variant/room/item tables, retailer/product-option tables), canonical FS-001 product/catalog tables (`furnishing_products`, `furnishing_rooms`, package/version/plan tables), FS-002 catalog-import tables, FS-003 room-package requirements, FS-004 design profiles, FS-005 workspace, FS-006 procurement, FS-007 installation, CA-001 commercial offers/entitlements, OC-001 approved offers, and FS-008A activation controls. FS-008C adds project/onboarding snapshots and RPCs but no FS-008D catalog model.

Relevant migration/RLS/RPC inventory: `20260806056000`–`64000` (FS-001–007), `20260803040000` and `20260806057000`–`59000` (legacy Studio/catalog/package/style), `20260812130000`–`34000` (OC-001 commerce), `20260825010000`–`20000` (FS-008A), and `20260825030000`–`37000` (FS-008C). Existing RLS is workspace/member or Admin scoped; authenticated writes are commonly restricted to canonical commands/RPCs. Existing FS-008A triggers block downstream Furnishing effects while disabled. No governed FS-008D import/approval/read/publication RPC exists.

Existing application entry points include Admin Furnishing package/product/room/style/import/requirements/rules/activation/procurement/installation/project routes, customer purchase/configure/property/checkout/confirmation routes, `furnishing-catalog.ts`, `commerce-checkout.ts`, `furnishing-design.ts`, `furnishing-project-workspace.ts`, Stripe webhook handling, and notification/provisioning adapters. Production composition is Supabase-backed through server clients and platform barrels; no catalog worker or safe spreadsheet importer is currently identified. Customer catalog publication and project snapshot callers are absent and must be introduced only through the bounded FS-008D commands.

## Workbook-to-domain mapping

| Workbook field | Canonical target | Rule |
|---|---|---|
| Product ID | product.stable_id | Required, unique; duplicate is review-required |
| Room | room_template + package_item.room_code | Normalize to explicit approved room template |
| Category / Item | product.category/subcategory/name | Required identity fields |
| Retailer | retailer_offer.retailer | Allowlist only |
| Quantity | package_item.quantity | Positive canonical number; never trust extended cost |
| Unit price | retailer_offer.unit_price | Currency required; freshness checked |
| Extended cost | derived budget field | Recalculate quantity × pack quantity × unit price |
| Priority | package_item.priority | Required/important/optional normalized |
| Source status / Review status | import_row.result + review_state | Never auto-approves |
| Procurement class | package_item.supply_treatment | Durable and replenishment separated |
| Supply treatment | package_item.supply_treatment | Allowlisted controlled enum |
| Source URL | retailer_offer.trusted_url | HTTPS, retailer host, no unsafe redirects |
| Variant/specifications | product specifications | Structured and completeness validated |
| Substitution | substitution policy/approved alternates | Explicit compatibility review |
| Last verified | retailer_offer.last_verified_at | Freshness policy input |
| Source row | import_row.source_row | Immutable lineage |

Missing canonical fields (seller classification, pack quantity, delivery assumption, regional restriction, availability, verification source, dimensions/material/color, TV/mount compatibility) remain incomplete until mapped or explicitly reviewed. Unsupported columns are retained as sanitized source metadata, never as executable input.

## Formula policy and import contract

Spreadsheet formulas are never executed or trusted. The importer distinguishes raw cell value, formula expression, cached displayed result, and server-calculated value. Dashboard formulas (21 observed) are provenance-only and are ignored for catalog writes. Catalog Review `Extended Cost` is the sole approved derived field: typed raw Quantity × typed raw Unit Price is recalculated server-side, rounded to cents, and stored as canonical value. The cached workbook result is compared only for evidence: an exact cent match is `valid_derived_value`; a mismatch is `needs_review`; missing/invalid inputs are `invalid`.

Every accepted derived cell records sheet, address, source row, formula-present flag, sanitized formula hash, cached value, canonical value, match result, and import correlation ID. Formula text is never used in application logic or exposed to customers. Formulas in identity, room, item, retailer, quantity, price, status, URL, specification, substitution, verification-date, or supply-treatment fields are rejected. External references, remote/dynamic functions, macros/VBA, DDE, formula-generated URLs, hidden executable payloads, unsupported locations, and formula errors fail closed. A derived formula never compensates for missing raw inputs. Required tests cover all observed Dashboard/Catalog Review formulas, replay, stale caches, changed raw inputs, unsafe formulas, rounding, and proof that no spreadsheet evaluator is invoked.

## Domain and boundary assessment

Products, retailer offers, room templates, package versions, package items, catalogs, and immutable project snapshots must be separate entities. Legacy package/room/product-option tables are useful read/history sources but do not satisfy governed versioning and retailer-offer separation by themselves. Supply treatment maps `durable_furnishing`, `initial_setup_only`, `recurring_replenishment`, `initial_and_recurring`, or `excluded`; recurring amounts are excluded from the one-time package total.

Import boundary: authenticated Admin upload → immutable copy/hash → bounded parser → formula/macro/URL/type validation → normalized row ledger → duplicate resolution → preview → explicit row approval → draft catalog/package version. Every mutation requires expected version, reason, correlation, idempotency, and immutable audit. Publication/activation are separate commands and are disabled by FS-008A. No importer calls retailers, checkout, notifications, procurement, or installation.

Duplicate rules: exact content replay returns the prior import; changed replay is rejected; duplicate product IDs require resolution; one product may have multiple retailer offers; duplicate URLs/SKUs are review-required; shared TVs/mounts are one product with multiple room allocations; conflicting identity never silently merges.

## Journeys and integration boundaries

| Journey | Allowed in FS-008D | Explicit exclusion |
|---|---|---|
| Admin import/review/approve/pause/retire | Yes, audited commands | Direct table edits and price overrides |
| Eligible FS-DESIGN project catalog read/select | Only approved active version after later controlled enablement | Draft/review data and FS-CONSULT interactive catalog |
| FS-CONSULT | Historical/read-safe exclusion | Complete interactive catalog |
| FS-008C project | Immutable catalog snapshot only after approved selection | New onboarding/project creation |
| FS-008B | No checkout/entitlement changes | Commerce redesign |
| FS-005/006/007 | Consume approved snapshot only; no procurement/install transitions | Orders, procurement, installation |
| FS-008E–G | Inactive | Notifications, launch, cohort activation |

## Completeness and validation matrix

| Area | Required baseline | Current gap to resolve |
|---|---|---|
| Living room | Seating, sleeper sofa, 55-inch TV, mount/surge/cable | Workbook rows/specifications/offer freshness |
| Primary/second bedroom | Queen bed each, 55-inch TV each, compatible mount | Explicit per-room allocations and six-guest proof |
| Dining | Seats six | Dining quantity/specification missing until verified |
| Kitchen | Functional setup for six | Completeness and replenishment classification |
| Bathrooms | Two explicit bathroom templates | Shared “Bathrooms” rows require split mapping |
| Workspace | Approved functional workspace | No generic workspace acceptance without spec |
| Entry/shared | Only if approved | Workbook gap/decision required |
| Delivery | Included and budgeted | Delivery source/assumption must be recorded |

Retailer allowlist is Costco, Walmart, Amazon, Wayfair, and IKEA. Validate HTTPS URL, retailer host, seller classification, SKU/ASIN, exact variant, regional availability, price currency, timestamp freshness, delivery assumption, and replacement lineage. Unsupported retailer, stale/unavailable offer, missing specification, or unverified seller remains unavailable.

Budget contract: calculate durable subtotal, initial-setup subtotal, recurring estimate separately, delivery, room totals, required/optional totals, missing/stale exposure, preferred/alternate totals, target variance, and exception status. Outcomes are `below_completeness_floor`, `within_target`, `above_target`, `exception_required`, `above_ceiling`, or `indeterminate`; below $11,000 is not favorable when required scope is incomplete. $11,000–$14,000 is target; $14,000–$15,500 requires reasoned Admin exception; above $15,500 is denied.

## Workbook-specific findings register

| ID | Priority | Finding / impact | Correction boundary | Dependency | Disposition |
|---|---|---|---|---|---|
| FS008D-F01 | P1 | Seed rows are not a governed immutable import ledger | Add hashed, row-lineaged import pipeline and replay rules | Workbook hash, storage, parser | Fix now |
| FS008D-F02 | P1 | Product identity and retailer offers are conflated in seed shape | Separate product/offer/package-item models | FS-001/002 schema | Fix now |
| FS008D-F03 | P1 | Required room, six-guest, TV/mount, workspace and dining completeness is not proven | Readiness evaluator with explicit room allocations | Approved room standards | Fix now |
| FS008D-F04 | P1 | Prices, delivery, seller, URL and freshness are not verified | Offer validation and stale/unavailable policy | Retailer verification policy | Fix now |
| FS008D-F05 | P2 | Supply treatment and recurring replenishment are not budget-separated | Controlled supply-treatment enum and budget engine | Finance/package policy | Fix now |
| FS008D-F06 | P2 | Approval/publication/activation boundaries are incomplete | Admin audited commands and FS-008A gates | FS-008A controls | Fix now |
| FS008D-F07 | P2 | Project snapshot and customer/Admin catalog journeys are not wired | Immutable snapshot boundary and authorized projections | FS-005, FS-008C | Fix now |
| FS008D-F08 | P3 | Entry/shared room and delivery assumptions remain business decisions | Record explicit decision or mark unavailable | Todd/content review | Pending decision |

## Vertical implementation plan

1. **Content decisions (Todd):** confirm row mappings, entry/shared-room inclusion, exact dining/workspace standards, seller/retailer acceptance, price-freshness window, delivery assumptions, substitution rules, and exception approval authority.
2. **Engineering immediately:** canonical migrations/models, import ledger/parser, formula-safe normalization, duplicate resolver, RLS, readiness/budget services, immutable package versions, audited Admin commands, safe projections, and project snapshot RPC.
3. **Integration:** connect FS-008A gates; consume FS-008C project identity; preserve FS-005/006/007 downstream ceiling; add platform composition and no-direct-write tests.
4. **Verification:** focused import/readiness/Admin/snapshot suite, clean PostgreSQL reset/RLS/concurrency/rollback/cleanup rehearsal, existing FS-008A–C and FS-005–007 regressions, full gates, and one documented evidence-substitution limitation if live authenticated rehearsal remains unavailable.
5. **Production:** deploy disabled, verify parity and zero active catalog/cohort/resources, commit closure evidence, and tag only after read-only safe-state verification. No FS-008D import or activation occurs during closure.

Decision-dependent work is limited to the content items in step 1. Technical work in step 2 may begin only after this baseline is reviewed and accepted; no implementation or Production change has begun in this checkpoint.

## Catalog-authority convergence rule

FS-001/FS-002 canonical tables are the sole writable FS-008D authority for products, retailer offers, packages, package versions, room/package allocations, lifecycle/publication state, and project catalog snapshots. All FS-008D imports, commands, Admin workflows, customer projections, and snapshots use canonical identifiers and do not dual-write.

The `20260803040000_furnishing_studio.sql` model is `legacy_read_compatibility` only. It has no FS-008D lifecycle, publication, write, or snapshot authority. Existing records remain preserved and readable through a compatibility adapter where required. Direct legacy writes are prohibited by architecture tests; no destructive migration or Production rewrite is authorized.

Legacy reconciliation is a forward-only, idempotent, governed backfill: inventory legacy rows, match only deterministic compatible identities, record legacy-to-canonical mappings, create canonical draft/review-required records only when safe, and route ambiguous/incomplete records to Admin reconciliation. Similar names or URLs alone never merge. Reconciliation cannot publish, activate, assign customer content, call retailers, or create downstream effects.

The existing `furnishing_catalog_imports` table remains an operational ledger, not catalog authority. FS-008D may extend it only compatibly or add narrowly scoped import-run/row-result records containing immutable workbook hash/source, correlation/idempotency, expected version/state, sheet/cell/source-row lineage, formula evidence, canonical product/offer resolution, package/version binding, replay conflict, and sanitized audit history. Import rows point to canonical entities and never become a second product/package authority.
