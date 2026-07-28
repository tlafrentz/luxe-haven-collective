# GM-001A — Hospitable Messaging Audit

Status: Complete as a read-only audit  
Audit date: 2026-07-27  
Provider API observed: Hospitable Public API v2  
Runtime, schema, migration, and production writes made by this audit: None

## Executive summary

Historical Hospitable messages are available, and the credential configured in
this workspace can read them.

Two representative, already-synchronized reservations were inspected through
redacted read-only queries:

| Reservation fingerprint | Canonical conversation | Canonical messages | Provider messages | Canonical participants | Canonical activity |
| --- | ---: | ---: | ---: | ---: | ---: |
| `d19b8d0398bc` | 1 | 0 | 7 | 1 | 1 |
| `cda373eac89a` | 1 | 0 | 37 | 1 | 1 |

Both provider requests returned HTTP 200. The current credential is therefore
authorized for reservation message history; reconnecting is not required for
read access.

The first observed failing boundary is the historical message-sync trigger:

```text
Hospitable reservation history GET       verified
Provider message response                verified
Booking / conversation / link            verified
Historical message sync execution        never observed
Canonical message persistence            zero rows
Guest Communications projection          correctly reads zero persisted rows
```

The repository already contains:

- `getHospitableReservationMessages`;
- a `syncHospitableMessages` service;
- a manual admin route and CLI script;
- an idempotent append RPC;
- a real-time webhook route.

However, the connected database has no `messages` sync-run records. The existing
backfill implementation should not simply be run in production. It lacks
per-reservation completion state, paced retry behavior, ambiguity rejection, and
lossless handling of the observed provider contract. Its default concurrency is
also unsafe relative to the observed rate-limit response.

Recommended GM-001B boundary: a dedicated, resumable message-hydration service
with concurrency one, provider-aware retry/backoff, deterministic provider
identity, explicit reservation-to-conversation validation, transactional
per-message ingestion, and persisted per-reservation hydration state. Reservation
sync should enqueue or mark work; it should not fetch message history inline.

Schema result: **schema requires a migration** for safe completion tracking and
unambiguous reservation ownership. The existing tables can store basic text
messages, but cannot represent the observed provider response losslessly.

## Evidence classification

This report distinguishes:

- **Official documentation** — Hospitable's current developer site.
- **Authenticated observation** — low-volume GET requests using the configured
  credential, with identifiers fingerprinted and bodies excluded.
- **Repository evidence** — current source, tests, and migrations at `7ab1ed1c`.
- **Unverified** — behavior not stated in accessible official documentation and
  not safely established by the sampled requests.

Official sources reviewed:

