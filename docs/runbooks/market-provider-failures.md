# Market Provider Failures Runbook

## Diagnose

1. Open the admin-only Market health endpoint.
2. Check enabled/configured state, latest safe error code, duration, cache, and rate-limit counters.
3. Inspect Vercel JSON events by `requestFingerprint`; do not search or log full addresses.
4. Confirm Vercel runtime variables and provider status/quota outside the application.

## Responses

- `MARKET_PROVIDER_DISABLED`: confirm intentional feature control; enable only after approval.
- `MARKET_RATE_LIMITED`: wait for provider recovery; do not expose quota details.
- `WORKSPACE_RATE_LIMITED`: wait one minute; verify double submissions or abuse.
- timeout/unavailable: one bounded retry is automatic; repeated failures should remain degraded.
- unauthorized/misconfigured: rotate or correct the server credential; never send it to a client or log.
- invalid response: preserve fixtures/log category and investigate adapter compatibility; do not cache the failure.

## Recovery verification

Run one authorized known-property analysis, confirm Market timestamps and comparable counts, and verify unrelated dashboard routes stayed healthy. Record only environment, time, status, duration, and safe codes.
