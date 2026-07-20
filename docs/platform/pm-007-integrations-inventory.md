# PM-007 Integrations Inventory

Status: provider boundaries implemented; existing Hospitable sync preserved  
Scope: `src/features/integrations` plus provider infrastructure owned by feature contexts  
Recorded: 2026-07-19

## Boundary decision

Integrations translate between external systems and Luxe Haven contracts. They own transport, normalization, provider capabilities, authentication boundaries, synchronization, idempotency, technical failures, and observability. They do not own business conclusions or work creation.

```text
external payload → provider client → normalization + provenance → feature fact / Observation

approved Platform Action → command mapper → provider request → technical Outcome
                                                                  ↓ later measurement
                                                        Analytics/domain Outcome
```

An integration technical Outcome records whether a provider operation succeeded. It does not claim the business intervention achieved its intended financial or operational effect.

## Export classification

| Area or export | Classification | Ownership and disposition |
| --- | --- | --- |
| `hospitableRequest` | Provider client | Hospitable infrastructure; token and base URL remain private |
| property/reservation retrieval | Provider client | Hospitable transport and pagination |
| Hospitable payload types | Provider transport DTO | Contained under `hospitable/types`; removed from public feature barrel |
| `mapHospitableProperty` | Inbound adapter | Provider payload to persistence mapping |
| `mapHospitableReservation` | Inbound adapter / repository DTO | Provider payload to booking upsert row |
| `normalizeHospitableReservation` | Inbound adapter | Provider payload to provider-neutral reservation fact plus provenance |
| `syncHospitableProperties` | Sync orchestration + repository | Properties, connection, external-property link, run history |
| `syncHospitableReservations` | Sync orchestration + repository | Reservations, batching, upsert, idempotency, run history |
| `runHospitableReservationSync` | Sync orchestration | Default rolling synchronization window |
| `runInBatches` | Sync orchestration | Bounded concurrency utility |
| `authorizeHospitableSyncRequest` | Authentication boundary | Admin/session and secret-based route authorization |
| `getIntegrationsDashboard` | Repository + Analytics projection | Admin connection and sync-history projection |
| dashboard types/components | Compatibility/presentation surface | Behavior-free admin read models |
| `IntegrationProviderRegistry` | Configuration/capability registry | Declares supported transport capabilities only |
| `inboundRecordsToObservations` | Inbound Platform adapter | Full canonical provenance boundary |
| `executeIntegrationAction` | Outbound adapter | Approved Action to provider command and technical Outcome |
| sync counters/errors/logs | Observability | Technical operational history |

No Recommendation, Decision, business Intelligence, business score, or integration-owned Action entity was identified or introduced.

## Provider inventory

### Hospitable

Capabilities currently declared:

- read properties;
- read reservations.

Current transport is read-only. No Hospitable write capability is advertised until a real command adapter exists and is tested.

Transport behavior:

- bearer token from `HOSPITABLE_API_TOKEN`;
- optional HTTPS-only `HOSPITABLE_API_BASE_URL`;
- 20-second default timeout;
- sanitized provider error body capped at 500 characters;
- 408, 429, and 5xx classified as retryable technical errors;
- cursor/page traversal for provider collections;
- no webhook receiver identified; synchronization is route-triggered polling.

Normalization behavior:

- provider status is translated to booking and payment status;
- monetary values are converted from provider minor units;
- external property and reservation identifiers remain external references;
- local property identity is resolved through `external_properties`;
- raw payload may be retained in the booking repository;
- `normalizeHospitableReservation` returns provider-neutral facts with operation, version, retrieval/effective time, sync run, scope, and raw-payload reference.

### RentCast

Capabilities currently declared:

- read properties;
- provide comparables;
- provide valuations.

RentCast transport and DTO mapping live under `src/features/market-intelligence/infrastructure/rentcast`. This is intentional because Market Intelligence owns provider selection and normalization into Market inputs. PM-007 does not relocate working Market-owned infrastructure. RentCast payload types remain confined to that infrastructure and canonical provenance is produced by the Market provider adapters established in PM-003.

### Supabase

Supabase is the persistence transport, not a business provider. Current repository behavior is embedded in integration query/sync files rather than separate repository classes.

Tables referenced by Integrations include:

- `integration_connections`;
- `integration_sync_runs`;
- `external_properties`;
- `properties`;
- `bookings`.

