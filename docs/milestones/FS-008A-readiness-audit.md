# FS-008A — Activation Readiness & Controls Audit

**Phase:** Read-only baseline audit (Phase 1)
**Audit date:** 2026-08-24
**Code or Production state changed:** No
**FS-008 activation:** disabled; no checkout, entitlement, project, catalog, notification, or retailer mutation performed.

## Executive result

Furnishing has substantial FS-005–007, CA-001, and PS-001A–E foundations, but the repository does not currently expose one canonical server-side Furnishing activation decision with the required global kill-switch precedence, workspace/cohort controls, capability controls, safe default manifest, and audited Admin control surface. Existing entitlement checks protect project operations, but entitlement is not a substitute for release activation.

**Recommendation:** do not begin implementation beyond a bounded FS-008A controls candidate. The missing release-control boundary is a P1 blocker until implemented and verified. Public marketing pages may remain informational, but public purchase/activation and project creation must remain disabled.

## Inventory

### Customer surfaces

| Surface | Existing implementation | State | Activation concern |
|---|---|---|---|
| Marketing Furnishing | `/furnishing`, `/furnishing/packages`, `/furnishing/packages/[slug]`, `/furnishing/examples`, `/furnishing/rooms`, `/furnishing/faq` | Complete informational surface | No single FS-008 activation decision observed. |
| Purchase flow | `/furnishing/purchase/account`, `select`, `configure`, `property`, `review`, `checkout`, `confirmed` | Partial | Checkout action is reachable for eligible package paths; no FS-008 global kill-switch gate observed. |
| Customer projects | `/dashboard/furnishing`, `/dashboard/furnishing/projects`, `/dashboard/furnishing/projects/new`, `[projectId]` | Partial | `assertFurnishingEntitlement` exists; no release/cohort/workspace activation hierarchy. |
| Design/profile/rooms | `furnishing-design.ts`, project workspace actions and components | Complete domain foundation | Requires activation decision before customer entry. |
| Budget/procurement | `furnishing-procurement.ts`, FS-006 tables/actions | Complete foundation | Retailer ordering and external effects require explicit disabled control. |
| Installation/readiness | `furnishing-installation.ts`, FS-007 routes/tables | Complete foundation | Requires release and tenant controls. |
| States | Components and action error codes exist | Partial | No centralized activation-safe unavailable/denied projection. |

### Admin surfaces

Existing Admin routes include `/admin/furnishing`, `/admin/furnishing/projects`, `/admin/furnishing/products`, `/admin/furnishing/packages`, `/admin/furnishing/procurement`, `/admin/furnishing/installation`, `/admin/furnishing/styles`, and `/admin/furnishing/retailers`.

They provide domain administration, but the audit found no bounded FS-008 release manifest/control view showing global state, kill switch, cohort eligibility, capability states, configuration health, migration readiness, telemetry health, deployment identity, blockers, last actor, and reason.

### Application and data boundaries

- FS-005–007 migrations: `20260806061000`, `20260806062000`, `20260806063000`.
- Legacy Furnishing foundation: `20260803040000_furnishing_studio.sql`.
- Product/catalog foundation: `20260806056000_fs001_canonical_furnishing_schema.sql`, `20260806057000_fs002_product_catalog.sql`.
- Commerce/catalog/activation: CA-001 and OC-001 migrations, including `20260812130000_oc001_purchasable_offer_catalog.sql` and `20260813110000_oc001_commercial_effects.sql`.
- Entitlement gate: `src/app/actions/furnishing-access.ts` checks `furnishing.project.access`.
- Project/design/procurement/installation actions: `furnishing-project-workspace.ts`, `furnishing-design.ts`, `furnishing-procurement.ts`, `furnishing-installation.ts`, `furnishing-commerce.ts`, `furnishing-catalog.ts`.
- RLS exists on legacy and canonical Furnishing tables; policies must be reviewed against the new activation boundary.
- No Furnishing-specific release, cohort, workspace activation, capability-state, or global kill-switch persistence was identified.

