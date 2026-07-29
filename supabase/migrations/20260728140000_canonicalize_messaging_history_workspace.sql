-- GC-009: canonicalize append-only messaging history to owners.id.
begin;

alter table public.guest_conversation_provider_threads
  drop constraint if exists guest_conversation_provider_threads_workspace_id_fkey;

alter table public.guest_conversation_activity
  drop constraint if exists guest_conversation_activity_workspace_id_fkey;

alter table public.guest_conversation_provider_threads
  disable trigger guest_provider_threads_append_only;

alter table public.guest_conversation_activity
  disable trigger guest_conversation_activity_append_only;

-- Refuse to merge a provider thread identity that points to two conversations.
do $$
begin
  if exists (
    select 1
    from public.guest_conversation_provider_threads legacy
    join public.owners owner
      on owner.profile_id = legacy.workspace_id
    join public.guest_conversation_provider_threads canonical
      on canonical.workspace_id = owner.id
      and canonical.provider = legacy.provider
      and canonical.thread_id = legacy.thread_id
    where legacy.workspace_id is distinct from owner.id
      and canonical.conversation_id is distinct from legacy.conversation_id
  ) then
    raise exception 'provider thread identity maps to conflicting canonical conversations';
  end if;
end;
$$;

-- Remove only legacy rows whose complete provider identity already has the
-- same canonical conversation association.
delete from public.guest_conversation_provider_threads legacy
using public.owners owner
where legacy.workspace_id = owner.profile_id
  and legacy.workspace_id is distinct from owner.id
  and exists (
    select 1
    from public.guest_conversation_provider_threads canonical
    where canonical.workspace_id = owner.id
      and canonical.provider = legacy.provider
      and canonical.thread_id = legacy.thread_id
      and canonical.conversation_id = legacy.conversation_id
  );

update public.guest_conversation_provider_threads item
set workspace_id = owner.id
from public.owners owner
where item.workspace_id = owner.profile_id
  and item.workspace_id is distinct from owner.id
  and not exists (
    select 1
    from public.owners canonical
    where canonical.id = item.workspace_id
  );

update public.guest_conversation_activity item
set workspace_id = owner.id
from public.owners owner
where item.workspace_id = owner.profile_id
  and item.workspace_id is distinct from owner.id
  and not exists (
    select 1
    from public.owners canonical
    where canonical.id = item.workspace_id
  );

alter table public.guest_conversation_provider_threads
  enable trigger guest_provider_threads_append_only;

alter table public.guest_conversation_activity
  enable trigger guest_conversation_activity_append_only;

do $$
begin
  if exists (
    select 1
    from public.guest_conversation_provider_threads item
    left join public.owners owner on owner.id = item.workspace_id
    where owner.id is null
  ) then
    raise exception 'guest_conversation_provider_threads contains a workspace_id that is not an owners.id';
  end if;

  if exists (
    select 1
    from public.guest_conversation_activity item
    left join public.owners owner on owner.id = item.workspace_id
    where owner.id is null
  ) then
    raise exception 'guest_conversation_activity contains a workspace_id that is not an owners.id';
  end if;
end;
$$;

alter table public.guest_conversation_provider_threads
  add constraint guest_conversation_provider_threads_workspace_id_fkey
  foreign key (workspace_id)
  references public.owners(id)
  on delete restrict;

alter table public.guest_conversation_activity
  add constraint guest_conversation_activity_workspace_id_fkey
  foreign key (workspace_id)
  references public.owners(id)
  on delete restrict;

commit;
