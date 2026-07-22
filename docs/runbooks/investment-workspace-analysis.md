# Investment Workspace Analysis Runbook

## Normal path

Authenticated owner/admin → strict payload validation → per-actor limit → exact-request coalescing → cached or live provider calls → canonical Market report → Investment contexts → lifecycle result → safe client response.

Property/provider cache keys contain normalized Market request facts and policy/provider semantics, not purchase price, financing, ADR, or occupancy. Cache TTL defaults to five minutes and cache entries retain provider retrieval timestamps.

## Failure isolation

Expected errors return typed messages. The form and previous successful result remain client-side. Provider failure never triggers fixtures. Insufficient Market evidence can coexist with explicit Investment assumptions, but it cannot appear as an estimate.

## Privacy

The active browser session contains address, assumptions, and canonical results. Server process caches contain provider-neutral result records for the configured TTL. No analysis is persisted. Logs contain hashed request fingerprints, safe actor-scoped request IDs, route/status/duration bands, and no credential, raw payload, full address, or financial input.

## Rollback

Trigger: elevated safe failure rate, credential concern, provider contract incompatibility, or unacceptable latency.

1. Decision owner disables `MARKET_PROVIDER_ENABLED` in the affected Vercel environment.
2. Redeploy/restart so runtime configuration refreshes.
3. Verify the workspace preserves input and shows live Market analysis disabled.
4. Verify no synthetic values appear and unrelated dashboard routes remain healthy.
5. If needed, promote the prior healthy deployment.
6. Re-enable only after preview validation and incident review.
