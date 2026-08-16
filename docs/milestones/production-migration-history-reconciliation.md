# Production Migration-History Reconciliation

Status: **COMPLETE — Guidebook verification not resumed**

Observed: 2026-08-15 (America/Chicago)

## Preserved release state

- Provider candidate: `fd87d0d3d15bfbc3251fd3c2aaa58499de0180db`
- Production deployment: `dpl_Fx1tvtCi4UU4HhgXM6JprwSp8mha`
- Prior evidence commit: `29b04821`
- Auto-create: disabled and absent from normal navigation
- Global kill switch: enabled
- Internal cohort: empty
- Release tag: none

No Guidebook feature code, production schema, customer data, storage objects,
or provider resources changed during this reconciliation.

## Discrepancy classification

Production's pre-repair ledger stored the same migration names and parsed SQL
statement arrays as a fresh chronological bootstrap. The only defect was the
legacy 12-digit timestamp format. Adding the valid 14-digit owner-bootstrap
compatibility migration exposed an ordering that the Supabase CLI could not
align. Each discrepancy is classified as **Renamed migration / equivalent
migration with identifier drift**.

| Production ledger ID | Historical repository filename | Canonical repository filename/version | Migration name | Parsed-statement MD5 | SQL match | Schema effects | Reconciliation |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `202607070001` | `202607070001_fix_profile_permissions.sql` | `20260707000100_fix_profile_permissions.sql` | `fix_profile_permissions` | `2cdbd3c779a03fb8b3acfc0e0f759de1` | Exact | Present | Old ID reverted; canonical ID applied |
| `202607070002` | `202607070002_database_security_hardening.sql` | `20260707000200_database_security_hardening.sql` | `database_security_hardening` | `471fca2c8bff3437bdd725a80f5d2d8f` | Exact | Present | Old ID reverted; canonical ID applied |
| `202607070003` | `202607070003_fix_profile_policy_recursion.sql` | `20260707000300_fix_profile_policy_recursion.sql` | `fix_profile_policy_recursion` | `b6bf7bc2f97190ab3e3d7fb85cac491f` | Exact | Present | Old ID reverted; canonical ID applied |
| `202607070004` | `202607070004_property_media_security.sql` | `20260707000400_property_media_security.sql` | `property_media_security` | `c827437f7b8cf2195cd85b8df264d125` | Exact | Present | Old ID reverted; canonical ID applied |
| `202607090001` | `202607090001_create_contact_inquiries.sql` | `20260709000100_create_contact_inquiries.sql` | `create_contact_inquiries` | `f82fe2b082c96ee6d9007a834f735f77` | Exact | Present | Old ID reverted; canonical ID applied |
| `202607100002` | `202607100002_lead_management.sql` | `20260710000200_lead_management.sql` | `lead_management` | `e798ba6ecf65961edf560fdd7be69426` | Exact | Present | Old ID reverted; canonical ID applied |

Before repair, all six production entries were applied while local expected
the equivalent SQL under valid 14-digit versions. The MD5 values hash the
ordered parsed statement arrays stored by Supabase; they identify evidence and
are not security controls. Production and fresh-local hashes matched for every
entry. Repository file SHA-256 values were captured before rename, and file
contents were not edited.

## Schema-equivalence evidence

1. A ledger-only production dump captured identifiers, names, and statement
   arrays before repair.
2. A database bootstrapped from empty applied the complete chronological chain
   successfully with canonical versions and unchanged SQL.
3. Production was compared with an isolated migration baseline containing
   every migration through `20260813130000` and excluding only the two pending
   Creation Assistant files.
4. The `public` and `storage` baseline schema diff was empty (zero lines). The
   historical tables, columns, constraints, indexes, functions, triggers, RLS,
   policies, storage schema, and grants therefore already exist in production.
5. A refreshed production schema export and an actual PostgREST query confirm
   `public.guidebook_creation_jobs` is absent. Bucket enumeration confirms
   `guidebook-creation-sources` is absent. The Creation Assistant migration is
   genuinely unapplied.

## Supported ledger operations

Only supported Supabase repair commands were used:

```text
supabase migration repair --linked --status reverted \
  202607070001 202607070002 202607070003 202607070004 \
  202607090001 202607100002

supabase migration repair --linked --status applied \
  20260707000100 20260707000200 20260707000300 20260707000400 \
  20260709000100 20260710000200
```

The verified no-op bootstrap compatibility migration remains applied as
`20260707000150`. No ad hoc SQL modified the ledger, and no historical or
Creation Assistant SQL ran in production.

## Post-repair verification

- Remote and local listings agree through `20260813130000`.
- Fresh local chronological bootstrap: passed.
- Migration lint: no findings.
- Production baseline schema diff (`public`, `storage`): empty.
- Production dry-run: passed with no destructive or legacy SQL.
- Only these migrations remain pending:
  - `20260815090000_guidebook_creation_assistant_foundation.sql`
  - `20260815091000_local_bootstrap_service_compatibility.sql`

Migration-history reconciliation is complete. The Creation Assistant
migrations remain unapplied, and controlled Guidebook verification remains
paused pending an explicit continuation task.
