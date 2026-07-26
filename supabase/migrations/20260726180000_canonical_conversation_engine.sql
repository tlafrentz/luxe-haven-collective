-- COM-002A: provider-independent relationship conversations.
begin;
alter table public.guest_conversations
  add column if not exists active_reservation_id text,
  add column if not exists waiting_on text,
  add column if not exists priority text not null default 'normal';
alter table public.guest_conversations drop constraint if exists guest_conversations_status_check;
update public.guest_conversations set
  active_reservation_id=coalesce(active_reservation_id,reservation_id),
  waiting_on=coalesce(waiting_on,case when status in('unread','needs-reply','waiting-on-host')then 'operator' when status='waiting-on-guest'then 'guest'else'none'end),
  status=case when status in('unread','needs-reply','waiting-on-host')then 'waiting-on-operator' else status end;
alter table public.guest_conversations add constraint guest_conversations_status_check check(status in('open','waiting-on-guest','waiting-on-operator','resolved','archived'));
alter table public.guest_conversations add constraint guest_conversations_waiting_on_check check(waiting_on in('guest','operator','none'));
alter table public.guest_conversations add constraint guest_conversations_priority_check check(priority in('low','normal','high','urgent'));
alter table public.guest_conversations alter column waiting_on set not null;
alter table public.guest_conversations drop constraint if exists guest_conversations_workspace_id_booking_id_channel_key;
alter table public.guest_conversations drop constraint if exists guest_conversations_channel_provider_conversation_id_key;
create index guest_active_relationship_conversation_idx on public.guest_conversations(workspace_id,guest_id,property_id,last_activity_at desc)where status<>'archived';

create table public.guest_conversation_participants(
  id text primary key,conversation_id text not null references public.guest_conversations(id) on delete restrict,
  participant_type text not null check(participant_type in('guest','operator','system')),guest_id uuid references public.guests(id),
  profile_id uuid references public.profiles(id),display_name text not null,joined_at timestamptz not null,left_at timestamptz,
  check((participant_type='guest'and guest_id is not null)or(participant_type='operator'and profile_id is not null)or participant_type='system')
);
create table public.guest_conversation_reservations(
  conversation_id text not null references public.guest_conversations(id) on delete restrict,reservation_id text not null,
  booking_id uuid not null references public.bookings(id) on delete restrict,property_id uuid not null references public.properties(id) on delete restrict,
  active boolean not null default false,linked_at timestamptz not null,unlinked_at timestamptz,primary key(conversation_id,reservation_id)
);
create unique index guest_one_active_reservation_per_conversation on public.guest_conversation_reservations(conversation_id)where active;
create index guest_conversation_reservation_resolution_idx on public.guest_conversation_reservations(reservation_id,property_id);
create table public.guest_conversation_provider_threads(
  id text primary key,conversation_id text not null references public.guest_conversations(id) on delete restrict,
  workspace_id uuid not null,provider text not null,thread_id text not null,reservation_reference text,last_observed_at timestamptz not null,
  unique(workspace_id,provider,thread_id)
);
create table public.guest_message_delivery_events(
  id text primary key,conversation_id text not null references public.guest_conversations(id) on delete restrict,
  message_id text not null references public.guest_communication_messages(id) on delete restrict,provider text not null,
  status text not null check(status in('queued','sending','delivered','read','failed','unknown')),
  provider_message_id text,failure_code text,retryable boolean,metadata jsonb not null default '{}',occurred_at timestamptz not null
);
create index guest_delivery_history_idx on public.guest_message_delivery_events(message_id,occurred_at);
create unique index guest_provider_message_resolution_idx on public.guest_message_delivery_events(provider,provider_message_id)where provider_message_id is not null;
create table public.guest_conversation_activity(
  id text primary key,conversation_id text not null references public.guest_conversations(id) on delete restrict,workspace_id uuid not null,
  actor_profile_id uuid references public.profiles(id),event_type text not null check(event_type in('conversation-created','reply-sent','reply-received','draft-saved','attachment-added','template-applied','internal-note-added','conversation-resolved','conversation-archived','conversation-reopened','delivery-updated')),
  safe_summary text not null,metadata jsonb not null default '{}',occurred_at timestamptz not null
);
create index guest_conversation_activity_idx on public.guest_conversation_activity(conversation_id,occurred_at);

