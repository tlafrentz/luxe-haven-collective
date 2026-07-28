-- COM-002E: schema-qualify pgcrypto digest in hydration claim.
begin;

create or replace function public.claim_guest_message_hydration(
  p_workspace_id uuid,
  p_property_id uuid,
  p_booking_id uuid,
  p_conversation_id text,
  p_provider text,
  p_provider_reservation_id text,
  p_force boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hydration public.guest_message_hydrations%rowtype;
begin
  if auth.role() <> 'service_role' then
    raise exception 'message_hydration_requires_service_role'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.guest_conversation_reservations link
    join public.guest_conversations conversation
      on conversation.id = link.conversation_id
    where link.booking_id = p_booking_id
      and link.reservation_id = p_provider_reservation_id
      and link.property_id = p_property_id
      and link.conversation_id = p_conversation_id
      and conversation.workspace_id = p_workspace_id
      and conversation.property_id = p_property_id
  ) then
    raise exception 'message_hydration_scope_mismatch'
      using errcode = '42501';
  end if;

  insert into public.guest_message_hydrations (
    id,
    workspace_id,
    property_id,
    booking_id,
    conversation_id,
    provider,
    provider_reservation_id,
    state
  )
  values (
    'message-hydration-' ||
      pg_catalog.encode(
        extensions.digest(
          p_provider || ':' ||
          p_workspace_id::text || ':' ||
          p_provider_reservation_id,
          'sha256'
        ),
        'hex'
      ),
    p_workspace_id,
    p_property_id,
    p_booking_id,
    p_conversation_id,
    p_provider,
    p_provider_reservation_id,
    'not_started'
  )
  on conflict (
    workspace_id,
    provider,
    provider_reservation_id
  ) do nothing;

  select *
  into hydration
  from public.guest_message_hydrations
  where workspace_id = p_workspace_id
    and provider = p_provider
    and provider_reservation_id = p_provider_reservation_id
  for update;

  if hydration.state = 'completed' and not p_force then
    return jsonb_build_object(
      'state', 'completed',
      'nextPage', 1,
      'pages', hydration.pages_retrieved,
      'observed', hydration.messages_observed,
      'inserted', hydration.messages_inserted,
      'duplicates', hydration.duplicates_skipped,
      'rejected', hydration.messages_rejected
    );
  end if;

  if hydration.state = 'in_progress'
    and hydration.updated_at > now() - interval '30 minutes'
    and not p_force then
    return jsonb_build_object(
      'state', 'running',
      'nextPage', hydration.next_page,
      'pages', hydration.pages_retrieved,
      'observed', hydration.messages_observed,
      'inserted', hydration.messages_inserted,
      'duplicates', hydration.duplicates_skipped,
      'rejected', hydration.messages_rejected
    );
  end if;

  update public.guest_message_hydrations
  set
    state = 'in_progress',
    attempts = attempts + 1,
    last_error_code = null,
    started_at = coalesce(started_at, now()),
    completed_at = null,
    updated_at = now(),
    next_page = case
      when p_force then 1
      else coalesce(next_page, 1)
    end,
    pages_retrieved = case
      when p_force then 0
      else pages_retrieved
    end,
    messages_observed = case
      when p_force then 0
      else messages_observed
    end,
    messages_inserted = case
      when p_force then 0
      else messages_inserted
    end,
    duplicates_skipped = case
      when p_force then 0
      else duplicates_skipped
    end,
    messages_rejected = case
      when p_force then 0
      else messages_rejected
    end
  where id = hydration.id;

  select *
  into hydration
  from public.guest_message_hydrations
  where id = hydration.id;

  return jsonb_build_object(
    'state', 'claimed',
    'nextPage', hydration.next_page,
    'pages', hydration.pages_retrieved,
    'observed', hydration.messages_observed,
    'inserted', hydration.messages_inserted,
    'duplicates', hydration.duplicates_skipped,
    'rejected', hydration.messages_rejected
  );
end;
$$;

revoke all on function public.claim_guest_message_hydration(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  boolean
) from public;

grant execute on function public.claim_guest_message_hydration(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  boolean
) to service_role;

commit;
