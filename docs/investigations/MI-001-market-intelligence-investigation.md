# MI-001 — Market Intelligence Investigation

## Result

**Status:** Investigation stopped at the first broken boundary  
**Root-cause classification:** **Unknown**  
**First broken boundary:** Provider request/response observability  
**Owner:** Market Intelligence application/infrastructure team

The Full Investment Analysis reached the server action and returned a non-rate-limit
`ProviderError` from the RentCast execution path. The exact provider failure cannot
be recovered from the available evidence because the application maps all non-rate-limit
provider errors to `MARKET_PROVIDER_UNAVAILABLE` and does not retain the provider error
code, HTTP status, latency, response body, or provider request identity.

No provider request was replayed. No retry, provider, schema, SQL, or implementation
change was made.

## Evidence sources

- User screenshot: `Screenshot 2026-07-27 at 10.51.54 PM.png`
- `src/features/investment-intelligence/components/investment-workspace-state.tsx`
- `src/app/actions/investment-workspace.ts`
- `src/app/actions/investment-workspace-runtime.ts`
- `src/features/investment-intelligence/application/run-investment-workspace-analysis.ts`
- `src/features/market-intelligence/application/resolve-market-property.ts`
- `src/features/market-intelligence/infrastructure/market-intelligence-config.ts`
- `src/features/market-intelligence/infrastructure/rentcast/rentcast-client.ts`
- `src/features/market-intelligence/infrastructure/rentcast/rentcast-property-provider.ts`
- `src/features/market-intelligence/infrastructure/rentcast/rentcast-comparable-provider.ts`
- `.env.local` configuration metadata (presence/shape only; secret not recorded)
- `.next/dev/logs/next-development.log`

## Request trace

### 1. User action

| Field | Evidence |
|---|---|
| Action | `Run Full Investment Analysis` |
| Client status | Failed |
| Displayed message | `Market data is temporarily unavailable. Your assumptions were preserved and you can retry.` |
| Screenshot timestamp | 2026-07-27 22:51:54 America/Chicago (from filename) |
| Route | `rental-arbitrage` |
| Readiness | 5/5 |

The route is visible in the readiness card as “Rental arbitrage strategy.” The client
constructs `clientRequestId` as `client:<sequence>`, but that identifier is neither
returned in the error response nor logged.

### 2. Server action

**Boundary:** `analyzeInvestmentWorkspace`

Verified behavior:

1. Authenticates the user.
2. Resolves workspace access.
3. Validates the complete request schema.
4. Loads Market Intelligence configuration.
5. Checks provider enablement and workspace rate limiting.
6. Creates a UUID `runId`.
7. Calls `runInvestmentWorkspaceAnalysis`.
8. Maps a caught `ProviderError` to a safe client error.

The screenshot message is emitted only by the non-rate-limit `ProviderError` branch.
Therefore:

- input validation did not return its distinct validation message;
- provider-disabled did not return its distinct disabled message;
- missing/invalid configuration did not return its distinct configuration message;
- workspace rate limiting did not return its distinct workspace-limit message;
- provider HTTP 429 did not return its distinct provider-limit message.

### 3. Application service

**Boundary:** `runInvestmentWorkspaceAnalysis`

The first Market Intelligence operation is:

```text
resolveMarketProperty
  → propertyProvider.lookupPropertyCandidates
  → RentCastPropertyProvider
  → RentCastClient.searchProperties
```

Only after successful property resolution does the service request sale/rent
comparables, build a `MarketIntelligenceReport`, build the investment context, run
the investment decision, and create the canonical analysis.

## Required request identity

The following fields were required by MI-001 but are not present in retained evidence:

| Field | Result |
|---|---|
| Analysis/run ID | Not recoverable |
| Workspace ID | Not recoverable |
| Property ID | Not created/recoverable |
| Client request ID | Not recoverable |
| Request fingerprint | Not recoverable |
| Server start timestamp | Not recoverable |
| Server duration | Not recoverable |

The server generates these values in memory. The current Next development log contains
no `investment_workspace_run_started`, `investment_workspace_run_failed`, or
`investment_workspace_run_completed` record for the screenshot request.

## Provider resolution

| Question | Verified result |
|---|---|
| Selected provider | RentCast |
| Why selected | Production composition directly constructs `RentCastPropertyProvider` and `RentCastComparableProvider`; there is no runtime provider-selection branch in this action |
| Fallback attempted | No fallback exists in this execution path |
| Provider disabled | No; the screenshot would show the distinct `MARKET_PROVIDER_DISABLED` message |
| Provider configured | Yes at inspection time: `RENTCAST_API_KEY` is present, 32 characters, non-placeholder, and has no boundary whitespace |
| Retry behavior | Transient provider errors may be retried by the runtime wrapper, but no per-attempt evidence was retained |

No secret value was captured in this report.

## Provider request

### First possible outbound request: property resolution

The client constructs:

```text
GET {RENTCAST_BASE_URL}/properties
X-Api-Key: <redacted>
Accept: application/json

address={streetAddress}, {city}, {state} {postalCode}
limit=10
```

The submitted subject fields are constructed from the client workspace state:

