# PS-002 — Notifications Delivery and Action Plan Navigation

## Outcome

PS-002 connects persisted notification preferences to a scheduled, idempotent email-digest service and makes Action Plan navigation workspace-explicit. In-app notifications remain canonical and independent of email delivery.

## Notification digest contract

- Email is considered only when the workspace preference is confirmed, its global email channel is enabled, and the individual category also includes the email channel.
- `immediate`, `daily-digest`, `weekly-digest`, and `off` are evaluated in the saved IANA timezone.
- Daily delivery means eligible unread items are sent at the saved daily time; enabling the setting does not itself send email.
- Empty digests, inactive memberships, missing recipients, and suppressed recipients are skipped.
- A transactional database claim binds the workspace, recipient, frequency, period, and notification items before provider handoff.
- Period and notification uniqueness prevent duplicate sends during scheduler retries or concurrency.
- Resend delivery events reconcile notification digests before Auth-email accounting, using provider event and message identifiers.
- Bounce and complaint outcomes become terminal and activate the existing recipient-suppression boundary.

The scheduler is `/api/internal/notifications/digests`, protected by `NOTIFICATION_DIGEST_SCHEDULER_SECRET` or the established `CRON_SECRET`. Supabase `pg_cron` invokes it every 15 minutes through `pg_net`; the credential is held in Vault and Vercel Production secret storage. The UI displays the timezone and next eligible delivery and reports preference persistence with typed results.

## Action Plan navigation contract

All live Action Plan links use the canonical workspace-aware route builder. The detail route resolves the requested workspace before loading a stable plan ID, returns a controlled non-enumerating unavailable state when no authorized plan is found, supports zero-action drafts, and preserves the originating Action Plans tab in Back navigation.

## Verification

- Focused PS-002 and regression tests: passed.
- Full suite: 817 files and 4,473 tests passed.
- Typecheck, lint, production build, migration lint/analyzer, clean migration reset, and `git diff --check`: passed.
- Production deployment and the single controlled Outlook digest are recorded separately under the correlation-bound PS-002 evidence directory.

## Scope protections

Production public Auth remains `invite_only`. PS-002 does not change Supabase Auth templates, CAPTCHA, SMTP configuration, DNS, invitation or recovery protocols, or the 30/hour authentication-email ceiling. Notification digest accounting is separate from authentication-email accounting.
