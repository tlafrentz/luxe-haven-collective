-- Import Hospitable message history without making historical messages appear unread.
begin;

create or replace function public.append_guest_provider_message(
  p_workspace_id uuid,
  p_conversation_id text,
  p_provider text,
  p_provider_message_id text,
  p_sender_type text,
  p_sender_display_name text,
  p_body text,
  p_message_channel text,
  p_direction text,
  p_occurred_at timestamptz,
  p_backfill boolean default false
) returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  conversation public.guest_conversations%rowtype;
  message_id text := 'guest-message-provider-' || encode(digest(p_provider || ':' || p_provider_message_id,'sha256'),'hex');
  inserted boolean := false;
  affected_rows integer := 0;
begin
  select * into conversation
  from public.guest_conversations
  where id=p_conversation_id and workspace_id=p_workspace_id;
  if conversation.id is null then raise exception 'conversation_not_found'; end if;
  if p_sender_type not in('guest','operator') or p_direction not in('inbound','outbound') then
    raise exception 'provider_message_direction_invalid';
  end if;

  insert into public.guest_communication_messages(
    id,conversation_id,sender_type,sender_display_name,body,delivery_status,
    provider_message_id,created_at,delivered_at,idempotency_key,
    recipient_type,recipient_display_name,message_channel,direction
  ) values(
    message_id,p_conversation_id,p_sender_type,p_sender_display_name,p_body,'delivered',
    p_provider_message_id,p_occurred_at,p_occurred_at,
    'provider:'||p_provider||':'||p_provider_message_id,
    case when p_direction='inbound'then'operator'else'guest'end,
    case when p_direction='inbound'then'Operator'else coalesce(nullif(p_sender_display_name,''),'Guest')end,
    p_message_channel,p_direction
  ) on conflict do nothing;
  get diagnostics affected_rows = row_count;
  inserted := affected_rows > 0;
  if not inserted then return false; end if;

  insert into public.guest_message_delivery_events(
    id,conversation_id,message_id,provider,status,provider_message_id,retryable,metadata,occurred_at
  ) values(
    'delivery-provider-'||encode(digest(p_provider||':'||p_provider_message_id,'sha256'),'hex'),
    p_conversation_id,message_id,p_provider,'delivered',p_provider_message_id,false,
    jsonb_build_object('backfill',p_backfill),p_occurred_at
  ) on conflict do nothing;

  insert into public.guest_conversation_activity(
    id,conversation_id,workspace_id,event_type,safe_summary,metadata,occurred_at
  ) values(
    'activity-provider-'||encode(digest(p_provider||':'||p_provider_message_id,'sha256'),'hex'),
    p_conversation_id,p_workspace_id,
    case when p_direction='inbound'then'reply-received'else'reply-sent'end,
    case when p_direction='inbound'then'Guest message synchronized from provider.'else'Host message synchronized from provider.'end,
    jsonb_build_object('provider',p_provider,'providerMessageId',p_provider_message_id,'backfill',p_backfill),
    p_occurred_at
  ) on conflict do nothing;

  update public.guest_conversations set
    channel=case when p_message_channel in('hospitable','email','sms','airbnb','vrbo','internal')then p_message_channel else channel end,
    last_activity_at=greatest(last_activity_at,p_occurred_at),
    updated_at=greatest(updated_at,p_occurred_at),
    revision=revision+1,
    status=case when p_backfill then status when p_direction='inbound'then'waiting-on-operator'else'waiting-on-guest'end,
    waiting_on=case when p_backfill then waiting_on when p_direction='inbound'then'operator'else'guest'end,
    unread_count=case when not p_backfill and p_direction='inbound'then unread_count+1 else unread_count end
  where id=p_conversation_id;
  return true;
end;
$$;

revoke all on function public.append_guest_provider_message(uuid,text,text,text,text,text,text,text,text,timestamptz,boolean) from public;
grant execute on function public.append_guest_provider_message(uuid,text,text,text,text,text,text,text,text,timestamptz,boolean) to service_role;

commit;
