begin;

create or replace function public.ingest_guest_provider_message(
  p_workspace_id uuid,
  p_property_id uuid,
  p_booking_id uuid,
  p_conversation_id text,
  p_provider text,
  p_provider_message_id text,
  p_platform_message_id text,
  p_provider_reservation_id text,
  p_provider_conversation_id text,
  p_sender_type text,
  p_sender_display_name text,
  p_body text,
  p_content_type text,
  p_message_channel text,
  p_direction text,
  p_delivery_status text,
  p_occurred_at timestamptz,
  p_ingested_at timestamptz,
  p_attachments jsonb,
  p_metadata jsonb,
  p_provenance jsonb,
  p_backfill boolean default true
) returns boolean
language plpgsql security definer set search_path=public as $$
declare
  resolved_count integer;
  message_id text;
  attachment jsonb;
  attachment_id text;
  attachment_kind text;
begin
  if auth.role()<>'service_role' then
    raise exception 'provider_ingestion_requires_service_role' using errcode='42501';
  end if;
  select count(*) into resolved_count
  from public.guest_conversation_reservations link
  join public.guest_conversations conversation on conversation.id=link.conversation_id
  where link.booking_id=p_booking_id
    and link.reservation_id=p_provider_reservation_id
    and link.property_id=p_property_id
    and link.conversation_id=p_conversation_id
    and conversation.workspace_id=p_workspace_id
    and conversation.property_id=p_property_id;
  if resolved_count<>1 then raise exception 'provider_message_conversation_unresolved';end if;
  if p_sender_type not in('guest','operator','system','unknown')
    or p_direction not in('inbound','outbound','system-event','unknown') then
    raise exception 'provider_message_direction_invalid';
  end if;
  if exists(
    select 1 from public.guest_communication_messages
    where provider=p_provider and provider_native_message_id=p_provider_message_id
  ) then return false;end if;

  message_id:='guest-message-provider-'||pg_catalog.encode(extensions.digest(p_provider||':'||p_provider_message_id,'sha256'),'hex');
  insert into public.guest_communication_messages(
    id,conversation_id,sender_type,sender_display_name,body,delivery_status,
    provider_message_id,created_at,delivered_at,idempotency_key,
    recipient_type,recipient_display_name,message_channel,direction,
    provider,provider_reservation_id,provider_conversation_id,
    provider_native_message_id,platform_message_id,provider_occurred_at,
    ingested_at,content_type,provider_metadata,provenance
  ) values(
    message_id,p_conversation_id,p_sender_type,p_sender_display_name,p_body,
    p_delivery_status,p_provider_message_id,p_occurred_at,
    case when p_delivery_status='delivered'then p_occurred_at else null end,
    'provider:'||p_provider||':'||p_provider_message_id,
    case when p_direction='inbound'then'operator'
         when p_direction='outbound'then'guest'
         when p_direction='system-event'then'system' else'unknown'end,
    case when p_direction='inbound'then'Operator'
         when p_direction='outbound'then'Guest'
         when p_direction='system-event'then'System' else'Unknown recipient'end,
    p_message_channel,p_direction,p_provider,p_provider_reservation_id,
    p_provider_conversation_id,p_provider_message_id,p_platform_message_id,
    p_occurred_at,p_ingested_at,p_content_type,coalesce(p_metadata,'{}'),
    coalesce(p_provenance,'{}')
  ) on conflict(provider,provider_native_message_id)where provider is not null and provider_native_message_id is not null
    do nothing;
  if not found then return false;end if;

  insert into public.guest_message_delivery_events(
    id,conversation_id,message_id,provider,status,provider_message_id,retryable,metadata,occurred_at
  ) values(
    'delivery-provider-'||pg_catalog.encode(extensions.digest(p_provider||':'||p_provider_message_id,'sha256'),'hex'),
    p_conversation_id,message_id,p_provider,p_delivery_status,p_provider_message_id,false,
    jsonb_build_object('backfill',p_backfill),p_occurred_at
  ) on conflict do nothing;

  for attachment in select value from jsonb_array_elements(coalesce(p_attachments,'[]')) loop
    attachment_id:='guest-attachment-provider-'||pg_catalog.encode(extensions.digest(
      p_provider||':'||p_provider_message_id||':'||(attachment->>'providerAttachmentId'),'sha256'
    ),'hex');
    attachment_kind:=case
      when coalesce(attachment->>'mimeType','')='application/pdf' then 'pdf'
      when coalesce(attachment->>'mimeType','')like'image/%' then 'image'
      when coalesce(attachment->>'type','')in('image','pdf','link')then attachment->>'type'
      else 'link'end;
    insert into public.guest_communication_attachments(
      id,conversation_id,message_id,attachment_type,name,url,mime_type,size_bytes,
      provider,provider_attachment_id,provider_url,provider_metadata
    ) values(
      attachment_id,p_conversation_id,message_id,attachment_kind,
      coalesce(nullif(attachment->>'filename',''),'Provider attachment'),
      nullif(attachment->>'providerUrl',''),nullif(attachment->>'mimeType',''),
      nullif(attachment->>'sizeBytes','')::bigint,p_provider,
      attachment->>'providerAttachmentId',nullif(attachment->>'providerUrl',''),
      coalesce(attachment->'metadata','{}')
    ) on conflict(provider,provider_attachment_id)where provider is not null and provider_attachment_id is not null
      do nothing;
  end loop;

  if not p_backfill then
    insert into public.guest_conversation_activity(
      id,conversation_id,workspace_id,event_type,safe_summary,metadata,occurred_at
    ) values(
      'activity-provider-'||pg_catalog.encode(extensions.digest(p_provider||':'||p_provider_message_id,'sha256'),'hex'),
      p_conversation_id,p_workspace_id,
      case when p_direction='inbound'then'reply-received'else'reply-sent'end,
      'Provider message appended to the canonical conversation.',
      jsonb_build_object('provider',p_provider),p_occurred_at
    ) on conflict do nothing;
  end if;

  update public.guest_conversations set
    channel=case when p_message_channel in('hospitable','email','sms','airbnb','vrbo','internal')
      then p_message_channel else channel end,
    last_activity_at=greatest(last_activity_at,p_occurred_at),
    updated_at=greatest(updated_at,p_occurred_at),
    revision=revision+1,
    status=case when p_backfill or p_direction not in('inbound','outbound')then status
      when p_direction='inbound'then'waiting-on-operator'else'waiting-on-guest'end,
    waiting_on=case when p_backfill or p_direction not in('inbound','outbound')then waiting_on
      when p_direction='inbound'then'operator'else'guest'end,
    unread_count=case when not p_backfill and p_direction='inbound'then unread_count+1 else unread_count end
  where id=p_conversation_id;
  return true;
end $$;

revoke all on function public.ingest_guest_provider_message(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb,
  jsonb,
  jsonb,
  boolean
) from public;

grant execute on function public.ingest_guest_provider_message(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb,
  jsonb,
  jsonb,
  boolean
) to service_role;

commit;