- [Hospitable Developer Hub](https://developer.hospitable.com/)
- [Hospitable authentication](https://developer.hospitable.com/docs/public-api-docs/xpyjv51qyelmp-authentication)
- [Hospitable pagination](https://developer.hospitable.com/docs/public-api-docs/dbc4b7ed7eb1b-pagination)
- [Get reservation messages](https://developer.hospitable.com/docs/public-api-docs/e5ngydnhdwct3-get-reservation-messages)
- [Send message for reservation](https://developer.hospitable.com/docs/public-api-docs/cuw2dqw0owo9y-send-message-for-reservation)
- [Hospitable API v2 webhooks](https://developer.hospitable.com/docs/public-api-docs/k4ctofvqu0w8g-hospitable-api-v2)

The Stoplight-hosted operation pages intermittently rendered a server error in a
non-JavaScript client. The official navigation manifest identifies both message
operations. Exact response behavior below is therefore based primarily on the
authenticated v2 observations, not on inferred documentation.

## 1. Verified Hospitable API capability

| Question | Result | Evidence |
| --- | --- | --- |
| Message endpoint available | **Yes** | Official operation plus two HTTP 200 responses |
| Current credential authorized | **Yes** | Two successful authenticated GETs |
| Reconnect required for reads | **No** | Current token already succeeds |
| API version | v2 | Configured base and official Public API |
| Method | `GET` | Authenticated observation and repository client |
| Path | `/reservations/{uuid}/messages` | Official operation and HTTP request |
| Required path value | Hospitable reservation UUID/reference | Both persisted references succeeded |
| Query parameters | None observed or used | Response was `{"data":[...]}` |
| Pagination | No pagination envelope observed | No `links` or `meta` in either response |
| Documented history window | **Unverified** | Not available in accessible documentation |
| Supported channels | **Partially verified** | Both samples were Airbnb only |
| Rate limit | Account response reported `x-ratelimit-limit: 2` | Unit/window not disclosed by response |

The two responses contained 44 messages total. Earliest and latest occurrence
times were:

- sample one: 2026-06-26T21:37:08Z through 2026-06-29T01:00:37Z;
- sample two: 2026-06-27T07:20:54Z through 2026-07-25T22:11:21Z.

This proves availability for these reservations only. It does not establish an
account-wide history window, deleted-message behavior, or parity across Airbnb,
Vrbo, Booking.com, and direct channels.

### Authentication and credential scope

The code uses `Authorization: Bearer <HOSPITABLE_API_TOKEN>`. Hospitable's
official authentication page describes Personal Access Tokens and OAuth 2.0
authorization grants. The configured environment contains a token and v2 base
URL; no secret value was printed.

| Item | Result |
| --- | --- |
| Authentication method | Bearer token; repository documentation calls it a Personal Access Token |
| Granted message scope | Not introspectable from local configuration |
| Effective message permission | Verified by HTTP 200 |
| Provider account/organization identity | Unverified; no identity request was needed |
| Production versus preview credential parity | Unverified |
| Reconnection required | No for current read endpoint; unverified for webhooks |

## 2. Existing provider-client inventory

| File | Function / boundary | Responsibility | Called | Pagination | Retry |
| --- | --- | --- | --- | --- | --- |
| `src/features/integrations/hospitable/lib/client.ts` | `hospitableRequest` | Bearer authentication, HTTPS URL, timeout, no-store fetch, provider error mapping | Yes | Search parameters supported | Classifies retryable errors but does not retry |
| `.../lib/reservations.ts` | `getAllHospitableReservations` | Page-number reservation retrieval | Yes | Yes, `links.next` / page metadata | No |
| `.../lib/messages.ts` | `getHospitableReservationMessages` | GET reservation message history | Yes, only from message sync | No | No |
| `.../lib/messages.ts` | `normalizeHospitableMessage` | Maps provider text message to canonical ingestion input | Yes | N/A | Rejects invalid records |
| `.../lib/messages.ts` | `sendHospitableReservationMessage` | POST outbound provider message | Called by delivery adapter | N/A | No |
| `.../lib/sync-messages.ts` | `syncHospitableMessages` | Select linked reservations, retrieve messages, append by RPC, record aggregate run | Manual/admin/adapter | No | No |
| `.../lib/messaging-adapter.ts` | `hospitableMessagingAdapter` | Provider-neutral messaging boundary | Registry consumer | Delegates | Delegates |
| `.../lib/sync-reservations.ts` | reservation persistence block | Booking, conversation, participant, reservation link, provider thread | Yes | Reservation pages handled earlier | Batch failure handling |
| `scripts/sync-hospitable-messages.ts` | `main` | Manual full linked-reservation backfill | Not observed in connected data | No | No |
| `src/app/api/admin/integrations/hospitable/messages/sync/route.ts` | `POST` | Administrator-triggered message sync | No run observed | No | No |
| `src/app/api/webhooks/hospitable/messages/route.ts` | `POST` | Real-time inbound append or review queue | Configuration incomplete | N/A | Provider retry expected but unverified |

Answer: a message-fetching method exists and is wired to a dedicated sync
service, but reservation synchronization does not invoke it and no message sync
has executed against the connected data.

## 3. Current reservation-sync sequence

```text
Admin/manual reservation sync
    |
    v
getAllHospitableReservations
    |
    v
reservation detail requests in batches
    |
    v
mapHospitableReservation
    |
    v
bookings upsert
    |
    +--> guest identity / provider references
    |
    +--> resolve or create guest_conversations
    |
    +--> create participant and conversation-created activity
    |
    +--> upsert guest_conversation_reservations
    |
    +--> upsert guest_conversation_provider_threads
    |
    X   no getHospitableReservationMessages call
```

Reservation retrieval supports pagination. Reservation persistence is not one
database transaction: booking, conversation, participant, activity, link, thread,
and conversation updates are separate operations. The message audit does not
change that behavior, but GM-001B must not assume shell creation is atomic.

The persisted retrieval identifier is
`bookings.external_reservation_id`; it is copied into:

- `guest_conversations.reservation_id`;
- `guest_conversations.active_reservation_id`;
- `guest_conversation_reservations.reservation_id`;
- `guest_conversation_provider_threads.thread_id`;
- `guest_conversation_provider_threads.reservation_reference`.

Both representative bookings had usable provider reservation identifiers.

## 4. Expected message retrieval sequence

```text
Eligible canonical booking
    |
    v
external_provider = hospitable
external_reservation_id present
    |
    v
resolve exactly one workspace-owned reservation link
    |
    v
GET /v2/reservations/{uuid}/messages
    |
    v
validate complete response / pagination contract
    |
    v
normalize each provider observation
    |
    v
append_guest_provider_message transaction
    |
    v
mark reservation hydration complete or partial
    |
    v
Guest Communications canonical projection
```

Expected edge behavior:

- Booking and conversation exist: hydrate the exact linked conversation.
- Booking exists without a conversation: create/repair the shell through the
  canonical conversation resolver before hydration.
- Conversation exists without the reservation link: do not infer from mutable
  conversation fields; repair linkage first.
- Multiple conversations reference one booking/reservation: reject as ambiguous.
- Provider identifier absent: mark ineligible with an actionable reason.
- Other-workspace linkage: reject before provider retrieval and emit a security
  event.
- Cancelled/archived reservation retrievability: **unverified**.

## 5. Provider response contract

The sampled response shape was:

```text
{
  data: Message[]
}
```

Every observed record exposed the same field set:

```text
attachments
body
content_type
conversation_id
created_at
id
integration
platform
platform_id
reactions
reservation_id
sender
sender_role
sender_type
sent_reference_id
source
```

Observed characteristics:

- all 44 records had `id` and `platform_id`;
- none had `sent_reference_id`;
- current fallback `platform + platform_id` was present and unique for all 44;
- `sender_type` was `guest` or `host`;
- `sender_role` was `host` or absent;
- `content_type` was `text/plain`;
- `source` was `automated`, `hospitable`, or `platform`;
- two records had no non-empty body;
- no sampled records contained attachments;
- no duplicate `id` or current compound dedupe keys were observed.

| Provider field | Classification | Canonical use |
| --- | --- | --- |
| `id` | Required | Preferred provider-native message identity |
| `reservation_id` | Required | Validate requested reservation and linkage |
| `conversation_id` | Useful | Provider thread reference; do not replace canonical identity |
| `platform` | Required | Channel/provenance |
| `platform_id` | Required fallback | Stable compound identity if `id` semantics are not guaranteed |
| `sent_reference_id` | Optional | Alternative provider reference; absent in sample |
| `sender_type` | Required | Direction and participant classification |
| `sender_role` | Useful | Direction cross-check |
| `sender` | Useful/sensitive | Display identity after minimization |
| `body` | Required for current text model | Plain-text content; two observations require policy |
| `content_type` | Required | Validate renderer/storage path |
| `created_at` | Required | Provider occurrence time |
| `source` | Useful | Automated/provider/platform classification |
| `integration` | Optional | Provider/channel lineage |
| `attachments` | Useful but unverified | Attachment ingestion contract |
| `reactions` | Deferred | Unsupported by canonical model |
| updated/read/delivery/deletion fields | Unverified | Not observed |
| language/reply relationship | Unverified | Not observed |

## 6. Canonical field mapping

| Hospitable observation | Canonical target | Current mapping | Finding |
| --- | --- | --- | --- |
| `id` | provider observation ID | Ignored | High: strongest visible identity is discarded |
| `platform + platform_id` | fallback provider message ID | Used when `sent_reference_id` absent | Works for 44/44 sample |
| reservation identifier | booking and reservation link | Used to select sync input, not revalidated per message | Must validate response membership |
| `conversation_id` | provider thread | Ignored by backfill | Existing thread uses reservation ID instead |
| `sender_type` | sender and direction | guest → inbound; every other value → outbound | Unknown/system is misclassified |
| `body` | message body | Trimmed plain text, 1–10,000 chars | Safe for text, incomplete for empty/non-text events |
| `created_at` | provider occurrence time | Stored as message `created_at` | Correct |
| ingestion time | new field/status metadata | Not stored on message | Available only indirectly through database/log timestamps |
| `platform` | message channel | Stored | Correct for known channel values |
| `source` | provenance/system classification | Ignored | Automated messages cannot be distinguished |
| attachments | canonical attachments | Ignored | Lossy |
| reactions/status/update state | observations | Ignored | Lossy/unverified |

Canonical identity recommendation:

1. `provider=hospitable + provider response id`;
2. retain `platform + platform_id` as a secondary external reference;
3. use `sent_reference_id` only when populated and documented;
4. never use timestamp plus body as the primary key.

Both provider occurrence time and Luxe Haven ingestion time must be retained.
Ordering should be `(provider_created_at, provider_message_id)` so identical
timestamps remain deterministic.

## 7. Direction and participant classification

Observed mapping:

| Hospitable | Canonical |
| --- | --- |
| `sender_type=guest` | guest → operator |
| `sender_type=host` | operator → guest |
| documented/validated automated system source | system → conversation |
| anything else or contradictory fields | unknown; quarantine/review |

The current normalizer treats every non-guest value as operator/outbound. That is
unsafe. Unknown, system, and contradictory records must not be attributed to an
operator.

Names and email addresses must not be used as the primary direction heuristic.

## 8. Persistence and constraints

### Current objects

| Object | Purpose and ownership | Identity / constraints | Mutability / deletion |
| --- | --- | --- | --- |
| `bookings` | Canonical reservation; property/workspace inherited | unique provider + external reservation ID | Mutable provider projection |
| `guest_conversations` | Canonical guest/property relationship | text PK; workspace, booking, guest, property FKs | Mutable operational state; archived |
| `guest_conversation_reservations` | Conversation-to-reservation history | PK `(conversation_id,reservation_id)` | Identity protected; no unique booking/reservation across conversations |
| `guest_conversation_provider_threads` | Provider thread lineage | unique `(workspace_id,provider,thread_id)` | Append-only |
| `guest_communication_messages` | Canonical message content | PK; unique idempotency key; unique `(conversation_id,provider_message_id)` | Content protected; controlled delivery-state updates |
| `guest_message_delivery_events` | Provider delivery observations | unique `(provider,provider_message_id)` when present | Append-only |
| `guest_communication_attachments` | Attachment metadata/private storage | message/conversation FKs | Current provider backfill does not write |
| `guest_conversation_activity` | Safe operational history | PK, conversation/workspace FKs | Append-only |
| `integration_sync_runs` | Aggregate provider sync execution | one running provider/type constraint | Mutable run status |
| `append_guest_provider_message` | Atomic message, delivery, activity, conversation update | service-role RPC; deterministic SHA-256 IDs | Insert-once behavior |

The append RPC is atomic for one message and uses provider identity to make
webhook/backfill overlap idempotent. It does not upsert later provider changes.

### Schema conclusion

**Schema requires migration.**

Basic text history fits today, but a safe complete backfill needs:

1. per-reservation hydration state (`not_started`, `in_progress`, `complete`,
   `partial`, `failed`) with attempts, expected/observed counts, last error,
   started/completed timestamps, and optional continuation state;
2. an invariant preventing one booking/provider reservation from resolving to
   multiple canonical conversations;
3. separate provider-native `id`, platform ID, content type, source, and ingestion
   timestamp, or a bounded provider-observation metadata table;
4. attachment lineage if attachments are in GM-001B scope.

No migration was created during this audit.

## 9. Deduplication, pagination, and completeness

The current append RPC derives canonical IDs from
`SHA-256(provider + providerMessageId)` and uses
`provider:<provider>:<providerMessageId>` as the idempotency key. This protects:

- repeated full-history syncs;
- a webhook before or after backfill;
- a retried response;
- out-of-order delivery.

It does not safely resolve:

- the same reservation linked to multiple conversations;
- changed/deleted provider records;
- records whose identity fallback changes;
- partial runs without per-reservation state.

No `links`, `meta`, or pagination query was present in the two observed message
responses. The current client returns one `data` array and cannot paginate. The
official account-wide history window and future pagination behavior remain
unverified. GM-001B should validate the envelope and follow pagination if the
provider exposes it, while treating an unpaginated response as one complete page.

A reservation is complete only after every page has validated and every message
has one of:

- inserted;
- resolved as an existing identical provider message;
- quarantined with a durable reason.

Aggregate `integration_sync_runs` status alone cannot prove this.

## 10. Webhook coexistence and race conditions

The expected model is feasible:

```text
Historical API hydration
        +
Message webhook ingestion
        +
Scheduled reconciliation
        |
        v
provider + provider message identity
        |
        v
exactly one canonical message
```

Current webhook findings:

- Route: `POST /api/webhooks/hospitable/messages`.
- It accepts either a bearer secret or a custom
  `x-luxe-webhook-timestamp` / `x-luxe-webhook-signature`.
- It has a five-minute timestamp window for the custom signature.
- It assumes the payload contains full message content.
- It does not inspect or validate a provider event type.
- Unknown reservations enter an idempotent review queue.
- Known reservations call `append_guest_inbound_message`.
- Duplicate behavior relies on provider message identity.
- `HOSPITABLE_WEBHOOK_SECRET` is absent from the inspected environment; only the
  separate sync secret is configured.
- Official Hospitable message event names, signature scheme, retry schedule,
  payload completeness, and ordering guarantees are **unverified**.

The route therefore cannot be claimed as an operational Hospitable webhook
integration. Its authentication contract must be matched against official
provider delivery before GM-001B relies on it.

Race analysis:

| Race | Current protection | Gap |
| --- | --- | --- |
| Webhook before backfill | Provider identity conflict | Backfill and webhook use different RPCs and message-ID construction |
| Backfill before webhook retry | Provider delivery-event identity | Exact cross-RPC parity needs integration test |
| Message arrives during retrieval | Reconciliation can recover it | No reconciliation schedule/completion watermark |
| Two message syncs | Unique running sync-run constraint | Stale-run expiry and service-role callers still need concurrency tests |
| Conversation created concurrently | Provider-thread uniqueness | Reservation link is not globally unique |
| Multiple conversation links | First insert wins by query order | Critical ambiguity is not rejected |

## 11. Attachments and mutation policy

The provider response includes an `attachments` array. No attachments were present
in the sample, so identifier, filename, MIME type, size, authorization, and URL
expiration are unverified. The current TypeScript type retains only `type` and
`url`; the normalizer discards both.

Recommendation for GM-001B:

- persist metadata first;
- do not expose an unvalidated provider URL directly;
- copy content into the existing private attachment bucket only after Hospitable
  documents URL lifetime and authorization;
- let a failed attachment preserve the text message and a recoverable attachment
  state.

Observed messages had no update, read, delivery, deletion, or redaction field.
Use an immutable message plus append-only provider observations. Do not upsert
historical body or sender identity until provider mutation semantics are verified.

## 12. Timestamp, ordering, and content safety

`created_at` is the provider occurrence timestamp and was UTC in all sampled
records. The current schema stores it correctly but has no explicit ingestion
timestamp on the message.

Canonical order:

```text
provider occurrence time
then provider identity
```

Delayed ingestion must not reorder history by import time.

Current content protection:

- accepts only non-empty trimmed text;
- rejects over 10,000 characters;
- stores message bodies in a constrained text column;
- React renders text rather than provider HTML;
- no raw provider payload is persisted.

Gaps:

- trimming may remove meaningful whitespace;
- two sampled records had no text and would be counted as failures;
- content type is not persisted;
- attachment-only/system observations have no canonical representation;
- control-character normalization and URL policy are not explicit.

Recommendation: store validated plain text plus the original content type and a
provider observation record. Do not store or render provider HTML without a
separate sanitizer and explicit contract.

## 13. Authorization and tenant isolation

Intended chain:

```text
workspace membership
    -> property scope
    -> booking
    -> conversation
    -> message
```

Application reads resolve membership and property access. The detail action first
retrieves a candidate conversation with the service-role client and then
authorizes it; related message rows are fetched only after authorization.

RLS is not aligned:

- the original `guest_conversations` and message policies allow direct owner
  (`workspace_id=auth.uid()`) or global administrator access;
- later participant, reservation, activity, and delivery policies use
  `can_access_workspace_property`;
- the owner-only message policy was not replaced;
- application reads bypass RLS through the admin client after application checks.

Consequences:

- authorized non-owner members can succeed through the application but fail a
  direct authenticated database read;
- the application and database do not produce identical decisions;
- application regressions have elevated impact because the service role bypasses
  RLS.

GM-001B must use one workspace/property authorization decision and align message,
conversation, attachment, timeline, and provider-thread RLS. A provider
reservation ID alone must never authorize lookup or attachment.

Role evidence:

| Context | Application intent | RLS evidence |
| --- | --- | --- |
| Owner | Allow | Allow |
| Administrator | Allow | Global admin policy permits |
| Authorized member | Allow by permission/property | Message RLS mismatch |
| Property-restricted allowed | Allow | Message RLS mismatch |
| Property-restricted disallowed | Deny | Later child policies deny; message policy owner-only |
| Other workspace | Deny | Owner equality denies |
| Anonymous | Deny | Authenticated-only grants |

No live authenticated RLS matrix was executed.

## 14. Guest Communications read path

```text
/dashboard/communications
    -> getGuestCommunicationsInbox
    -> authorized conversation rows
    -> latest canonical message query
    -> inbox projection

/dashboard/communications/{conversationId}
    -> getGuestCommunicationWorkspaceRequest
    -> candidate conversation
    -> workspace membership + property access
    -> guest_communication_messages ordered by created_at
    -> canonical aggregate
    -> guest conversation projection
    -> thread UI
```

The message table is queried. The zero-message UI state is caused by missing
canonical persistence, not by a projection filter. Historical and live messages
use the same canonical table/projection.

Two additional findings:

- Message queries have no application pagination; the entire conversation is
  loaded.
- The detail read persists communication-guidance recommendations. That does not
  mutate messages, but the nominal read path is not globally read-only.

## 15. Existing-data verification

Read-only Supabase evidence:

- eligible Hospitable bookings with provider reservation ID: 2;
- canonical reservation links: 2;
- Hospitable provider threads: 2;
- canonical conversations in sample: 2;
- canonical participants: 1 per conversation;
- canonical activity: 1 per conversation;
- canonical messages: 0;
- historical message sync runs: 0;
- integration connection: active;
- most recent recorded successful integration sync:
  2026-07-25T01:24:52.166Z;
- message-sync failures: none, because no message sync was recorded.

Read-only provider evidence:

- HTTP 200 for both reservations;
- 7 and 37 messages;
- 44 stable provider IDs and platform IDs;
- zero duplicate observed IDs;
- zero attachments in sample;
- two records without non-empty text.

No names, bodies, contact details, full IDs, tokens, or raw payloads were retained
in this document.

## 16. Rate limits and workload

The provider returned:

```text
x-ratelimit-limit: 2
x-ratelimit-remaining: 0
```

The window unit and reset time were not exposed. The client recognizes HTTP 429
as retryable but performs no retry or pacing. The message sync defaults to five
concurrent reservations and allows ten. That is unsafe against the observed
limit.

Current connected workload:

- 2 eligible reservations;
- 2 GET requests if the response remains unpaginated;
- 44 observed provider messages;
- estimated provider retrieval time is small, but writes and validation must
  still be bounded.

Initial rollout recommendation:

- concurrency: 1;
- pace requests conservatively and adapt to rate headers;
- honor `Retry-After` if supplied;
- exponential backoff with jitter for 429, 408, and 5xx;
- batch one property or at most 25 reservations per resumable run;
- stop on sustained authorization/rate failures;
- never launch an uncontrolled account-wide backfill.

Eligibility recommendation:

1. begin with linked, visible conversations for active/recent reservations;
2. verify counts and operator rendering;
3. expand by property in bounded batches;
4. eventually hydrate every retained reservation allowed by privacy policy.

For the current two-record account, both reservations are reasonable pilot
candidates after GM-001B safeguards are implemented.

## 17. Hydration strategy evaluation

| Option | Assessment |
| --- | --- |
| A — During reservation sync | Reject as primary design: increases sync latency and couples two failure domains |
| B — Dedicated message sync | Strong base: resumable, observable, independently retried |
| C — On-demand read hydration | Reject as primary design: provider dependency in the operator read path |
| D — Hybrid | **Recommended**: dedicated initial backfill + webhook ingestion + scheduled reconciliation |

Reservation sync should mark or enqueue an eligible reservation only. A dedicated
worker performs historical hydration. Reads remain provider-independent.

## 18. Failure and recovery matrix

| Failure | Detection | Current behavior | Expected recovery |
| --- | --- | --- | --- |
| Endpoint unauthorized | 401/403 | Reservation counted failed; run may become partial | Preserve shell, mark configuration failure, stop repeated retries |
| Provider unavailable | timeout/5xx | Per-reservation failure, no retry | Retry with bounded backoff |
| Rate limited | 429 | Marked retryable by client but not retried | Pace and resume using retry metadata |
| Reservation ID missing | eligibility query | Link absent from sync | Durable ineligible reason |
| Pagination failure | Not supported | Cannot occur in current client | Persist continuation; safely resume/restart |
| Invalid payload | normalizer returns null | Count failure; continue | Quarantine fingerprint and reason |
| Empty/attachment-only record | empty-body validation | Count failure | Preserve observation; hydrate supported content |
| Conversation unresolved | no link selected | Not in sync input | Repair shell/link or quarantine |
| Ambiguous conversation | multiple link rows | Each row is attempted; first insert wins | Reject all candidates and emit integrity event |
| Duplicate message | insert conflict | Return `false`, count skipped | Verify existing identity and reuse |
| Provider update/deletion | No detection | Existing immutable row retained silently | Append provider-status observation |
| Cross-workspace mismatch | workspace-filtered links/RPC conversation check | Rejected indirectly | Explicit pre-fetch and transaction validation |
| Partial backfill | Aggregate run status | No per-reservation completion | Mark partial with resume state |
| Attachment unavailable | Not ingested | Silently omitted | Preserve text/metadata; retry attachment independently |

## 19. Logging and observability

Current evidence:

- API failures log path, status, and response availability.
- Route failure logs an error type.
- Aggregate sync runs record processed/created/skipped/failed counts.
- Per-record errors include raw reservation and provider message identifiers in
  the stored error string.
- No structured per-page, duplicate, normalization, or completion logs exist.

Required correlation:

- request ID;
- sync-run ID;
- workspace and property IDs;
- canonical booking and conversation IDs;
- fingerprints, not raw provider reservation/message identifiers;
- page/cursor and attempt;
- outcome and safe reason code.

Never log bodies, guest identities, contact data, credentials, raw payloads, or
provider tokens.

## 20. Retention and privacy

Existing product policy establishes immutable communication history and private
attachment storage. It does not explicitly state:

- historical-import retention period;
- integration-disconnect behavior;
- guest data access/export process;
- account/workspace deletion behavior;
- provider redaction/deletion reconciliation;
- retention of attachment copies;
- handling of sensitive content inside message bodies.

These are unresolved policy questions. GM-001B may import text under the existing
communication-history policy only after product/legal owners confirm it covers
provider history. No new retention policy is inferred here.

## 21. Test inventory

| Area | Coverage | Evidence / gap |
| --- | --- | --- |
| Hospitable request client | Partial | Reservation and error behavior tested elsewhere; no rate retry |
| Message GET client | Partial | One mocked single-page success |
| Message normalization | Partial | Guest/host and invalid text; no observed `id`, empty/system, attachments |
| Reservation normalization | Covered | Mapper tests |
| Reservation orchestration | Partial | Sync behavior covered; shell transactionality not integration-tested |
| Conversation creation/linkage | Partial | Source and domain tests; ambiguous links absent |
| Participant creation | Partial | Repository/source behavior |
| Historical sync orchestration | Not covered | No `syncHospitableMessages` test |
| Append RPC | Partial | Migration exists; no database integration test |
| Webhook signature/event mapping | Not covered | No route test found |
| Webhook/backfill dedupe | Not covered | Requires database integration |
| Canonical message model | Covered at domain level | Immutable append and projection tests |
| Guest Communications projection | Covered at domain level | Server-action/database projection only partially covered |
| Authorization | Partial | Application checks exist; message RLS parity absent |
| RLS | Not covered | No authenticated-context matrix |
| Attachments | Partial | Canonical attachment behavior exists; Hospitable mapping absent |

Minimum GM-001B additions:

1. fixtures based on the redacted observed response shape;
2. provider client envelope and pagination tests;
3. direction tests including unknown/system;
4. full-body, empty-body, attachment-only, and oversize policy tests;
5. orchestration tests for complete/partial/resume;
6. provider rate-limit retry and concurrency tests;
7. database tests for exact-once webhook/backfill races;
8. ambiguous/cross-workspace resolution tests;
9. authenticated RLS parity tests;
10. read projection test proving chronological deterministic rendering.

## 22. Architecture diagrams

### Current state

```text
Hospitable Public API
        |
        v
Reservation Sync
        |
        +--> bookings
        +--> guest_conversations
        +--> participants
        +--> reservation links
        +--> provider threads
        +--> conversation activity
        |
        X   message retrieval not invoked

Separate code exists:
manual message sync --> GET history --> append RPC
but connected sync-run history = zero

Guest Communications --> canonical message query --> []
```

### Target state

```text
Hospitable
   |
   +--> Reservation API
   |       |
   |       v
   |   Booking / canonical conversation / hydration eligibility
   |
   +--> Historical Message API
   |       |
   |       v
   |   resumable, rate-limited hydration worker
   |
   +--> Message Webhook
   |       |
   |       v
   |   validated incremental observation
   |
   +--> Scheduled reconciliation
           |
           v
 provider + provider-native message identity
           |
           v
 transactional canonical append / observation
           |
           v
 Canonical Guest Conversation
   +--> messages
   +--> participants
   +--> reservation context
   +--> attachments
   +--> activity
```

## 23. Severity-ranked findings

### Critical

1. **Ambiguous reservation links are not rejected.** The schema permits one
   reservation/booking to link to multiple conversations. The sync loops every
   link; deterministic global message identity means the first row can win,
   attaching history to an arbitrary conversation.

### High

1. **Historical hydration has never run.** Two provider histories contain 44
   messages while canonical storage contains zero and message sync runs contain
   zero.
2. **Current concurrency conflicts with observed rate limits.** Default
   concurrency is five; the response limit was two and the client has no retry.
3. **No per-reservation completion state exists.** Partial work cannot be proven
   complete or resumed precisely.
4. **Unknown/system direction is misclassified as operator outbound.**
5. **The strongest observed provider `id` is discarded.**
6. **Webhook operation is unverified and unconfigured.** The route expects an
   absent environment key and a locally defined signature contract.
7. **Application and message RLS decisions are inconsistent.** Member/property
   access exists in the application while message RLS remains owner-only.
8. **Historical sync, append RPC, webhook/backfill races, and RLS have no
   integration coverage.**

### Medium

1. Attachments, content type, source, reactions, and provider thread identity are
   discarded.
2. Two of 44 provider observations have empty text and would be marked failed.
3. Provider updates, deletions, read state, and delivery changes are unsupported.
4. Logs and stored sync errors use raw provider identifiers.
5. Conversation message reads are unpaginated.
6. The detail read path writes communication-guidance state.
7. Provider history window and cancelled/archived behavior are unverified.

### Low

1. Language and reply relationships are not represented because the provider
   sample did not expose them.
2. Reactions are not supported.
3. Exact provider account identity and production/preview credential parity are
   unverified.

## 24. Recommended GM-001B implementation

### Provider boundary

Replace the loose array return with:

```text
listReservationMessages({
  reservationId,
  cursor?
}) -> {
  observations,
  nextCursor?,
  complete
}
```

The provider DTO must retain `id`, `platform_id`, `conversation_id`,
`reservation_id`, `content_type`, `source`, timestamps, attachment metadata, and
validated sender classification. Unknown values become quarantined observations,
not outbound operator messages.

### Application service

Create one `hydrateHospitableReservationMessages` service:

1. authorize/resolve workspace connection;
2. lock or claim one reservation hydration record;
3. resolve exactly one booking, property, conversation, and reservation link;
4. fetch each page with concurrency one and bounded retry;
5. validate provider reservation identity;
6. normalize observations;
7. append transactionally by provider-native identity;
8. record inserted/existing/quarantined counts;
9. mark complete only when all pages and observations have durable outcomes.

### Repository and transaction

Use one RPC per bounded page or message batch. It must:

- revalidate workspace, property, booking, reservation link, and conversation;
- reject ambiguity;
- insert/reuse by `(provider, provider_native_message_id)`;
- append delivery/activity/provider observations;
- update conversation summary only from the latest occurrence time;
- update hydration progress atomically.

### Migration

Required:

- per-reservation provider hydration table/state;
- unique canonical booking/reservation-to-conversation invariant;
- lossless provider observation metadata or columns;
- RLS alignment for conversations/messages and hydration status;
- indexes for `(conversation_id, provider_occurrence_time, provider_identity)`.

### Trigger and retry

Use the hybrid strategy:

- bounded initial backfill;
- reservation sync marks eligible work;
- verified provider webhooks append incremental observations;
- scheduled reconciliation repairs gaps.

Provider failure must not roll back reservation sync or make Guest Communications
unreadable.

### Logging

Emit requested/start/page/normalize/reuse/insert/quarantine/partial/complete
events with fingerprints and correlation IDs. Exclude bodies and identity data.

### Tests

The minimum tests are the ten additions in the test inventory, with real
PostgreSQL tests for constraints, RLS, concurrency, and transactional outcomes.

## 25. Read-only production verification checklist

- [x] Confirm Hospitable configuration exists without displaying values.
- [x] Confirm connected integration state.
- [x] Count eligible provider-linked bookings.
- [x] Confirm conversation, participant, reservation-link, and provider-thread
      shells.
- [x] Count canonical messages and activity.
- [x] Inspect message sync-run history.
- [x] GET two known reservation histories.
- [x] Record only counts, field names, time bounds, classifications, and hashed
      identifiers.
- [x] Inspect rate-limit headers.
- [x] Make no message, schema, webhook, integration, or token changes.
- [x] Initiate no sync/backfill route.
- [ ] Verify official webhook event/signature contract — unresolved.
- [ ] Verify cancelled/archived/channel-wide history behavior — unresolved.
- [ ] Execute authenticated RLS matrix — deferred to implementation verification.

## Required research answers

| Question | Answer |
| --- | --- |
| Current endpoint | `GET /v2/reservations/{uuid}/messages` |
| Connected credential can call it | Yes, HTTP 200 twice |
| Available history | 7 and 37 messages for the two current reservations; broader window unverified |
| Paginated | No envelope observed; official general pagination exists, endpoint-specific behavior unverified |
| Stable provider ID | `id` and `platform_id` present for 44/44; current compound key unique |
| Reliable direction | Guest/host in sample; unknown handling is currently unsafe |
| Attachments | Field exists; no sampled attachment; contract unverified |
| Updates/deletions | Unverified and unsupported |
| Webhook completeness | Unverified; current route assumes full content |
| Backfill/webhook risk | Dedupe concept exists, but cross-RPC and ambiguity tests are missing |
| Client method exists | Yes |
| Reservation sync invokes it | No |
| Schema lossless | No |
| Read model queries messages | Yes |
| Safest strategy | Dedicated resumable hydration + verified webhooks + reconciliation |

## Completion report

- Audit document:
  `docs/implementation/gm-001a-hospitable-messaging-audit.md`
- Endpoint capability: **Yes**
- Credential authorization: **Yes**
- Current failing boundary: historical message synchronization has never been
  invoked; no canonical persistence attempt is recorded
- Schema sufficiency: basic text only; **migration required** for safe complete
  implementation
- Recommended backfill: dedicated resumable worker, then verified webhooks and
  scheduled reconciliation
- Provider requests made: 7 low-volume GETs across two known reservations; no
  writes
- Focused tests: 7 files / 33 tests passed
- Typecheck: passed
- `git diff --check`: passed
- Runtime or production behavior changed: **No**
- Production data changed: **No**
- Secrets included: **No**

The working tree contained pre-existing SA-001 changes before this audit. GM-001A
adds only this document; therefore the repository-wide “clean except for the audit
document” criterion cannot be met without disturbing user-owned work.
