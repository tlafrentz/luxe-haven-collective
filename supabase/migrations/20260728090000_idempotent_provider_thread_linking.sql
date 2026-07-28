-- COM-002D: one immutable, workspace-scoped provider identity per conversation.
begin;

create or replace function public.link_guest_conversation_provider_thread(
  p_workspace_id uuid,
  p_conversation_id text,
  p_provider text,
  p_thread_id text,
  p_reservation_reference text,
  p_last_observed_at timestamptz,
  p_record_id text default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  canonical public.guest_conversation_provider_threads%rowtype;
  record_collision public.guest_conversation_provider_threads%rowtype;
  normalized_provider text:=lower(trim(p_provider));
  normalized_thread_id text:=trim(p_thread_id);
  requested_id text:=coalesce(nullif(trim(p_record_id),''),'provider-thread-'||gen_random_uuid());
  inserted boolean:=false;
  conversation_workspace uuid;
begin
  if auth.role()<>'service_role' then
    raise exception 'PROVIDER_THREAD_LINK_FAILED' using errcode='42501';
  end if;
  if p_workspace_id is null or nullif(trim(p_conversation_id),'') is null
    or nullif(normalized_provider,'') is null or nullif(normalized_thread_id,'') is null
    or p_last_observed_at is null then
    raise exception 'PROVIDER_THREAD_IDENTITY_INVALID' using errcode='22023';
  end if;

  select workspace_id into conversation_workspace
  from public.guest_conversations where id=p_conversation_id;
  if conversation_workspace is null then
    raise exception 'PROVIDER_THREAD_LINK_FAILED' using errcode='23503';
  end if;
  if conversation_workspace<>p_workspace_id then
    raise exception 'PROVIDER_THREAD_WORKSPACE_MISMATCH' using errcode='22023';
  end if;

  insert into public.guest_conversation_provider_threads(
    id,conversation_id,workspace_id,provider,thread_id,reservation_reference,last_observed_at
  ) values(
    requested_id,p_conversation_id,p_workspace_id,normalized_provider,normalized_thread_id,
    p_reservation_reference,p_last_observed_at
  ) on conflict do nothing
  returning * into canonical;
  inserted:=found;

  if not inserted then
    select * into canonical
    from public.guest_conversation_provider_threads
    where workspace_id=p_workspace_id and provider=normalized_provider and thread_id=normalized_thread_id;

    if canonical.id is null then
      select * into record_collision
      from public.guest_conversation_provider_threads where id=requested_id;
      if record_collision.id is not null
        and record_collision.workspace_id=p_workspace_id
        and record_collision.provider=normalized_provider
        and record_collision.thread_id=normalized_thread_id
        and record_collision.conversation_id=p_conversation_id then
        canonical:=record_collision;
      else
        raise exception 'PROVIDER_THREAD_LINK_FAILED' using errcode='23505';
      end if;
    end if;
  end if;

  if canonical.workspace_id<>p_workspace_id then
    raise exception 'PROVIDER_THREAD_WORKSPACE_MISMATCH' using errcode='22023';
  end if;
  if canonical.conversation_id<>p_conversation_id then
    raise exception 'PROVIDER_THREAD_CONVERSATION_CONFLICT' using errcode='23505';
  end if;

  return jsonb_build_object(
    'id',canonical.id,'conversation_id',canonical.conversation_id,
    'workspace_id',canonical.workspace_id,'provider',canonical.provider,
    'thread_id',canonical.thread_id,'outcome',case when inserted then'created'else'reused'end
  );
exception when others then
  if sqlerrm like 'PROVIDER_THREAD_%' then raise;end if;
  raise exception 'PROVIDER_THREAD_LINK_FAILED' using errcode='P0001';
end $$;

revoke all on function public.link_guest_conversation_provider_thread(uuid,text,text,text,text,timestamptz,text) from public;
grant execute on function public.link_guest_conversation_provider_thread(uuid,text,text,text,text,timestamptz,text) to service_role;

commit;
