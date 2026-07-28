-- GM-001B: resumable, lossless, idempotent Hospitable history hydration.
begin;

alter table public.guest_communication_messages
  add column if not exists provider text,
  add column if not exists provider_reservation_id text,
  add column if not exists provider_conversation_id text,
  add column if not exists provider_native_message_id text,
  add column if not exists platform_message_id text,
  add column if not exists provider_occurred_at timestamptz,
  add column if not exists ingested_at timestamptz not null default now(),
  add column if not exists content_type text not null default 'text/plain',
  add column if not exists provider_metadata jsonb not null default '{}',
  add column if not exists provenance jsonb not null default '{}';

update public.guest_communication_messages message
set provider=event.provider,
    provider_native_message_id=event.provider_message_id,
    provider_occurred_at=message.created_at,
    provenance=jsonb_build_object('provider',event.provider)
from public.guest_message_delivery_events event
where event.message_id=message.id
  and event.provider_message_id is not null
  and message.provider_native_message_id is null;

create unique index if not exists guest_message_provider_identity_key
  on public.guest_communication_messages(provider,provider_native_message_id)
  where provider is not null and provider_native_message_id is not null;
create index if not exists guest_message_provider_chronology_idx
  on public.guest_communication_messages(conversation_id,provider_occurred_at,provider_native_message_id);

alter table public.guest_communication_messages
  drop constraint if exists guest_communication_messages_body_check;
alter table public.guest_communication_messages
  add constraint guest_communication_messages_body_check check(length(body)between 0 and 10000);
alter table public.guest_communication_messages
  drop constraint if exists guest_communication_messages_sender_type_check;
alter table public.guest_communication_messages
  add constraint guest_communication_messages_sender_type_check
  check(sender_type in('guest','operator','provider','system','unknown'));
alter table public.guest_communication_messages
  drop constraint if exists guest_message_recipient_type_check;
alter table public.guest_communication_messages
  add constraint guest_message_recipient_type_check
  check(recipient_type in('guest','operator','system','unknown'));
alter table public.guest_communication_messages
  drop constraint if exists guest_message_direction_check;
alter table public.guest_communication_messages
  add constraint guest_message_direction_check
  check(direction in('inbound','outbound','internal-note','system-event','unknown'));

alter table public.guest_communication_attachments
  add column if not exists provider text,
  add column if not exists provider_attachment_id text,
  add column if not exists provider_url text,
  add column if not exists provider_metadata jsonb not null default '{}';
alter table public.guest_communication_attachments
  drop constraint if exists guest_communication_attachments_check;
alter table public.guest_communication_attachments
  add constraint guest_communication_attachments_location_check
  check(storage_path is not null or url is not null or provider_attachment_id is not null);
create unique index if not exists guest_attachment_provider_identity_key
  on public.guest_communication_attachments(provider,provider_attachment_id)
  where provider is not null and provider_attachment_id is not null;

do $$
begin
  if exists(
    select booking_id from public.guest_conversation_reservations
    group by booking_id having count(*)>1
  ) then
    raise exception 'GM-001B cannot enforce unambiguous booking conversation lineage';
  end if;
end $$;
create unique index if not exists guest_reservation_one_conversation_per_booking
  on public.guest_conversation_reservations(booking_id);

