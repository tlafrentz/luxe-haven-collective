# AUTH-EMAIL-002 — Recovery Continuation Boundary

## Status

Not started. Production email mutation is prohibited until deterministic
request-boundary tests pass.

## Objective

Correct the fail-closed boundary between the scanner-safe interstitial and the
atomic claim of durable recovery state. Preserve the deployed AUTH-EMAIL-001
SMTP, templates, canonical invitation flow, and 30/hour ceiling.

## Reproduction

The scanner GET creates a durable, expiring recovery state and does not contact
Supabase verification. The explicit continuation POST returns
`/update-password?setup=invalid`; the authoritative state remains `pending`
with no claim, verification exchange, grant, or password mutation.

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
