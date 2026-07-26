# Guidebook Publishing Architecture

The canonical flow is:

`Property → Guidebook Draft → Preview → Immutable Version → Published Guest Experience → Guest Communications`

`Guidebook` is the editable aggregate. Sections and blocks are draft content. `GuidebookVersion` is an immutable snapshot containing the approved content, branding, recommendations, and synchronized guest-safe Property facts used at publication time.

The public projection loads only the Guidebook’s current `published_version`. Viewing historical versions never performs a live Property query. Publishing advances the Guidebook pointer but does not update or delete earlier snapshots.

Property synchronization uses canonical Property fields for name, address, coordinates, check-in, checkout, amenities, and house rules. The snapshot records the Property source timestamp.

Public slugs are random, unguessable identifiers, but are not treated as authorization secrets. Unpublishing removes public availability. Public rendering performs no content or synchronization calculations.

Guidebook media uses a dedicated asset bucket. Published assets are guest-readable; write access remains server-side. Analytics capture a bounded event type, Guidebook version, optional section, time, and anonymous visitor reference without guest PII.

Optimistic revisions protect draft edits. Published snapshots and activity history are append-only. Application authorization checks workspace role, property scope, and Commerce entitlements before state changes.