create table public.guest_message_hydrations(
  id text primary key,
  workspace_id uuid not null references public.profiles(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  conversation_id text not null references public.guest_conversations(id) on delete restrict,
  provider text not null,
  provider_reservation_id text not null,
  state text not null check(state in('not_started','in_progress','completed','partial','failed')),
  next_page integer check(next_page is null or next_page>0),
  pages_retrieved integer not null default 0 check(pages_retrieved>=0),
  messages_observed integer not null default 0 check(messages_observed>=0),
  messages_inserted integer not null default 0 check(messages_inserted>=0),
  duplicates_skipped integer not null default 0 check(duplicates_skipped>=0),
  messages_rejected integer not null default 0 check(messages_rejected>=0),
  attempts integer not null default 0 check(attempts>=0),
  last_error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(workspace_id,provider,provider_reservation_id),
  unique(booking_id,provider)
);
create index guest_message_hydration_work_idx
  on public.guest_message_hydrations(workspace_id,state,updated_at);
alter table public.guest_message_hydrations enable row level security;
create policy "Members inspect property message hydration"
  on public.guest_message_hydrations for select to authenticated
  using(public.can_access_workspace_property(property_id));
grant select on public.guest_message_hydrations to authenticated;

drop policy if exists "Owners read conversations" on public.guest_conversations;
create policy "Members read property conversations"
  on public.guest_conversations for select to authenticated
  using(public.can_access_workspace_property(property_id));
drop policy if exists "Owners read conversation messages" on public.guest_communication_messages;
create policy "Members read property conversation messages"
  on public.guest_communication_messages for select to authenticated
  using(exists(
    select 1 from public.guest_conversations conversation
    where conversation.id=conversation_id
      and public.can_access_workspace_property(conversation.property_id)
  ));

drop policy if exists "Owners read communication attachments" on public.guest_communication_attachments;
create policy "Members read property communication attachments"
  on public.guest_communication_attachments for select to authenticated
  using(exists(
    select 1 from public.guest_conversations conversation
    where conversation.id=conversation_id
      and public.can_access_workspace_property(conversation.property_id)
  ));

drop policy if exists "Members inspect provider thread references" on public.guest_conversation_provider_threads;
create policy "Members read property provider thread references"
  on public.guest_conversation_provider_threads for select to authenticated
  using(exists(
    select 1 from public.guest_conversations conversation
    where conversation.id=conversation_id
      and public.can_access_workspace_property(conversation.property_id)
  ));

alter table public.guest_conversation_activity
  drop constraint if exists guest_conversation_activity_event_type_check;
alter table public.guest_conversation_activity
  add constraint guest_conversation_activity_event_type_check
  check(event_type in(
    'conversation-created','reply-sent','reply-received','draft-saved',
    'attachment-added','template-applied','internal-note-added',
    'conversation-resolved','conversation-archived','conversation-reopened',
    'delivery-updated','history-imported'
  ));

create or replace function public.claim_guest_message_hydration(
  p_workspace_id uuid,
  p_property_id uuid,
  p_booking_id uuid,
  p_conversation_id text,
  p_provider text,
  p_provider_reservation_id text,
  p_force boolean default false
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare hydration public.guest_message_hydrations%rowtype;
begin
  if auth.role()<>'service_role' then
    raise exception 'message_hydration_requires_service_role' using errcode='42501';
  end if;
  if not exists(
    select 1
    from public.guest_conversation_reservations link
    join public.guest_conversations conversation on conversation.id=link.conversation_id
    where link.booking_id=p_booking_id
      and link.reservation_id=p_provider_reservation_id
      and link.property_id=p_property_id
      and link.conversation_id=p_conversation_id
      and conversation.workspace_id=p_workspace_id
      and conversation.property_id=p_property_id
  ) then raise exception 'message_hydration_scope_mismatch' using errcode='42501';
  end if;

  insert into public.guest_message_hydrations(
    id,workspace_id,property_id,booking_id,conversation_id,provider,
    provider_reservation_id,state
  ) values(
    'message-hydration-'||encode(digest(p_provider||':'||p_workspace_id::text||':'||p_provider_reservation_id,'sha256'),'hex'),
    p_workspace_id,p_property_id,p_booking_id,p_conversation_id,p_provider,
    p_provider_reservation_id,'not_started'
  ) on conflict(workspace_id,provider,provider_reservation_id)do nothing;

  select * into hydration from public.guest_message_hydrations
  where workspace_id=p_workspace_id and provider=p_provider
    and provider_reservation_id=p_provider_reservation_id for update;
  if hydration.state='completed' and not p_force then
    return jsonb_build_object('state','completed','nextPage',1,'pages',hydration.pages_retrieved,
      'observed',hydration.messages_observed,'inserted',hydration.messages_inserted,
      'duplicates',hydration.duplicates_skipped,'rejected',hydration.messages_rejected);
  end if;
  if hydration.state='in_progress'
    and hydration.updated_at>now()-interval '30 minutes'
    and not p_force then
      return jsonb_build_object('state','running','nextPage',hydration.next_page,'pages',hydration.pages_retrieved,
        'observed',hydration.messages_observed,'inserted',hydration.messages_inserted,
        'duplicates',hydration.duplicates_skipped,'rejected',hydration.messages_rejected);
    end if;
  update public.guest_message_hydrations set
    state='in_progress',attempts=attempts+1,last_error_code=null,
    started_at=coalesce(started_at,now()),completed_at=null,updated_at=now(),
    next_page=case when p_force then 1 else coalesce(next_page,1)end,
    pages_retrieved=case when p_force then 0 else pages_retrieved end,
    messages_observed=case when p_force then 0 else messages_observed end,
    messages_inserted=case when p_force then 0 else messages_inserted end,
    duplicates_skipped=case when p_force then 0 else duplicates_skipped end,
    messages_rejected=case when p_force then 0 else messages_rejected end
  where id=hydration.id;
  select * into hydration from public.guest_message_hydrations where id=hydration.id;
  return jsonb_build_object('state','claimed','nextPage',hydration.next_page,'pages',hydration.pages_retrieved,
    'observed',hydration.messages_observed,'inserted',hydration.messages_inserted,
    'duplicates',hydration.duplicates_skipped,'rejected',hydration.messages_rejected);
end $$;

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

  message_id:='guest-message-provider-'||encode(digest(p_provider||':'||p_provider_message_id,'sha256'),'hex');
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
    'delivery-provider-'||encode(digest(p_provider||':'||p_provider_message_id,'sha256'),'hex'),
    p_conversation_id,message_id,p_provider,p_delivery_status,p_provider_message_id,false,
    jsonb_build_object('backfill',p_backfill),p_occurred_at
  ) on conflict do nothing;

  for attachment in select value from jsonb_array_elements(coalesce(p_attachments,'[]')) loop
    attachment_id:='guest-attachment-provider-'||encode(digest(
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
      'activity-provider-'||encode(digest(p_provider||':'||p_provider_message_id,'sha256'),'hex'),
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

create or replace function public.complete_guest_message_hydration(
  p_workspace_id uuid,
  p_provider text,
  p_provider_reservation_id text,
  p_pages integer,
  p_observed integer,
  p_inserted integer,
  p_duplicates integer,
  p_rejected integer
) returns void
language plpgsql security definer set search_path=public as $$
declare hydration public.guest_message_hydrations%rowtype;
begin
  if auth.role()<>'service_role' then
    raise exception 'message_hydration_requires_service_role' using errcode='42501';
  end if;
  select * into hydration from public.guest_message_hydrations
  where workspace_id=p_workspace_id and provider=p_provider
    and provider_reservation_id=p_provider_reservation_id for update;
  if hydration.id is null then raise exception 'message_hydration_not_found';end if;
  update public.guest_message_hydrations set
    state=case when p_rejected=0 then'completed'else'partial'end,
    next_page=null,pages_retrieved=p_pages,messages_observed=p_observed,
    messages_inserted=p_inserted,duplicates_skipped=p_duplicates,
    messages_rejected=p_rejected,last_error_code=case when p_rejected=0 then null else'message_payload_rejected'end,
    completed_at=case when p_rejected=0 then now()else null end,updated_at=now()
  where id=hydration.id;
  if p_rejected=0 then insert into public.guest_conversation_activity(
    id,conversation_id,workspace_id,event_type,safe_summary,metadata,occurred_at
  ) values(
    'activity-'||hydration.id,hydration.conversation_id,hydration.workspace_id,
    'history-imported','Historical message history imported.',
    jsonb_build_object('messageCount',p_observed,'inserted',p_inserted,'duplicates',p_duplicates,'rejected',p_rejected),
    now()
  ) on conflict do nothing;end if;
end $$;

revoke all on function public.claim_guest_message_hydration(uuid,uuid,uuid,text,text,text,boolean) from public;
revoke all on function public.ingest_guest_provider_message(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,jsonb,jsonb,jsonb,boolean) from public;
revoke all on function public.complete_guest_message_hydration(uuid,text,text,integer,integer,integer,integer,integer) from public;
grant execute on function public.claim_guest_message_hydration(uuid,uuid,uuid,text,text,text,boolean) to service_role;
grant execute on function public.ingest_guest_provider_message(uuid,uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz,jsonb,jsonb,jsonb,boolean) to service_role;
grant execute on function public.complete_guest_message_hydration(uuid,text,text,integer,integer,integer,integer,integer) to service_role;

commit;