alter table public.guest_communication_messages
  add column if not exists recipient_type text,
  add column if not exists recipient_id text,
  add column if not exists recipient_display_name text,
  add column if not exists message_channel text,
  add column if not exists direction text,
  add column if not exists template_id text references public.guest_communication_templates(id) on delete set null;
update public.guest_communication_messages message set
  recipient_type=coalesce(recipient_type,case when sender_type='guest'then'operator'else'guest'end),
  recipient_display_name=coalesce(recipient_display_name,case when sender_type='guest'then'Operator'else'Guest'end),
  message_channel=coalesce(message_channel,(select conversation.channel from public.guest_conversations conversation where conversation.id=message.conversation_id),'internal'),
  direction=coalesce(direction,case when sender_type='guest'then'inbound'when sender_type='operator'then'outbound'when sender_type='system'then'system-event'else'inbound'end);
alter table public.guest_communication_messages alter column recipient_type set not null;
alter table public.guest_communication_messages alter column recipient_display_name set not null;
alter table public.guest_communication_messages alter column message_channel set not null;
alter table public.guest_communication_messages alter column direction set not null;
alter table public.guest_communication_messages add constraint guest_message_recipient_type_check check(recipient_type in('guest','operator','system'));
alter table public.guest_communication_messages add constraint guest_message_direction_check check(direction in('inbound','outbound','internal-note','system-event'));

insert into public.guest_conversation_participants(id,conversation_id,participant_type,guest_id,display_name,joined_at)
select 'guest-participant-'||conversation.id,conversation.id,'guest',conversation.guest_id,coalesce(guest.display_name,'Guest'),conversation.created_at
from public.guest_conversations conversation join public.guests guest on guest.id=conversation.guest_id on conflict do nothing;
insert into public.guest_conversation_reservations(conversation_id,reservation_id,booking_id,property_id,active,linked_at)
select id,reservation_id,booking_id,property_id,true,created_at from public.guest_conversations on conflict do nothing;
insert into public.guest_conversation_provider_threads(id,conversation_id,workspace_id,provider,thread_id,reservation_reference,last_observed_at)
select 'provider-thread-'||id,id,workspace_id,channel,provider_conversation_id,reservation_id,last_activity_at from public.guest_conversations where provider_conversation_id is not null on conflict do nothing;
insert into public.guest_conversation_activity(id,conversation_id,workspace_id,event_type,safe_summary,occurred_at)
select 'conversation-created-'||id,id,workspace_id,'conversation-created','Canonical guest relationship conversation established.',created_at from public.guest_conversations on conflict do nothing;

