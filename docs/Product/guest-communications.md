# Guest Communication Workspace

PC-001E establishes a reservation-centered workspace, not a generic message inbox. A Conversation is the primary aggregate and always carries canonical Guest, Reservation, and Property identity.

The operator experience combines an inbox, immutable communication history, reservation and property context, reviewed drafts, scheduled messages, reusable templates, private notes, Guidebook readiness, and Action Center lineage. Delivery states remain distinct: Draft, Queued, Sent, Delivered, Failed, Read, and Unknown.

Hospitable is the v1 provider. Provider objects are isolated behind the communication adapter boundary. The current Hospitable client is read-only, so the application does not falsely claim that a draft was sent. Outbound delivery becomes available only when a verified provider operation is configured.

AI-assisted copy is always labeled as a draft, is restricted to authorized Conversation, Reservation, Property, and published Guidebook context, and must be reviewed by a human before delivery.

The canonical routes are `/dashboard/communications` and `/dashboard/communications/[conversationId]`. `/messages` redirects to the canonical workspace.

## Access and privacy

Workspace permissions distinguish view, reply, and manage operations. Property scope is enforced before returning a conversation. Only Owner and Administrator roles receive operational contact details. Internal notes are never guest-visible, attachments use private storage, and outbound state cannot be supplied by the browser.

## Intentional states

The UI supports no-conversation, no-history, partial reservation context, degraded provider context, permission-limited, draft, queued, and provider-unavailable states. A published Guidebook URL must be resolved by the Guidebook capability before it can be inserted.
