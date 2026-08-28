# AUTH-EMAIL-002 — Recovery Continuation Boundary

## Status

Complete. One controlled Production recovery succeeded and all replay paths
failed closed. Closure evidence is bound to candidate
`96c5d8de3783abb0f4ee09ae792d536789b5c338`, deployment
`dpl_DBscPwTiMJ4DsM2sZsUHGTznvZ4r`, and migration `20260827050000`.

## Objective

Correct the fail-closed boundary between the scanner-safe interstitial and the
atomic claim of durable recovery state. Preserve the deployed AUTH-EMAIL-001
SMTP, templates, canonical invitation flow, and 30/hour ceiling.

## Reproduction

The scanner GET creates a durable, expiring recovery state and does not contact
Supabase verification. The explicit continuation POST returns
`/update-password?setup=invalid`; the authoritative state remains `pending`
with no claim, verification exchange, grant, or password mutation.

Read-only Production evidence proved the exact pre-claim branch:
`EXISTING_SESSION_SAME_IDENTITY`. The deployed AUTH-EMAIL-001 continuation
treated every validated Supabase session as a rejection, including the valid
session belonging to the recovery subject. The state therefore remained
pending and `verifyOtp` was never called.

## Local correction

- Recovery requests now durably bind the normalized recipient to its canonical
  Auth user before an email is requested.
- Scanner presentation states keep the encrypted provider token and only a
  nonce digest; the browser receives a signed, short-lived, HttpOnly host-only
  cookie with no recovery credential.
- The continuation permits no session or the same server-validated identity,
  rejects a different identity without modifying that session, and claims the
  state atomically before one isolated `verifyOtp` exchange.
- A service-only transaction issues a recovery-only password grant bound to
  the verified Auth user and originating state. Password completion consumes
  the grant, action state, and recovery request.
- Canonical-host redirects happen before state creation; preview deployments
  reject Production recovery actions. Sensitive responses are non-cacheable,
  non-indexable, and use a no-referrer policy.
- Production deployment fails during configuration loading when the dedicated
  signing/encryption secret is absent or shorter than 32 characters.

## Local verification

- Focused recovery/state/grant tests: 24 passed.
- Full automated suite: 807 files and 4,440 tests passed.
- Typecheck: passed.
- Lint: passed with six pre-existing warnings and no new warnings.
- Production build: passed with an explicit local-only build secret.
- Migration lint: no findings.
- Clean local migration reset: passed through
  `20260827050000_auth_email_recovery_protocol.sql`.
- PostgreSQL rehearsal: one of two competing presentation states advanced;
  the other was rejected, and expiration cleanup was idempotent.
- Production-ceiling compatibility rehearsal: the exact expired legacy-row
  fixture was classified as immutable protocol v1 while preserving ciphertext
  and null bindings. Protocol-v1 inserts/reactivation and unbound or mismatched
  protocol-v2 recovery states were rejected. Explicit rollback restored the
  pre-migration schema and fixture.
- `git diff --check`: passed.

## Production certification

- The rotated signing key was generated from 32 random bytes, stored as a
  Sensitive Production variable, and accepted by the deployment guard.
- An accidental migration-history version was repaired using only pinned
  Supabase CLI `migration repair`; schema fingerprint
  `2ed7c6b99009853f55cd02dc1d14c717` and resource counts were unchanged.
- Local and remote history match exactly through `20260827050000`.
- Scanner GET created one pending presentation state and performed no
  verification or grant transition.
- Explicit continuation advanced exactly one browser state through claim,
  verification, and recovery-only grant issuance. The scanner state did not
  advance.
- The controlled password update succeeded once and landed on the dashboard.
  Recovery request, state, and grant then became consumed.
- Same-browser and fresh-private replay both reached the neutral unavailable
  state without a new state, grant, session, or password form.
- Canonical expiration terminalized the scanner state. Final reconciliation
  found zero active recovery states and zero usable grants.
- Users remained 115, memberships 118, and invitations 3. One email was sent;
  cumulative controlled usage is 8/12 and the SMTP ceiling remains 30/hour.
- Apex and www resolve to the Ready deployment and health passed repeatedly.
  Production error-log review found no errors during the verification window.

AUTH-EMAIL-001 remains historically closed with its recorded blocker. This
milestone is the subsequent correction and Production certification of that
specific recovery continuation boundary. Gmail reputation and CAPTCHA/beta
activation remain outside this milestone; broad and invite-only beta gates
remain closed.

## Deterministic prerequisites

Before any Production access or authentication email:

1. Capture the `Set-Cookie` attributes and prove the cookie is present on the
   continuation POST.
2. Test HMAC verification using the exact serialized cookie value across
   independently initialized application instances.
3. Exercise missing, truncated, tampered, expired, and key-drift cookies.
4. Exercise the existing-session guard with absent, intended, and unrelated
   sessions without revoking unrelated sessions.
5. Prove middleware neither replaces nor clears temporary state.
6. Prove one POST atomically changes `pending` to `claimed`, while replay and
   concurrent POSTs cannot claim it again.
7. Add request-level integration tests using separate route/action processes,
   real cookie headers, and a disposable database.
8. Emit sanitized internal failure codes that distinguish missing cookie,
   invalid signature, session guard, claim miss, verification failure, and
   grant failure without logging tokens or recipient data.

Only after these gates pass may a separately authorized candidate, deployment,
and controlled recovery email be considered.