alter table public.guest_conversation_participants enable row level security;
alter table public.guest_conversation_reservations enable row level security;
alter table public.guest_conversation_provider_threads enable row level security;
alter table public.guest_message_delivery_events enable row level security;
alter table public.guest_conversation_activity enable row level security;
create policy "Members inspect conversation participants" on public.guest_conversation_participants for select to authenticated using(exists(select 1 from public.guest_conversations conversation where conversation.id=conversation_id and public.can_access_workspace_property(conversation.property_id)));
create policy "Members inspect conversation reservations" on public.guest_conversation_reservations for select to authenticated using(public.can_access_workspace_property(property_id));
create policy "Members inspect provider thread references" on public.guest_conversation_provider_threads for select to authenticated using(public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Members inspect delivery history" on public.guest_message_delivery_events for select to authenticated using(exists(select 1 from public.guest_conversations conversation where conversation.id=conversation_id and public.can_access_workspace_property(conversation.property_id)));
create policy "Members inspect conversation activity" on public.guest_conversation_activity for select to authenticated using(exists(select 1 from public.guest_conversations conversation where conversation.id=conversation_id and public.can_access_workspace_property(conversation.property_id)));
grant select on public.guest_conversation_participants,public.guest_conversation_reservations,public.guest_conversation_provider_threads,public.guest_message_delivery_events,public.guest_conversation_activity to authenticated;
create trigger guest_participants_append_only before update or delete on public.guest_conversation_participants for each row execute function public.prevent_guest_communication_history_change();
create or replace function public.protect_guest_conversation_reservation_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
 if tg_op='DELETE' then
  raise exception 'conversation reservation history is retained' using errcode='55000';
 end if;
 if old.conversation_id<>new.conversation_id
    or old.reservation_id<>new.reservation_id
    or old.booking_id<>new.booking_id
    or old.property_id<>new.property_id
    or old.linked_at<>new.linked_at then
  raise exception 'conversation reservation identity is immutable' using errcode='55000';
 end if;
 return new;
end;
$$;
create trigger guest_reservation_links_protected before update or delete on public.guest_conversation_reservations for each row execute function public.protect_guest_conversation_reservation_link();
create trigger guest_provider_threads_append_only before update or delete on public.guest_conversation_provider_threads for each row execute function public.prevent_guest_communication_history_change();
create trigger guest_delivery_events_append_only before update or delete on public.guest_message_delivery_events for each row execute function public.prevent_guest_communication_history_change();
create trigger guest_conversation_activity_append_only before update or delete on public.guest_conversation_activity for each row execute function public.prevent_guest_communication_history_change();

create or replace function public.protect_guest_message()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE'then raise exception 'guest communication history is immutable'using errcode='55000';end if;
 if old.id<>new.id or old.conversation_id<>new.conversation_id or old.sender_type<>new.sender_type or old.sender_profile_id is distinct from new.sender_profile_id
  or old.sender_display_name<>new.sender_display_name or old.body<>new.body or old.created_at<>new.created_at or old.idempotency_key<>new.idempotency_key
  or old.recipient_type<>new.recipient_type or old.recipient_id is distinct from new.recipient_id or old.recipient_display_name<>new.recipient_display_name
  or old.message_channel<>new.message_channel or old.direction<>new.direction or old.template_id is distinct from new.template_id
 then raise exception 'canonical message content and identity are immutable'using errcode='55000';end if;
 if not((old.delivery_status='queued'and new.delivery_status in('sending','failed'))or(old.delivery_status='sending'and new.delivery_status in('sent','delivered','failed'))or(old.delivery_status='sent'and new.delivery_status in('delivered','read'))or(old.delivery_status='delivered'and new.delivery_status='read')or(old.delivery_status='failed'and new.delivery_status='queued')or old.delivery_status=new.delivery_status)then raise exception 'invalid guest message delivery transition'using errcode='22023';end if;
 return new;
end$$;

create or replace function public.save_guest_communication_draft(p_conversation_id text,p_body text,p_template_id text default null)
returns void language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid();conversation public.guest_conversations%rowtype;actor_role text;prior_body text;changed boolean;
begin
 select*into conversation from public.guest_conversations where id=p_conversation_id;
 actor_role:=public.active_workspace_role(conversation.workspace_id);
 if actor_id is null or actor_role not in('owner','administrator','operator','contributor')or not public.can_access_workspace_property(conversation.property_id)then raise exception 'communication_permission_denied'using errcode='42501';end if;
 if length(p_body)>10000 then raise exception 'communication_draft_invalid';end if;
 select body into prior_body from public.guest_communication_drafts where conversation_id=p_conversation_id and profile_id=actor_id;
 changed:=prior_body is distinct from p_body;
 insert into public.guest_communication_drafts(conversation_id,profile_id,body,template_id,updated_at)values(p_conversation_id,actor_id,p_body,p_template_id,now())on conflict(conversation_id,profile_id)do update set body=excluded.body,template_id=excluded.template_id,updated_at=excluded.updated_at;
 if changed then insert into public.guest_conversation_activity values('activity-'||gen_random_uuid(),p_conversation_id,conversation.workspace_id,actor_id,'draft-saved','Operator draft persisted independently of provider delivery.','{}',now());end if;
end$$;

create or replace function public.queue_guest_communication_message(p_conversation_id text,p_message_id text,p_body text,p_template_id text,p_idempotency_key text)
returns text language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid();conversation public.guest_conversations%rowtype;actor_role text;now_at timestamptz:=now();existing_id text;provider_name text;
begin
 select id into existing_id from public.guest_communication_messages where idempotency_key=p_idempotency_key;if existing_id is not null then return existing_id;end if;
 select*into conversation from public.guest_conversations where id=p_conversation_id for update;actor_role:=public.active_workspace_role(conversation.workspace_id);
 if actor_id is null or actor_role not in('owner','administrator','operator','contributor')or not public.can_access_workspace_property(conversation.property_id)then raise exception 'communication_permission_denied'using errcode='42501';end if;
 if length(trim(p_body))not between 1 and 10000 then raise exception 'communication_message_invalid';end if;
 select provider into provider_name from public.guest_conversation_provider_threads where conversation_id=p_conversation_id order by last_observed_at desc limit 1;provider_name:=coalesce(provider_name,'internal');
 insert into public.guest_communication_messages(id,conversation_id,sender_type,sender_profile_id,sender_display_name,body,delivery_status,created_at,idempotency_key,recipient_type,recipient_display_name,message_channel,direction,template_id)
 values(p_message_id,p_conversation_id,'operator',actor_id,'Operator',trim(p_body),'queued',now_at,p_idempotency_key,'guest','Guest',provider_name,'outbound',p_template_id);
 insert into public.guest_message_delivery_events values('delivery-event-'||gen_random_uuid(),p_conversation_id,p_message_id,provider_name,'queued',null,null,null,'{}',now_at);
 insert into public.guest_communication_timeline(id,conversation_id,event_type,visibility,message_id,safe_summary,metadata,occurred_at)values('guest-timeline-'||gen_random_uuid(),p_conversation_id,'message','guest',p_message_id,'Operator reply queued for provider delivery.',jsonb_build_object('deliveryStatus','queued'),now_at);
 insert into public.guest_conversation_activity values('activity-'||gen_random_uuid(),p_conversation_id,conversation.workspace_id,actor_id,'reply-sent','Operator reply appended and queued for transport.',jsonb_build_object('messageId',p_message_id),now_at);
 if p_template_id is not null then
  insert into public.guest_communication_timeline(id,conversation_id,event_type,visibility,message_id,safe_summary,metadata,occurred_at)values('guest-timeline-'||gen_random_uuid(),p_conversation_id,'template-used','internal',p_message_id,'Communication template rendered before immutable message persistence.',jsonb_build_object('templateId',p_template_id),now_at);
  insert into public.guest_conversation_activity values('activity-'||gen_random_uuid(),p_conversation_id,conversation.workspace_id,actor_id,'template-applied','Reviewed template rendered into immutable outbound content.',jsonb_build_object('templateId',p_template_id),now_at);
 end if;
 delete from public.guest_communication_drafts where conversation_id=p_conversation_id and profile_id=actor_id;
 update public.guest_conversations set status='waiting-on-guest',waiting_on='guest',unread_count=0,last_activity_at=now_at,updated_at=now_at,revision=revision+1 where id=p_conversation_id;
 return p_message_id;
end$$;

create or replace function public.append_guest_inbound_message(
 p_workspace_id uuid,p_message_id text,p_provider text,p_provider_message_id text,p_provider_thread_id text,
 p_reservation_id text,p_booking_id uuid,p_guest_id uuid,p_property_id uuid,p_guest_name text,p_body text,p_occurred_at timestamptz
)returns text language plpgsql security definer set search_path=public as $$
declare conversation_id text;existing_id text;
begin
 if auth.role()<>'service_role' then raise exception 'provider_ingestion_requires_service_role' using errcode='42501';end if;
 select event.message_id into existing_id from public.guest_message_delivery_events event where event.provider=p_provider and event.provider_message_id=p_provider_message_id;
 if existing_id is not null then return existing_id;end if;
 select thread.conversation_id into conversation_id from public.guest_conversation_provider_threads thread where thread.workspace_id=p_workspace_id and thread.provider=p_provider and thread.thread_id=p_provider_thread_id;
 if conversation_id is null then select link.conversation_id into conversation_id from public.guest_conversation_reservations link join public.guest_conversations conversation on conversation.id=link.conversation_id where conversation.workspace_id=p_workspace_id and link.reservation_id=p_reservation_id limit 1;end if;
 if conversation_id is null then select conversation.id into conversation_id from public.guest_conversations conversation where conversation.workspace_id=p_workspace_id and conversation.guest_id=p_guest_id and conversation.property_id=p_property_id and conversation.status<>'archived' limit 1;end if;
 if conversation_id is null then
  conversation_id:='guest-conversation-'||gen_random_uuid();
  insert into public.guest_conversations(id,workspace_id,reservation_id,booking_id,guest_id,property_id,channel,status,assigned_to_profile_id,unread_count,last_activity_at,provider_conversation_id,revision,created_at,updated_at,active_reservation_id,waiting_on,priority)
  values(conversation_id,p_workspace_id,p_reservation_id,p_booking_id,p_guest_id,p_property_id,'internal','waiting-on-operator',null,0,p_occurred_at,null,1,p_occurred_at,p_occurred_at,p_reservation_id,'operator','high');
  insert into public.guest_conversation_participants values('guest-participant-'||conversation_id,conversation_id,'guest',p_guest_id,null,p_guest_name,p_occurred_at,null);
  insert into public.guest_conversation_reservations values(conversation_id,p_reservation_id,p_booking_id,p_property_id,true,p_occurred_at,null);
  insert into public.guest_conversation_activity values('conversation-created-'||conversation_id,conversation_id,p_workspace_id,null,'conversation-created','Conversation created while resolving an inbound provider reply.','{}',p_occurred_at);
 end if;
 insert into public.guest_conversation_provider_threads values('provider-thread-'||gen_random_uuid(),conversation_id,p_workspace_id,p_provider,p_provider_thread_id,p_reservation_id,p_occurred_at)on conflict(workspace_id,provider,thread_id)do nothing;
 insert into public.guest_communication_messages(id,conversation_id,sender_type,sender_display_name,body,delivery_status,provider_message_id,created_at,idempotency_key,recipient_type,recipient_display_name,message_channel,direction)
 values(p_message_id,conversation_id,'guest',p_guest_name,trim(p_body),'delivered',null,p_occurred_at,'provider:'||p_provider||':'||p_provider_message_id,'operator','Operator',p_provider,'inbound');
 insert into public.guest_message_delivery_events values('delivery-event-'||gen_random_uuid(),conversation_id,p_message_id,p_provider,'delivered',p_provider_message_id,null,null,'{}',p_occurred_at);
 insert into public.guest_conversation_activity values('activity-'||gen_random_uuid(),conversation_id,p_workspace_id,null,'reply-received','Guest reply received and attached through canonical thread resolution.',jsonb_build_object('messageId',p_message_id),p_occurred_at);
 insert into public.guest_communication_timeline(id,conversation_id,event_type,visibility,message_id,safe_summary,occurred_at)values('guest-timeline-'||gen_random_uuid(),conversation_id,'message','guest',p_message_id,'Guest reply received.',p_occurred_at);
 update public.guest_conversations set status='waiting-on-operator',waiting_on='operator',unread_count=unread_count+1,last_activity_at=p_occurred_at,updated_at=p_occurred_at,revision=revision+1 where id=conversation_id;
 return p_message_id;
end $$;
revoke all on function public.append_guest_inbound_message(uuid,text,text,text,text,text,uuid,uuid,uuid,text,text,timestamptz)from public;
grant execute on function public.append_guest_inbound_message(uuid,text,text,text,text,text,uuid,uuid,uuid,text,text,timestamptz)to service_role;
commit;
