# AUTH-EMAIL-001 Production Authentication Email

## Current status

`AUTH-EMAIL-001_TEST_WINDOW_PAUSED_MEMBERSHIP_DEFECT`

Beta invitations remain closed. Production custom SMTP remains configured at 30 authentication emails per hour. No additional authentication email is authorized. The controlled test count is 2/12.

## Direct Production evidence

- Gmail: the first controlled Admin invitation was delivered with SPF, aligned DKIM, DMARC, and TLS passing, but Gmail placed it in Spam. After evidence capture and invalidation of the disclosed invitation token, an explicitly authorized Not spam reputation signal moved the message to Inbox. Original placement remains Spam and the result remains `DELIVERABILITY_REPUTATION_PENDING`.
- Outlook/Microsoft: the second controlled Admin invitation reached Inbox organically. SPF, DKIM, DMARC, and TLS 1.3 passed; Resend recorded delivered with no bounce or complaint. Microsoft scanning did not consume the link before the human action.
- Outlook invitation authentication and password setup succeeded, but authoritative reconciliation found no membership in the intended workspace. The controlled user was signed out and deleted. Production read-only cleanup reconciliation confirms zero remaining Auth users, profiles, memberships, owner rows, durable workspace invitations, activity actors, or customer-account memberships for both retired controlled identities.

No direct Production evidence is represented as proving the corrected membership flow. A fresh identity, correlation, deployment, and separately authorized test window are required after correction deployment.

## Root cause

The controlled operational script called Supabase `inviteUserByEmail` directly and supplied `role=owner` plus workspace identity as Auth metadata. The application does not treat Auth metadata as workspace authority. Its canonical team invitation flow durably creates `workspace_invitations`, hashes a separate application token, and accepts through `accept_workspace_invitation`, but that boundary was bypassed and did not support the reserved Owner workflow.

The Auth callback completed authentication correctly. Password completion then used the profile role default `/dashboard` destination because no canonical invitation-acceptance destination was preserved. With no active membership, workspace data was not loaded, but the dashboard fallback exposed the normal application shell and Owner workspace initialization guidance. This incorrectly treated authentication as sufficient onboarding progress.

The failure affects direct Supabase Admin invitations that assume metadata provisions workspace access; it is not Outlook-specific. Existing canonical non-Owner team invitations remain governed and were not exercised by the failed Production test.

## Bounded correction

Migration `20260826233500_auth_email_admin_workspace_invitations.sql` adds an Admin-only reserved Owner invitation command. It creates the normalized, expiring, correlation-bound, idempotent, auditable workspace invitation before email delivery. After Supabase creates the Auth user, a service-only boundary binds its ID to that invitation. Delivery or binding failure revokes the invitation; binding failure also deletes the partial Auth user.

Password completion now preserves a validated internal destination leading to explicit workspace invitation acceptance. The acceptance transaction locks the invitation, validates token, status, expiry, normalized authenticated email, bound Auth identity, workspace, and duplicate membership absence, then creates one membership with exactly the stored role and marks the invitation accepted with immutable activity evidence. Tokens are invalidated on consumption. Unbound, wrong-recipient, expired, replayed, cross-workspace, and duplicate attempts fail closed.

An authenticated user with a pending invitation and no active membership now receives only a controlled recovery surface. The normal workspace shell, data loading, entitlements, and self-initialization control remain unavailable until membership acceptance succeeds.

## Local verification

- Focused Auth/workspace tests: 33 passed.
- AUTH-EMAIL-001 PostgreSQL lifecycle rehearsal: passed after a clean local migration reset.
- Architecture/platform compliance and migration analyzer: 89 files, 352 tests passed.
- Full automated suite: 801 files, 4,407 tests passed with a bounded 10-second per-test ceiling. The default 5-second run produced one unrelated daylight-saving calculation timeout under full-suite load; it passed in isolation, and an earlier pre-UI full run passed at the default ceiling.
- Typecheck: passed.
- Lint: passed.
- Production build: passed, 285 static pages generated.
- Migration lint: no findings.
- Production orphan reconciliation: all controlled resource counts zero.
- `git diff --check`: passed.

No Production migration, application deployment, fresh identity, or third authentication email has been created. The next Production test requires a corrected deployment and separate authorization.
