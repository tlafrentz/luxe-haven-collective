# Guest Communications

## Product mission

Guest Communications is the canonical workspace for every conversation involved in operating a hospitality business. It helps owners, operators, property managers, and guest-services teams answer: **Which conversations require my attention, and how can Luxe Haven help me respond?**

The navigation retains the familiar **Messages** label under Business while the product presents the broader business capability as **Guest Communications**.

## Product model and ownership

The unit of work is a **Guest Conversation**, not an email or channel thread. Airbnb, VRBO, Booking.com, direct, email, and SMS messages for one guest journey belong to one conversation. WhatsApp and a guest app can be added later without changing this model.

Guest Communications owns conversations, threads, messages, drafts, templates, communication timelines, AI assistance, scheduling, search, and unread state. It references guests, reservations, bookings, properties, guidebooks, and actions without duplicating their records.

Every conversation has an explicit status: **Open, Waiting for Guest, Waiting for Host, Scheduled, Closed, or Archived**. Read and unread remain attributes, not workflow statuses.

## Guest communication lifecycle

Conversations are organized around the hospitality journey:

1. Inquiry
2. Reservation
3. Before arrival
4. Arrival
5. Stay
6. Departure
7. After stay

The guest timeline is the durable organizing concept. Channels are source metadata.

## Primary sections

### Inbox

**Mission:** Present every active guest conversation.  
**Question:** What conversations are happening?  
**Workflow:** Review open conversations; scan guest, property, journey stage, source, status, and AI-draft availability; open a unified thread; respond.  
**Future roadmap:** Shared inboxes, assignment, internal comments, and guest memory.

### Needs Attention

**Mission:** Prioritize operator work by hospitality impact.  
**Question:** What should I respond to first?  
**Workflow:** Review conversations ranked by urgency, unanswered status, arrival timing, sentiment, operational issue, or low AI confidence; resolve the most consequential need first.  
**Future roadmap:** Configurable service levels, advanced sentiment, escalation policy, and action recommendations.

### Scheduled

**Mission:** Make future guest communication visible and reviewable.  
**Question:** What communications are already planned?  
**Workflow:** Review check-in, checkout, welcome, guidebook, reminder, and review-request messages; inspect recipient and timing; edit, reschedule, or cancel before delivery.  
**Future roadmap:** Journey-based automation and explicit approval workflows.

### Templates

**Mission:** Maintain reusable hospitality communication.  
**Question:** What do I say repeatedly?  
**Workflow:** Create, edit, organize, and apply templates for welcomes, parking, Wi-Fi, checkout, house rules, maintenance, and review requests.  
**Future roadmap:** AI-assisted template generation, localization, and property-specific variants.

### Search

**Mission:** Retrieve a conversation from communication history.  
**Question:** Where is that conversation?  
**Workflow:** Search by guest, property, reservation, content, or date; filter by source, status, journey stage, and AI involvement; open the result in context.  
**Future roadmap:** Knowledge search, attachment search, and semantic retrieval.

### Archive

**Mission:** Preserve completed conversations outside active work.  
**Question:** What has already happened?  
**Workflow:** Review closed history, restore a conversation when new work emerges, and retain its guest journey and channel lineage. Archived conversations are never treated as deleted.  
**Future roadmap:** Retention controls and export.

## Conversation workspace

A conversation presents the guest, reservation reference, property reference, journey timeline, unified messages, sources, attachments, notes, AI draft, and suggested replies. Future versions may add tasks and action recommendations while preserving ownership boundaries.

## AI Assistant

AI may summarize, draft, suggest replies, translate, rewrite tone, detect urgency, recommend follow-up, and surface hospitality considerations. Generated content always enters an editable draft. AI never sends automatically; sending requires an explicit user action, and future automation requires a separately approved workflow.

## Empty states

When there are no conversations, explain how work begins: connect a PMS or receive the first reservation. Section-specific states should offer a relevant next step rather than showing a blank inbox.

## Acceptance criteria

- The interface presents a communications product organized around guest journeys, not an email inbox or channel folders.
- Inbox, Needs Attention, Scheduled, Templates, Search, and Archive are visible primary sections.
- Attention prioritization emphasizes hospitality impact rather than unread counts.
- Conversation statuses use the explicit canonical model.
- Multiple sources appear within one guest conversation.
- AI actions produce editable drafts and cannot automatically send.
- The conversation workspace references guest, reservation, and property context without owning those records.
- Empty states explain how conversations begin and what the operator can do next.
- The responsive layout preserves access to the conversation list, detail, assistant, and guest timeline.
