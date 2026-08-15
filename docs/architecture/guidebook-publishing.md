# Guidebook Publishing Architecture

The canonical flow is:

`Property → Guidebook Draft → Preview → Immutable Version → Published Guest Experience → Guest Communications`

`Guidebook` is the editable aggregate. Sections and blocks are draft content. `GuidebookVersion` is an immutable snapshot containing the approved content, branding, recommendations, and synchronized guest-safe Property facts used at publication time.

The public projection loads only the Guidebook’s current `published_version`. Viewing historical versions never performs a live Property query. Publishing advances the Guidebook pointer but does not update or delete earlier snapshots.

Property synchronization uses canonical Property fields for name, address, coordinates, check-in, checkout, amenities, and house rules. The snapshot records the Property source timestamp.

Public slugs are random, unguessable identifiers, but are not treated as authorization secrets. Unpublishing removes public availability. Public rendering performs no content or synchronization calculations.

Guidebook media uses a dedicated asset bucket. Published assets are guest-readable; write access remains server-side. Analytics capture a bounded event type, Guidebook version, optional section, time, and anonymous visitor reference without guest PII.

Optimistic revisions protect draft edits. Published snapshots and activity history are append-only. Application authorization checks workspace role, property scope, and Commerce entitlements before state changes.

## Creation Assistant boundary

The Creation Assistant is an upstream producer of canonical draft revisions:

`Authorized Property → Private Sources → Extraction Review → Generation Run → Canonical Draft Revision → Shared Builder`

It does not write published versions or introduce a second authoring aggregate.
Its persistence boundary consists of immutable source records, per-source
extraction results, review decisions, generation runs, source-to-field lineage,
and references to the canonical draft revisions it creates. Generation workers
must call the same authorized draft command boundary used by manual authoring.

Generation is asynchronous, resumable, and idempotent. A logical command may
produce at most one guidebook and one resulting revision. Worker leases and
retries cannot bypass actor, tenant, property, entitlement, component,
template, or revision checks. A completed run points to an immutable record of
its inputs and output revision; regeneration creates a new run and revision.

Source objects remain private. Model requests contain only the minimum content
needed for the active extraction or generation step and must use a provider
configuration that prohibits training on customer data. Prompts, source text,
credentials, addresses, and generated guest content are excluded from ordinary
logs and analytics. Safe telemetry contains stable action identifiers, state,
duration, counts, failure codes, and correlation identifiers only.

Extraction output is evidence, not operational truth. Conflicting values remain
separate candidates with lineage. High-risk values require a human confirmation
record before readiness can pass. Generation cannot infer a missing high-risk
value. Unsupported or unapproved components fail closed before a draft command
is issued and surface a customer-safe remediation message.
