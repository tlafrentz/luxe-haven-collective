# Guest Communications Architecture

The dependency flow is:

`Guest → Reservation → Conversation → Communication Timeline → Templates → Guidebook → Actions → Guest Experience`

`GuestConversation` owns identity, channel, status, assignment, unread count, revision, and timeline. Messages, notes, attachments, AI drafts, template use, status changes, and Action Center links append evidence to that timeline. Sent history and notes are immutable.

Presentation calls the Guest Communications application boundary. Reservation details come from `getReservationContext`; Guidebook publishing and Action Center remain bounded capabilities. Provider adapters normalize provider messages and delivery states so Hospitable types never enter the domain or presentation.

Writes use authenticated workspace authorization followed by a server-side persistence operation. Property scope is checked before reads or writes. Optimistic revisions protect conversation changes. Provider message IDs and command idempotency keys prevent duplicate effects.

The v1 database uses `guest_conversations`, messages, templates, notes, attachments, timeline, Action links, and AI drafts. Attachments are stored in a private bucket. RLS provides a final isolation layer; application authorization performs role and property filtering before projection.

Outbound delivery is intentionally not emulated. Draft and scheduling persistence are supported, while Sent, Delivered, Failed, Read, and Unknown must originate from a configured communication provider.
