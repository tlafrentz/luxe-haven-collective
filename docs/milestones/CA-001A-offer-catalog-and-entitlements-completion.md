# CA-001A — Offer Catalog and Entitlements Completion

Status: implementation complete; production migration and commercial approval pending.

- Final commit: pending commit after validation and review
- Deployed environment: not deployed in this workspace session
- Product families: `hpm`, `guidebook_studio`, `furnishing`, `investment_intelligence`
- Active offer codes and versions: none; all eleven anticipated v1 definitions remain draft until price, capability, and limit approval
- Capability registry version: schema version 1 (25 registered customer capabilities)
- Limit strategies: highest allowance for workspace/property/guidebook/published guidebook/team member/saved investment; additive for periodic investment analyses; most-specific for furnishing projects
- Onboarding requirement codes: `accept_terms`, `create_workspace`, `create_or_select_property`, `complete_property_profile`, `connect_data_source`, `upload_historical_data`, `complete_guidebook_intake`, `complete_furnishing_intake`, `complete_investment_profile`, `schedule_consultation`
- Entitlement persistence: tenant-scoped customer accounts and memberships, immutable-origin resource-scoped entitlements, append-only status history, and idempotent activation attempts
- Migration: `20260811050000_ca001a_offer_catalog_entitlements.sql`
- Route integrations: authoritative evaluator and enforcement boundary are available; enforcement remains off pending account migration and mismatch review
- Standalone Guidebook verification: dedicated capability and `guidebook_only` property participation are modeled; no HPM prerequisite or capability is implied
- RLS and authorization verification: RLS enabled for all new exposed tables; anonymous access and authenticated mutation are revoked; membership-scoped customer reads; administrative audit reads only
- Existing-account migration outcome: not run; mapping requires production account inventory and approval
- Test results: `npm test` — 683 files/3,714 tests passed; `npm run lint` — passed; `npm run typecheck` — passed; `npm run build` — passed; `git diff --check` — passed
- Known limitations: no offer is active because approved prices, exact inclusions, and limits were not supplied; no production database was available for hosted RLS or concurrency verification
- Deferred work: CA-001B checkout activation, CA-001C onboarding UI, CA-001D first-value journeys, CA-001E admin activation operations
- Compatibility removal condition: enable enforcement only after legacy-versus-entitlement observation reports zero unexplained mismatches for the approved review window; remove observation fallback after the migrated cohort passes route and cross-tenant verification
- Working-tree status: implementation changes remain uncommitted pending review; production rollout evidence is intentionally not claimed

The pre-existing repository contains commerce checkout, Stripe, webhook, subscription, and fulfillment code from earlier work. CA-001A did not add or modify those later-milestone implementations; the new canonical domain is provider-neutral.
