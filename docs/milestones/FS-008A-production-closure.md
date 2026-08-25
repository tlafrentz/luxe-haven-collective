# FS-008A Production Closure

Date: 2026-08-24

## Identity

- Application candidate: `156bbab4d1562fa168efd36c4d1813f68b5970cf`
- Production deployment: `dpl_WGKjPAre15978KLYuGLjyay7MPgU`
- Immutable deployment URL: `https://luxe-haven-collective-2wxh1br77-luxe-haven-collective.vercel.app`
- Rollback deployment: `dpl_4YbzcGpjpR5w7gnWaq7wLoSA4We5`
- Applied migrations: `20260825010000_fs008a_activation_controls.sql`, `20260825020000_fs008a_notification_product_family.sql`

The application source deployed is byte-for-byte the tested candidate above. This document is an evidence-only closure commit; it does not change application source, migrations, configuration, routing, or deployment.

## Read-only Production evidence

The linked Supabase project was checked using sanitized, read-only queries. Observed state:

- FS-008A release: `global_state=disabled`, `global_kill_switch=true`, `configuration_valid=false`, version 1.
- Capability controls: zero rows enabled; no public/customer cohort rows were present.
- Workspace activation controls: zero rows present.
- Furnishing projects: one historical row, created 2026-08-05 (before this deployment); no post-deployment project appeared.
- Furnishing catalog publications: 0; Furnishing notifications: 0; installation projects: 0; purchase batches: 0; procurement orders: 0.
- Activation audit events: 0; therefore no unexpected enablement or mutable post-deployment audit state was observed. The append-only policy is covered by the local PostgreSQL rehearsal and focused tests.
- The entitlement relation did not expose the expected Furnishing capability projection through the read-only endpoint; no entitlement activation was observed, and the database/RLS rehearsal and application tests cover the canonical entitlement guard.

The deployment is Ready. Both `luxehavencollective.co` and `www.luxehavencollective.co` resolve successfully to the promoted deployment. Anonymous requests to `/admin/furnishing/activation` returned redirects to authentication (307 on the custom aliases; 302 on the immutable URL). Production logs contained only the expected anonymous route probes and HEAD health probes; no Furnishing error was emitted.

Production environment inspection confirmed encrypted variable names only; values were not read or recorded. Activation telemetry and audit payloads are sanitized by the tested implementation. No checkout, entitlement, project, catalog publication, notification, installation, procurement, or retailer-order effect was observed.

## Accepted evidence substitution

Authenticated Production UI/persona checks were not directly exercised from this environment and are recorded as `RUNNER_NOT_COMPLETED`; they are not represented as passing Production UI results. The substituted evidence is the local PostgreSQL 17.6 authenticated-role/RLS rehearsal, database-trigger verification, 133 focused tests, 4,226 full-suite tests, Admin authorization and optimistic-concurrency tests, platform-compliance and migration-analyzer tests, and Production migration parity.

## Closure decision

FS-008A is safe-state complete: Furnishing remains globally disabled, the kill switch is authoritative, and every commercial/customer capability remains below the FS-008A ceiling. FS-008B through FS-008G remain inactive. No new claim, identity, synthetic resource, purchase, entitlement, project, or catalog resource was created for this closure.