## Readiness matrix

| Capability | Existing implementation | Current state | Customer-visible | Activation dependency | External effect | Idempotency | Authorization | Evidence | Finding | Disposition |
|---|---|---|---|---|---|---|---|---|---|---|
| Marketing discovery | Furnishing marketing routes/components | Complete | Yes | Global decision for CTA behavior | Publication only | N/A | Public | Route inventory | FS008A-F01 | Blocked until safe policy |
| Offer/pricing presentation | `furnishing-packages.ts`, OC catalog | Partial | Yes | Offer state + release manifest | Commercial representation | Catalog versioning | Public/read | OC/CA tests | FS008A-F01 | Blocked |
| Checkout initiation | Commerce checkout action and Furnishing checkout route | Partial | Yes | Global/capability/offer controls | Payment | Commerce idempotency | Authenticated customer | CA/OC tests | FS008A-F01 | Blocked |
| Entitlement activation | CA-001/OC-001 entitlement boundaries | Partial | No until purchase | Global activation and offer state | Entitlement | Agreement/idempotency keys | Server-side commerce authorization | CA evidence | FS008A-F01 | Blocked |
| Onboarding/property resolution | CA product provisioning and project actions | Partial | Yes | Entitlement + workspace/cohort | Project context | Existing provisioning keys | Tenant/workspace | CA tests | FS008A-F01 | Blocked |
| Project creation | `createFurnishingPropertyAction`, project workspace actions | Partial | Yes | Workspace activation + capability | Database project | Existing domain constraints; verify replay | Owner/admin and entitlement | FS-005/T | FS008A-F01 | Blocked |
| Catalog viewing | Canonical product/catalog tables/actions | Partial | Yes (Admin/customer contexts) | Catalog activation | Publication | Versioned catalog | Tenant/admin policy | FS-002/T | FS008A-F01 | Blocked |
| Design workspace | Design actions/components | Complete foundation | Yes | Capability decision | Database only | Existing action boundaries | Workspace + entitlement | FS-005/T | FS008A-F01 | Blocked |
| Budgeting | FS-006 actions/tables | Complete foundation | Yes | Capability decision | Database only | Existing revision/validation paths | Workspace role | FS-006/T | FS008A-F01 | Blocked |
| Procurement readiness | Procurement actions/tables | Complete foundation | Yes | Capability + external-effects disabled | Potential retailer effect | Must verify keys | Workspace/admin | FS-006/T | FS008A-F02 | Blocked |
| Installation readiness | FS-007 actions/tables | Complete foundation | Yes | Capability decision | Provider/notification potential | Must verify | Workspace/admin | FS-007/T | FS008A-F02 | Blocked |
| Customer/Admin projections | Dashboard/Admin routes | Partial | Yes | Same activation decision | Notifications/audit | Read projections | Tenant/admin | PS-001D/T | FS008A-F03 | Blocked |
| Release manifest | None found | Absent | No | Required before activation | N/A | Versioned | Admin-only | None | FS008A-F01 | Blocked |
| Telemetry/audit controls | Existing platform conventions | Partial | No | Decision event schema | Telemetry only | Event dedupe required | Server | PS-001E/T | FS008A-F04 | Blocked |
| Environment/config inventory | General deployment/config patterns | Partial | No | Strict safe defaults | N/A | N/A | Deployment | Read-only source inventory | FS008A-F05 | Blocked |

## Required control decision

No implementation of `resolveFurnishingActivation(context)` was found. The required deterministic hierarchy is therefore not established:

`global kill switch → global activation → workspace state → cohort/release → capability → offer/catalog → role/tenant/entitlement`.

Existing `assertFurnishingEntitlement` is useful and should be reused as a lower-level authorization check, but it cannot authorize release activation, cohort eligibility, or kill-switch precedence.

## Authorization baseline

