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
