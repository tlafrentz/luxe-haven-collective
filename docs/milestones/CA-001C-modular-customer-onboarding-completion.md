# CA-001C — Modular Customer Onboarding Completion

Status: local domain foundation complete; production activation and product-adapter rollout pending.

- Final implementation commit: pending review and commit
- Production deployment: not performed
- Database migration: `20260811070000_ca001c_modular_customer_onboarding.sql`
- Template registry version: 1
- Active templates: `hpm.v1`, `guidebook_studio.v1`, `furnishing.v1`, `investment_intelligence.v1`
- Module registry version: 1; twelve registered modules across shared profile, HPM, Guidebook, Furnishing, and Investment journeys
- Completion policy: `all_required_verified.v1`
- Handoff policies: one registered server-owned destination per product family; multi-family handoff resolves to the modular access page
- Bundle composition: shared-once modules deduplicate by stable module code; family modules remain independent; property modules are never merged across contexts
- Reuse policy: only still-verified `shared_once` module instances may satisfy a later case, with lineage to the original instance and within the same customer account
- Property behavior: Guidebook, HPM, furnishing, and investment references retain distinct context types; creation and linking are explicit owning-domain operations
- Document controls: protected object references only, tenant/object uniqueness, 25 MiB maximum, allowlisted PDF/JPEG/PNG/WebP content types, scan status, no public paths
- Provisioning integrations: typed, idempotent owning-domain ports with authorization, entitlement, required-module, and limit checks; production adapters are not enabled
- First-value definitions: HPM workspace/performance context, editable Guidebook draft, approved furnishing brief, saved investment analysis
- Internal workflow: internal responsibility, review and changes-requested transitions, assignment fields, protected audit events, and customer-safe messages
- Notification types: onboarding ready, customer action, submission received, changes requested, internal review, blocked, ready for handoff, completed
- Authorization and RLS: RLS on all new tables, anonymous access denied, browser mutation denied, membership-scoped customer case/module/submission reads, internal definitions and audit restricted
- Guidebook-only verification: plan contains `shared.customer_profile`, `guidebook.brand`, `guidebook.property`, and `guidebook.draft`; it contains no HPM module and provisions through `guidebook.create`
- Expansion verification: source type and shared verified-module lineage are modeled; no existing case is rewritten
- Existing-customer migration: not run; no existing product access is gated on onboarding cases
- Test results: `npm test` — 687 files/3,742 tests passed; `npm run lint`, `npm run typecheck`, `npm run build`, and `git diff --check` passed
- Production verification: not run; controlled identities, active commercial agreements, deployed migrations, protected storage, and product adapters are required
- Known limitations: no approved active CA-001A offers, no CA-001B production activation, no deployed storage scan integration, and no production provisioning adapters
- Deferred: post-onboarding product workflows, procurement, full authoring/analysis, CRM, generalized forms/workflows, campaigns, and CA-001D
- Working tree: uncommitted CA-001A/B/C implementation changes pending review