| Field | Construction |
|---|---|
| Address | `address1`, `city`, `state`, `postalCode`, country `US` |
| Route | `rental-arbitrage` |
| Property type | Workspace property type |
| Bedrooms | Workspace bedrooms |
| Bathrooms | Workspace bathrooms |
| Square feet | Workspace square feet |
| Occupancy | `projectedOccupancyPercentage` |
| ADR | `projectedAdr` |
| Market request | `saleValuation=false`, `longTermRent=true` for rental arbitrage |

The exact values entered by the user are not visible in the screenshot and are not
retained in logs. The request fingerprint deliberately cannot reconstruct them.

### Second possible outbound request: long-term rent comparables

This request occurs only if property resolution succeeds:

```text
GET {RENTCAST_BASE_URL}/avm/rent/long-term
```

Possible query fields are address, latitude, longitude, property type, bedrooms,
bathrooms, square footage, maximum radius, comparable age, comparable count, and
`lookupSubjectAttributes=true`.

**Stop condition:** Available evidence does not establish whether the failure occurred
during the property request, its response mapping, or the later comparable request.
Investigation stops here.

## Provider response

No provider response evidence was retained.

| Required field | Result |
|---|---|
| HTTP status | Not captured |
| Latency | Not captured |
| Response body | Not captured |
| Provider error code | Discarded by safe error mapping |
| Authentication result | Unknown |
| Quota result | HTTP 429 ruled out by the displayed message; other account restrictions unknown |
| Rate limiting | Provider 429 and workspace limit ruled out by their distinct messages |

`RentCastClient` creates distinct errors for HTTP 400, 401, 403, 404, 429, 5xx,
timeout, transport failure, and invalid JSON. `analyzeInvestmentWorkspace.safeError`
collapses every non-429 `ProviderError` into the same
`MARKET_PROVIDER_UNAVAILABLE` response. `recordWorkspaceOperation("failed", ...)`
records only that collapsed code, not the provider code or status.

## Downstream boundaries

Per the investigation stop rule, these were not debugged beyond confirming they were
not reached successfully:

| Boundary | Result |
|---|---|
| Normalization | Not verifiable; no provider response retained |
| `MarketIntelligenceReport` | Not created/returned |
| `InvestmentDecision` | Not attempted successfully |
| `InvestmentAnalysis` | Does not exist |
| Save Opportunity | Correctly disabled because no canonical analysis/save token exists |

No exact downstream exception exists because execution returned from the caught
`ProviderError` before a successful canonical result was produced.

## Boundary trace

```text
User action
  Status: verified
  Action: Run Full Investment Analysis
  Route: rental-arbitrage

Server action
  Status: verified
  Result: MARKET_PROVIDER_UNAVAILABLE
  Underlying type: non-rate-limit ProviderError

Application service
  Status: entered by code path
  First operation: resolveMarketProperty

Provider selection
  Status: verified
  Provider: RentCast
  Fallback: none

Provider request / response
  Status: first broken evidence boundary
  Request ID: absent
  Attempt count: absent
  HTTP status: absent
  Latency: absent
  Provider error code: discarded
  Body: absent

Normalization
  Status: not investigated

Market Intelligence report
  Status: not produced

Investment decision
  Status: not successfully attempted

Canonical analysis
  Status: not produced
```

## Verified root cause statement

The precise external failure is **unknown**. The verified reason it cannot be identified
from this analysis request is that the provider boundary is lossy and uncorrelated:
the application discards RentCast's specific `ProviderError.code` and `statusCode`,
does not record request/response timing or a provider request ID, and the retained
runtime log has no run event for this request.

This is one classification only: **Unknown**. Authentication, quota, request
construction, normalization, and provider availability must not be asserted without
the missing response evidence.

## Fix ownership

The Market Intelligence application/infrastructure team owns the next implementation
work item because the missing evidence spans:

- RentCast request/response instrumentation;
- preservation of safe provider error classification;
- correlation between workspace run, property resolution, Market analysis, and
  provider attempts.

## Regression test that would prevent recurrence

Add an integration test at the server-action/provider boundary using a fake RentCast
transport that returns a known error, for example HTTP 401. Assert that one correlated,
redacted structured trace contains:

- workspace run ID;
- workspace ID;
- property-resolution ID;
- Market analysis ID;
- route;
- provider;
- provider operation (`property-resolution` or `long-term-rent`);
- attempt number;
- request field names and safe subject identifiers;
- HTTP status;
- provider error code;
- latency;
- final boundary status.

The test must also assert that secrets and raw sensitive response content are absent.
This test would make the first provider failure deterministically classifiable without
changing the safe user-facing message.

## Exit criteria

| Question | Answer |
|---|---|
| Which boundary failed? | Provider request/response observability is the first verified broken boundary |
| Why did it fail? | The analysis returned a non-rate-limit RentCast `ProviderError`, but its exact code/status/body and correlated run trace were not retained |
| What proves it? | The unique client message maps to the non-rate-limit `ProviderError` branch; code inspection proves lossy mapping; retained logs contain no run event |
| Which team owns the fix? | Market Intelligence application/infrastructure |
| Which regression test prevents it? | Correlated provider-boundary integration test preserving safe error code/status/timing while redacting secrets |