Supabase row shapes are private local types or mapper outputs. They are not exported as feature-domain contracts.

### Declared dashboard placeholders

The existing `IntegrationProvider` presentation union includes PriceLabs, Wheelhouse, QuickBooks, and Stripe. These are dashboard/configuration vocabulary only; no active provider clients or capabilities were found. The canonical registry advertises only implemented Hospitable and RentCast capabilities.

## Sync orchestration and idempotency

Hospitable reservation synchronization owns:

- date window and pagination;
- configurable batch size limited to 1–10;
- bounded concurrent reservation-detail requests;
- existing external-ID lookup;
- upsert conflict key `external_provider,external_reservation_id`;
- stale-running-sync expiry after 30 minutes;
- database uniqueness handling (`23505`) for concurrent runs;
- discovered, processed, created, updated, skipped, and failed counts;
- per-record failure collection;
- completed, partial, and failed run status;
- connection health and last-sync timestamps;
- safe best-effort failed-run finalization.

This is technical sync policy. It contains no hospitality conclusions.

## Provenance contract

`IntegrationProvenance` preserves:

- provider identity;
- external record identifier;
- retrieval and effective time;
- endpoint or operation;
- normalization version;
- sync-run identifier;
- account/property scope;
- retained raw-payload reference.

`inboundRecordsToObservations` maps these values into Platform source, provenance, stable identity, and metadata. Feature-native normalized records may be used instead when no reasoning boundary is crossed.

## Outbound Action execution

`executeIntegrationAction` accepts only a canonical Platform Action that:

- has Decision lineage;
- is accepted, scheduled, or in progress;
- has a type supported by the provider adapter.

The provider mapper must use the canonical Action ID as its idempotency key. Provider identity must match the command. The immediate result becomes a technical Platform Outcome containing provider status, retryability, error code, external execution ID, and complete Action/Decision lineage.

Integrations do not manufacture, accept, prioritize, or complete the originating business Action. No concrete write provider is enabled yet; the interface exists for providers that gain verified write capabilities.

## Error and Outcome distinction

| Record | Owner | Example |
| --- | --- | --- |
| Provider execution result | Integration | HTTP 429, timeout, external request ID |
| Technical Outcome | Platform record produced by Integration | Approved pricing update accepted by provider |
| Business Outcome | Analytics/domain measurement | Revenue changed 8% after pricing update |

Technical Outcomes contain no business-impact metrics. Later measurement is produced from Analytics and domain intelligence.

## Authentication and secrets

- Hospitable credentials are read server-side only.
- API base URLs must be valid HTTPS URLs.
- Supabase service-role credentials are accessed through the admin client boundary.
- The admin synchronization route invokes `authorizeHospitableSyncRequest` before starting work.
- No provider secret is returned through the integration dashboard projection.

## Consumers

| Consumer | Boundary |
| --- | --- |
| Admin integrations page | `getIntegrationsDashboard` projection |
| Hospitable admin sync API route | authorization plus `runHospitableReservationSync` |
| Analytics | persisted normalized bookings, never Hospitable payload DTOs |
| Market Intelligence | Market-owned RentCast provider adapters |
| Future Automation | canonical Action through `OutboundActionProvider` |
| Platform reasoning | normalized inbound record through Observation adapter |

No direct UI-to-provider call was identified. The client-side sync button invokes the protected application route.

## Compatibility register

- dashboard provider/status unions combine implemented and placeholder providers; presentation only;
- `HospitablePropertyMapping` and `HospitableReservationMapping` are persistence compatibility DTOs;
- raw transport helpers remain available from the Hospitable subpackage for existing server code but provider payload types are no longer exported from its public barrel;
- sync status vocabulary mirrors persisted `integration_sync_runs` values and remains technical, not a Platform lifecycle;
- repository logic remains colocated with sync orchestration during PM-007 to avoid a broad persistence rewrite.

## Persistence rule

Persist durable provider links, raw payloads when operationally required, normalized source records, sync cursors/windows, run state, counts, and failures. Do not persist invented business interpretation. External identifiers remain provider references and never replace Luxe Haven domain identity.

## Completion evidence

PM-007 validation covers provider capability discovery, inbound provenance, Action approval and idempotency enforcement, technical Outcome lineage, architecture lint, adoption reporting, lint, typecheck, full Vitest, production build, and diff validation.
