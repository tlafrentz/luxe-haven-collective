# BETA-EMAIL-001 — Broad Beta Auth Abuse & Delivery Readiness

## Scope and frozen boundaries

This candidate adds public Auth abuse controls and authentication-email delivery operations without changing the certified SMTP identity, canonical Admin invitation transaction, scanner-safe email interstitial, or AUTH-EMAIL-002 recovery protocol.

The safe deployment default is `closed`. Deployment never enables broad beta.

## Public-flow inventory

| Flow | Baseline | Candidate behavior |
| --- | --- | --- |
| Password sign-in | Public; no CAPTCHA | CAPTCHA required; sanitized errors; 429 handling |
| General signup | Public route | Allowed only in `broad_beta`; CAPTCHA required |
| Commerce/Guidebook/Investment signup | Public routes | Same governed signup boundary and CAPTCHA |
| Furnishing signup | Furnishing activation-disabled | Remains activation-disabled and also shares the signup boundary |
| Password recovery | Public; non-enumerating | `closed` support state; protected in `invite_only`/`broad_beta`; suppression remains non-enumerating |
| Magic link/OTP | No public request path found | No path added |
| Resend confirmation | No public path found | No path added |
| Public invitation request | No path found | No path added |
| Admin workspace invitation | Admin-authorized | CAPTCHA-exempt; warns and stops on active suppression |
| Email change | Authenticated secure flow | Unchanged |

Anonymous sign-in remains disabled. The local Supabase policy is aligned to a 30/hour email ceiling and a 60-second minimum frequency. Production values are read back during rollout; they are not raised by this candidate.

## Control plane

The singleton control supports `closed`, `invite_only`, and `broad_beta`. Changes require canonical Admin authorization, a sanitized reason, expected version, correlation, idempotency, and explicit confirmation. Exact replay returns the authoritative result, changed replay fails, and every transition appends immutable audit evidence plus an operational alert. Emergency `closed` mode preserves existing sessions and Admin-issued invitations.

## CAPTCHA

One shared Turnstile component holds the token only in component state and a transient hidden form field. Missing or unavailable configuration fails before any Supabase Auth call. The token is passed to Supabase Auth as `captchaToken`, so Supabase remains the server-side CAPTCHA verifier. Challenges reset when an action produces a new correlation; expiration and provider errors disable submission. Tokens are not placed in URLs, storage, telemetry, or evidence.

Production requires `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel, `TURNSTILE_SECRET_KEY` in approved server secret storage, and matching Turnstile configuration in Supabase Auth. Admin invitations do not require browser CAPTCHA.

## Delivery operations

`POST /api/webhooks/resend` reads the raw body, validates the bounded Svix timestamp, and uses the Resend SDK's Standard Webhooks verifier before parsing or trusting event data. Durable provider-event uniqueness makes exact retries idempotent and rejects changed-payload replay. Supported outcomes normalize to sent, delivered, delayed, soft/hard bounced, complained, rejected, or failed; unknown events are retained as unsupported.

Because Supabase SMTP does not guarantee an application correlation header, provider-message linkage is exact when a known provider message ID exists and otherwise explicitly `best_effort` by recipient digest and bounded time. Delivery never proves open or Auth completion.

Hard bounces and complaints create one active digest-only suppression. Three soft bounces in 30 days create review suppression. Public requests remain non-enumerating; canonical Admin invitations stop with an operational warning. Manual suppression and release are Admin-only and audited. Security-critical suppressed delivery requires Admin support review; it is never silently treated as delivered.

The Admin `/admin/auth-email` view shows mode, CAPTCHA/webhook readiness, ceiling/cooldown, current-hour requests, normalized delivery counts, suppression count, webhook recency, and sanitized alerts. It exposes no provider secret, token, full URL, raw payload, or recipient address.

## Alerts and capacity

Alerts cover public-mode change, CAPTCHA unavailability, Auth rate limiting, invalid webhook signatures, provider complaints/hard failures, and hourly volume at 80% of the ceiling. Alert keys are bounded and deduplicated.

The broad-beta capacity calculation must be frozen during Production certification:

`planned users + expected confirmations + expected recoveries/retries + safety margin`

The ceiling stays 30/hour for certification. A later increase requires measured need and may not exceed 100/hour under this milestone.

## Rollout gate

Local implementation does not authorize Production changes. One subsequent authorization must cover reviewed migrations, exact candidate deployment, Turnstile and Resend webhook configuration, safe-closed verification, bounded Gmail/Outlook certification, suppression/cooldown/emergency-close tests, cleanup, and the final `BROAD_BETA_READY`, `BROAD_BETA_HELD_GMAIL_REPUTATION`, or `BROAD_BETA_BLOCKED_ENGINEERING` decision.

Broad beta remains closed until two fresh controlled Gmail identities organically reach Inbox. Invite-only beta may open only when all security, provider, cleanup, and operational gates pass.

## Production certification disposition

The authorized Production run deployed candidate `79e66104cd2e6757569b3a2595d91171fce5acef` as deployment `dpl_NjtRXhvXt8uDmGMKwJY3zbLb4N9d`. Migration `20260828010000` required a history-only false-positive repair before it was applied normally; subsequent parity and schema checks passed.

Turnstile and the Resend webhook were configured successfully. Direct Production checks passed for signed webhook verification, replay handling, unsupported events, provider-supported bounce/complaint fixtures, suppression and alert creation, missing/invalid CAPTCHA rejection, health, aliases, and the initial governed mode transitions.

The final disposition is `BROAD_BETA_BLOCKED_ENGINEERING`. A stale expected-version control command was correctly rejected by PostgreSQL, but the Admin server action surfaced `PUBLIC_AUTH_CONTROL_COMMAND_REJECTED` as a generic server-error page instead of a controlled, accessible stale-version result. No stale mutation committed, no user was created, and no authentication email was sent. The emergency control returned Production to `closed` at version 4.

Outlook, Gmail, signup, recovery, and remaining browser CAPTCHA certification were not executed after the failure. Authentication-email usage for this milestone remains `0/6`. No completion tag is authorized for this run.

### Corrected-candidate resume

Candidate `ff3f9f9887a3a8ce53eda1b09f10c69e46be9af7`, deployed as `dpl_EWp1HP5PVTzijeyDhED4aWkPDRvm`, corrected the stale-version boundary. Direct Production two-tab verification proved an accessible `VERSION_CONFLICT`, authoritative refresh to version 5, preserved reason, no automatic retry, zero rejected-command effects, and one explicit version-6 retry with one success audit.

Certification then stopped at `CONTROLLED_PUBLIC_SIGNUP_FAILED_AFTER_VALID_TURNSTILE`. The widget reported a successful challenge, but the single controlled public signup returned the sanitized failure state before any Auth user, membership, invitation, email-request record, or authentication email was created. No retry was performed. Production was returned to `closed` at version 7.

The final disposition remains `BROAD_BETA_BLOCKED_ENGINEERING`. The stale-version defect is resolved, but broad and invite-only beta gates remain closed pending a separately reviewed diagnosis of the valid-Turnstile signup failure. Authentication-email usage remains `0/6`; no completion tag is created.
