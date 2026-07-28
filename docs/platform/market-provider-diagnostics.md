# Market Provider Diagnostics

MI-002 provides engineering-only, correlated diagnostics for every live Market
Intelligence provider operation. It does not change provider selection, provider
requests, retry policy, investment calculations, or user-facing error messages.

## Execution model

Every valid Full Investment Analysis receives one immutable run identifier:

```text
MarketAnalysisRun
  ├── MarketProviderOperation (property-resolution, attempt 1)
  │     ├── provider-request-started
  │     └── provider-request-completed
  ├── MarketProviderOperation (rent-estimate, attempt 1)
  │     ├── provider-request-started
  │     └── provider-request-completed
  └── analysis-stage events
```

The run ID has the form:

```text
MI-YYYYMMDDHHMMSS-<UUID>
```

It is generated once by the authenticated server action and reused as the canonical
Investment Workspace lineage ID. Every provider operation and event references it.

### `market_analysis_runs`

One row per accepted analysis request:

- run ID;
- workspace and requesting user;
- resolved property ID when resolution succeeds;
- acquisition route;
- SHA-256 subject-address hash;
- property type;
- start/completion timestamps and duration;
- running, succeeded, or failed result;
- safe application error code.

### `market_provider_operations`

One row per actual HTTP attempt:

- operation ID and run ID;
- provider and canonical operation type;
- attempt number;
- start/completion timestamps and duration;
- SHA-256 request fingerprint;
- safe request metadata;
- HTTP status when a response exists;
- provider and application error codes;
- preserved classification and retryability;
- response byte size and SHA-256 response hash.

Retries create new rows. Prior attempts are never overwritten.

### `market_provider_events`

Append-only event records for analysis stages and provider request boundaries. The
`market_analysis_execution_timeline` view joins events with their provider operation
metadata in deterministic timestamp/event-ID order.

## Correlation lifecycle

1. The server action validates identity, authorization, and request shape.
2. It creates the run before Market provider configuration or execution.
3. `provider-selection` records RentCast selection and the absence of fallback.
4. `RentCastClient` creates an operation immediately before each HTTP request.
5. The same operation is completed after a response, serialization failure, timeout,
   or transport failure.
6. The external retry wrapper remains unchanged. A retry invokes the client again,
   producing the next attempt and a new operation ID.
7. Successful property resolution adds the canonical subject ID to the run.
8. Market report and Investment decision stages are recorded.
9. The run is completed once with the final safe application result.

Diagnostics persistence is best effort. Storage failures emit the redacted
`market_diagnostics_persistence_failed` event and never change analysis behavior.

## Event taxonomy

### Structured log events

| Event | Meaning |
|---|---|
| `market_analysis_stage` | Run, provider selection, property resolution, report, decision, or completion stage |
| `market_provider_request_started` | One HTTP attempt is about to be sent |
| `market_provider_request_completed` | One HTTP attempt produced success or a classified failure |
| `market_diagnostics_persistence_failed` | Telemetry persistence failed without failing the analysis |
| `market_diagnostics_initialization_failed` | The run recorder could not be initialized |

Provider start events include:

- run and operation IDs;
- provider and operation;
- attempt;
- timestamp.

Provider completion events additionally include:

- result;
- HTTP status when present;
- classification;
- retryability;
- duration.

Raw requests, responses, addresses, keys, authorization headers, and caught error
messages are not logged.

### Persisted event types

| Type | Status values |
|---|---|
| `analysis-stage` | `started`, `completed`, `failed` |
| `provider-request-started` | `started` |
| `provider-request-completed` | `completed`, `failed` |

## Error classification

Provider semantics remain internal even though the UI continues showing safe,
collapsed messages.

| Provider result | Classification |
|---|---|
| Success | `SUCCESS` |
| HTTP 400 / invalid request | `INVALID_REQUEST` |
| HTTP 401 | `AUTHENTICATION` |
| HTTP 403 | `AUTHORIZATION` |
| HTTP 404 | `SUBJECT_NOT_FOUND` |
| HTTP 408 / abort timeout | `TIMEOUT` |
| HTTP 429 | `RATE_LIMITED` |
| HTTP 5xx | `PROVIDER_FAILURE` |
| Network/fetch failure | `TRANSPORT_FAILURE` |
| Invalid JSON/provider shape | `PROVIDER_SERIALIZATION` |
| Unclassified failure | `UNKNOWN` |

The provider error code, application error code, classification, HTTP status, and
retryable flag are separate fields. Engineers must not infer one by parsing a
user-facing message.

## Safe request fingerprinting

Exact addresses are normalized to trimmed lowercase text and immediately SHA-256
hashed. Request fingerprints are SHA-256 hashes over:

- operation;
- address hash;
- property type;
- bedrooms;
- bathrooms;
- square feet;
- radius;
- comparable count;
- acquisition route.

Persisted metadata may include those non-secret attributes. It never includes:

- API keys;
- authorization or `X-Api-Key` headers;
- raw addresses;
- raw provider payloads;
- guest information;
- raw caught exception messages.

Responses are represented by HTTP status, byte size, and a SHA-256 body hash. The
body itself is parsed for normal application behavior and then discarded.

## Access and retention

All three diagnostic tables use row-level security. Only authenticated platform
administrators can read them. Application writes use the service role.

Default retention is 30 days. Operations may schedule:

```sql
select public.prune_market_provider_diagnostics(interval '30 days');
```

The function is service-role-only, rejects retention below one day, and removes
events before operations before runs. Provider events cannot be updated.

Response hashes and address hashes remain potentially linkable operational metadata;
they receive the same retention and access restrictions as all other diagnostics.

## Troubleshooting

Given a run ID:

1. Load the run:

   ```sql
   select *
   from public.market_analysis_runs
   where id = 'MI-...';
   ```

2. Load its canonical timeline:

   ```sql
   select *
   from public.market_analysis_execution_timeline
   where run_id = 'MI-...'
   order by occurred_at, event_id;
   ```

3. Answer in order:

   - Did `analysis` start?
   - Was `provider-selection` completed?
   - Which provider operation was started?
   - Is there a matching completion event?
   - How many attempts exist for that operation?
   - Did any attempt lack an HTTP status, indicating timeout/transport failure?
   - What status, provider code, classification, duration, payload size, and response
     hash were recorded?
   - Did property resolution complete?
   - Were Market report and Investment decision stages completed?
   - What final application error code completed the run?

4. Correlate structured logs using `runId` and then `operationId`. Never search by
   address or secret.

### Example: authentication failure

```json
{
  "event": "market_provider_request_completed",
  "runId": "MI-20260728010101-...",
  "operationId": "mi-operation-...",
  "provider": "rentcast",
  "operation": "property-resolution",
  "attempt": 1,
  "result": "failed",
  "status": 401,
  "classification": "AUTHENTICATION",
  "retryable": false,
  "durationMs": 428
}
```

The user still receives:

```text
Market data is temporarily unavailable. Your assumptions were preserved and you can retry.
```

## Verification contract

Automated coverage must prove:

- classification for the complete HTTP/provider taxonomy;
- deterministic safe request hashes;
- successful response metadata;
- HTTP 401, 404, 429, and 500 metadata;
- timeout, invalid JSON, and transport failure metadata;
- distinct correlated records for every retry attempt;
- absence of API keys, exact addresses, raw bodies, and raw transport errors;
- persisted run/operation/event relationships and administrator-only reads;
- unchanged safe user-facing error messages.

