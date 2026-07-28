-- COM-002C: make owners.id the canonical messaging workspace identifier.
--
-- Important:
--   guest_conversation_provider_threads and guest_conversation_activity are
--   append-only historical records. This migration deliberately does not
--   rewrite those tables. Existing historical rows retain their original
--   provenance; all current-state and future messaging records use owners.id.

begin;

alter table public.guest_conversations
  drop constraint if exists guest_conversations_workspace_id_fkey;

alter table public.guest_message_hydrations
  drop constraint if exists guest_message_hydrations_workspace_id_fkey;

alter table public.messaging_provider_review_queue
  drop constraint if exists messaging_provider_review_queue_workspace_id_fkey;

alter table public.messaging_provider_activity
  drop constraint if exists messaging_provider_activity_workspace_id_fkey;

-- A conversation's linked property is authoritative for repairing the
-- canonical current-state conversation workspace.
update public.guest_conversations conversation
set workspace_id = property.owner_id
from public.properties property
where property.id = conversation.property_id
  and conversation.workspace_id is distinct from property.owner_id;

-- Hydration rows are mutable operational state rather than immutable message
-- history. Keep their workspace aligned with the canonical conversation.
update public.guest_message_hydrations hydration
set workspace_id = conversation.workspace_id
from public.guest_conversations conversation
where conversation.id = hydration.conversation_id
  and hydration.workspace_id is distinct from conversation.workspace_id;

-- Active provider review/work queues previously stored owners.profile_id.
update public.messaging_provider_review_queue item
set workspace_id = owner.id
from public.owners owner
where item.workspace_id = owner.profile_id
  and item.workspace_id is distinct from owner.id;

update public.messaging_provider_activity item
set workspace_id = owner.id
from public.owners owner
where item.workspace_id = owner.profile_id
  and item.workspace_id is distinct from owner.id;

-- Fail before constraints are recreated if any mutable/current-state records
-- still reference a non-canonical workspace identifier.
do $$
begin
  if exists (
    select 1
    from public.guest_conversations conversation
    left join public.owners owner on owner.id = conversation.workspace_id
    where owner.id is null
  ) then
    raise exception 'guest_conversations contains a workspace_id that is not an owners.id';
  end if;

  if exists (
    select 1
    from public.guest_message_hydrations hydration
    left join public.owners owner on owner.id = hydration.workspace_id
    where owner.id is null
  ) then
    raise exception 'guest_message_hydrations contains a workspace_id that is not an owners.id';
  end if;

  if exists (
    select 1
    from public.messaging_provider_review_queue item
    left join public.owners owner on owner.id = item.workspace_id
    where owner.id is null
  ) then
    raise exception 'messaging_provider_review_queue contains a workspace_id that is not an owners.id';
  end if;

  if exists (
    select 1
    from public.messaging_provider_activity item
    left join public.owners owner on owner.id = item.workspace_id
    where owner.id is null
  ) then
    raise exception 'messaging_provider_activity contains a workspace_id that is not an owners.id';
  end if;
end;
$$;

alter table public.guest_conversations
  add constraint guest_conversations_workspace_id_fkey
  foreign key (workspace_id)
  references public.owners(id)
  on delete restrict;

alter table public.guest_message_hydrations
  add constraint guest_message_hydrations_workspace_id_fkey
  foreign key (workspace_id)
  references public.owners(id)
  on delete restrict;

alter table public.messaging_provider_review_queue
  add constraint messaging_provider_review_queue_workspace_id_fkey
  foreign key (workspace_id)
  references public.owners(id)
  on delete restrict;

alter table public.messaging_provider_activity
  add constraint messaging_provider_activity_workspace_id_fkey
  foreign key (workspace_id)
  references public.owners(id)
  on delete restrict;

commit;
