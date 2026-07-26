-- COM-001A: durable drafts and recoverable provider delivery.
begin;
alter table public.guest_communication_messages drop constraint if exists guest_communication_messages_delivery_status_check;
alter table public.guest_communication_messages add constraint guest_communication_messages_delivery_status_check check(delivery_status in('draft','queued','sending','sent','delivered','failed','read','unknown'));

create table public.guest_communication_drafts(
  conversation_id text not null references public.guest_conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check(length(body)<=10000),
  template_id text references public.guest_communication_templates(id) on delete set null,
  attachment_ids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key(conversation_id,profile_id)
);
create table public.guest_communication_delivery_attempts(
  id text primary key,
  conversation_id text not null references public.guest_conversations(id) on delete restrict,
  message_id text not null references public.guest_communication_messages(id) on delete restrict,
  attempt integer not null check(attempt>0),
  provider text not null,
  status text not null check(status in('sending','sent','delivered','failed')),
  failure_code text,
  retryable boolean,
  started_at timestamptz not null,
  completed_at timestamptz,
  unique(message_id,attempt)
);
create index guest_delivery_attempt_idx on public.guest_communication_delivery_attempts(conversation_id,started_at desc);
alter table public.guest_communication_drafts enable row level security;
alter table public.guest_communication_delivery_attempts enable row level security;
create policy "Operators manage own communication drafts" on public.guest_communication_drafts for select to authenticated using(profile_id=auth.uid() and exists(select 1 from public.guest_conversations conversation where conversation.id=conversation_id and public.can_access_workspace_property(conversation.property_id)));
create policy "Members inspect communication delivery attempts" on public.guest_communication_delivery_attempts for select to authenticated using(exists(select 1 from public.guest_conversations conversation where conversation.id=conversation_id and public.can_access_workspace_property(conversation.property_id)));
grant select on public.guest_communication_drafts,public.guest_communication_delivery_attempts to authenticated;

drop trigger if exists guest_messages_immutable on public.guest_communication_messages;
create or replace function public.protect_guest_message()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'guest communication history is immutable' using errcode='55000';end if;
  if old.id<>new.id or old.conversation_id<>new.conversation_id or old.sender_type<>new.sender_type
    or old.sender_profile_id is distinct from new.sender_profile_id or old.sender_display_name<>new.sender_display_name
    or old.body<>new.body or old.scheduled_for is distinct from new.scheduled_for
    or old.created_at<>new.created_at or old.idempotency_key<>new.idempotency_key
  then raise exception 'sent message content and identity are immutable' using errcode='55000';end if;
  if not(
    (old.delivery_status='queued' and new.delivery_status in('sending','failed'))
    or(old.delivery_status='sending' and new.delivery_status in('sent','delivered','failed'))
    or(old.delivery_status='sent' and new.delivery_status in('delivered','read'))
    or(old.delivery_status='delivered' and new.delivery_status='read')
    or(old.delivery_status='failed' and new.delivery_status='queued')
    or(old.delivery_status=new.delivery_status)
  )then raise exception 'invalid guest message delivery transition' using errcode='22023';end if;
  return new;
end $$;
create trigger guest_messages_protected before update or delete on public.guest_communication_messages for each row execute function public.protect_guest_message();

create or replace function public.save_guest_communication_draft(p_conversation_id text,p_body text,p_template_id text default null)
returns void language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid();conversation public.guest_conversations%rowtype;actor_role text;
begin
  select * into conversation from public.guest_conversations where id=p_conversation_id;
  actor_role:=public.active_workspace_role(conversation.workspace_id);
  if actor_id is null or actor_role not in('owner','administrator','operator','contributor') or not public.can_access_workspace_property(conversation.property_id)then raise exception 'communication_permission_denied' using errcode='42501';end if;
  if length(p_body)>10000 then raise exception 'communication_draft_invalid';end if;
  insert into public.guest_communication_drafts(conversation_id,profile_id,body,template_id,updated_at)values(p_conversation_id,actor_id,p_body,p_template_id,now())
  on conflict(conversation_id,profile_id)do update set body=excluded.body,template_id=excluded.template_id,updated_at=excluded.updated_at;
end $$;

create or replace function public.queue_guest_communication_message(p_conversation_id text,p_message_id text,p_body text,p_template_id text,p_idempotency_key text)
returns text language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid();conversation public.guest_conversations%rowtype;actor_role text;now_at timestamptz:=now();existing_id text;
begin
  select id into existing_id from public.guest_communication_messages where idempotency_key=p_idempotency_key;
  if existing_id is not null then return existing_id;end if;
  select * into conversation from public.guest_conversations where id=p_conversation_id for update;
  actor_role:=public.active_workspace_role(conversation.workspace_id);
  if actor_id is null or actor_role not in('owner','administrator','operator','contributor') or not public.can_access_workspace_property(conversation.property_id)then raise exception 'communication_permission_denied' using errcode='42501';end if;
  if length(trim(p_body))not between 1 and 10000 then raise exception 'communication_message_invalid';end if;
  insert into public.guest_communication_messages(id,conversation_id,sender_type,sender_profile_id,sender_display_name,body,delivery_status,created_at,idempotency_key)
  values(p_message_id,p_conversation_id,'operator',actor_id,'Operator',trim(p_body),'queued',now_at,p_idempotency_key);
  insert into public.guest_communication_timeline(id,conversation_id,event_type,visibility,message_id,safe_summary,metadata,occurred_at)
  values('guest-timeline-'||gen_random_uuid(),p_conversation_id,'message','guest',p_message_id,'Operator reply queued for provider delivery.',jsonb_build_object('deliveryStatus','queued'),now_at);
  if p_template_id is not null then
    insert into public.guest_communication_timeline(id,conversation_id,event_type,visibility,message_id,safe_summary,metadata,occurred_at)
    values('guest-timeline-'||gen_random_uuid(),p_conversation_id,'template-used','internal',p_message_id,'Communication template applied and reviewed by an operator.',jsonb_build_object('templateId',p_template_id),now_at);
  end if;
  delete from public.guest_communication_drafts where conversation_id=p_conversation_id and profile_id=actor_id;
  update public.guest_conversations set status='waiting-on-guest',unread_count=0,last_activity_at=now_at,updated_at=now_at,revision=revision+1 where id=p_conversation_id;
  return p_message_id;
end $$;
revoke all on function public.save_guest_communication_draft(text,text,text) from public;
revoke all on function public.queue_guest_communication_message(text,text,text,text,text) from public;
grant execute on function public.save_guest_communication_draft(text,text,text) to authenticated;
grant execute on function public.queue_guest_communication_message(text,text,text,text,text) to authenticated;
commit;