| Action | Admin | Eligible owner | Eligible operator | Wrong tenant | Anonymous | Current finding |
|---|---|---|---|---|---|---|
| View activation status | Not defined | Not defined | Not defined | Not defined | Not defined | FS008A-F01 |
| Manage global state/kill switch | Existing Admin role, no FS-008 boundary | No | No | No | No | FS008A-F01 |
| Manage workspace/cohort | No FS-008 persistence found | No | No | No | No | FS008A-F01 |
| Use Furnishing project actions | Admin bypass plus entitlement path | Entitlement path | Role/property path varies by action | RLS expected deny | Deny | FS008A-F02 |
| Retailer ordering | Must remain disabled | No | No | No | No | FS008A-F02 |

## Findings register

| ID | Severity | Expected vs observed | Impact | Recommended bounded correction | Retest boundary | Disposition |
|---|---|---|---|---|---|---|
| FS008A-F01 | P1 | Expected one server-side activation decision, deterministic control hierarchy, safe release manifest, and Admin control surface; none was found. Existing entitlement checks do not provide these controls. | Unauthorized activation or inability to stop activation. | Add only Furnishing-specific release/activation controls, reusing existing authorization, audit, telemetry, and RLS infrastructure. Keep all states disabled. | Focused decision, precedence, Admin authorization, RLS, and disabled Production checks. | Blocked — fix required |
| FS008A-F02 | P1 | Expected checkout, entitlement, project creation, catalog publication, notifications, and retailer ordering to be independently disabled during FS-008A; no unified enforcement boundary was found. | Payment, duplicate entitlement/project, publication, notification, or retailer-order risk. | Add capability gates with retailer ordering hard-disabled and all commercial/project effects denied while release is not active. | Direct server actions, DB/RLS, race/idempotency, and safe-state Production checks. | Blocked — fix required |
| FS008A-F03 | P2 | Expected tenant/cohort/workspace activation controls and safe customer/Admin projections; only entitlement/property checks were found. | Inconsistent customer visibility and operator support ambiguity while disabled. | Add tenant/cohort/workspace state only if existing release infrastructure cannot be safely extended. | Wrong-tenant, owner/operator, anonymous, direct-link checks. | Deferred pending F01 design |
| FS008A-F04 | P2 | Expected activation decision, denial, control-change, configuration, readiness, and rollback telemetry/audit; generic conventions exist but no Furnishing event contract was found. | Reduced incident diagnosis. | Define sanitized Furnishing event schema and audit transitions; no sensitive payloads. | Telemetry sanitization and audit integrity tests. | Deferred pending F01 design |
| FS008A-F05 | P2 | Expected complete Furnishing environment-variable inventory and strict safe defaults; no dedicated inventory was found. | Configuration drift or accidental enablement. | Inventory names/defaults/owners and fail closed on missing/invalid values. | Config parser and Production disabled-state read-only check. | Deferred pending F01 design |

## Release-safe baseline

Until FS008A controls exist and pass, the following remain disabled or unavailable: public Furnishing activation, checkout, entitlement activation, onboarding activation, project creation for newly activated customers, catalog publication, customer notifications, and retailer ordering. Existing authorized internal project inspection must remain protected by current tenant/role/RLS boundaries.

No synthetic purchases, projects, retailer resources, customer notifications, or external effects were created. No PS-001A–E certification was modified. FS-008B–G remain inactive.

## Reuse versus bounded correction

Reuse: CA-001 offer/checkout/entitlement foundations; FS-005–007 domain tables/actions; existing authentication, tenant, role, RLS, audit, telemetry, migration, and deployment controls; PS-001A–E evidence and test conventions.

Bounded correction required: Furnishing-specific activation decision, deterministic control hierarchy, release manifest, capability gates, safe configuration inventory, Admin control surface, and focused tests. No redesign of FS-005–007 and no unrelated refactor is justified by this audit.

**Phase 1 conclusion:** audit package complete; implementation may proceed only as a new bounded FS-008A controls candidate after review of findings FS008A-F01 through F05. Furnishing must remain globally disabled.
