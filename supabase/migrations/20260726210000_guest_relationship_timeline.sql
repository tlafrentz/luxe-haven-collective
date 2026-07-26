-- COM-006A: canonical append-only guest relationship timeline.
begin;
create table public.guest_relationship_events(
 id uuid primary key default gen_random_uuid(),sequence bigint generated always as identity unique,
 workspace_id uuid not null references public.profiles(id) on delete restrict,guest_id uuid not null references public.guests(id) on delete restrict,
 occurred_at timestamptz not null,recorded_at timestamptz not null default now(),event_type text not null,category text not null,
 visibility text not null default 'operational' check(visibility in('operational','internal')),
 actor_type text not null default 'system' check(actor_type in('guest','operator','provider','system')),
 actor_id text,actor_display_name text,summary text not null,
 reservation_id text,booking_id uuid references public.bookings(id) on delete restrict,property_id uuid references public.properties(id) on delete restrict,
 conversation_id text references public.guest_conversations(id) on delete restrict,message_id text references public.guest_communication_messages(id) on delete restrict,
 source_type text not null,source_id text not null,source_version text not null default '1',metadata jsonb not null default '{}',
 unique(workspace_id,source_type,source_id,source_version,event_type)
);
create index guest_relationship_timeline_idx on public.guest_relationship_events(workspace_id,guest_id,occurred_at desc,sequence desc);
create index guest_relationship_timeline_category_idx on public.guest_relationship_events(workspace_id,guest_id,category,occurred_at desc,sequence desc);
create index guest_relationship_timeline_reservation_idx on public.guest_relationship_events(reservation_id,occurred_at desc);
create index guest_relationship_timeline_property_idx on public.guest_relationship_events(property_id,occurred_at desc);
create index guest_relationship_timeline_search_idx on public.guest_relationship_events using gin(to_tsvector('english',coalesce(summary,'')||' '||coalesce(event_type,'')||' '||coalesce(reservation_id,'')));
alter table public.guest_relationship_events enable row level security;
create policy "Authorized operators inspect guest relationship history" on public.guest_relationship_events for select to authenticated using(
 (property_id is not null and public.can_access_workspace_property(property_id))
 or(property_id is null and public.active_workspace_role(workspace_id)in('owner','administrator','operator'))
 or public.is_admin()
);
grant select on public.guest_relationship_events to authenticated;
create trigger guest_relationship_events_immutable before update or delete on public.guest_relationship_events for each row execute function public.prevent_guest_communication_history_change();

create or replace function public.append_guest_relationship_event(
 p_workspace_id uuid,p_guest_id uuid,p_occurred_at timestamptz,p_event_type text,p_category text,p_visibility text,p_actor_type text,
 p_actor_id text,p_actor_display_name text,p_summary text,p_reservation_id text,p_booking_id uuid,p_property_id uuid,p_conversation_id text,
 p_message_id text,p_source_type text,p_source_id text,p_source_version text,p_metadata jsonb
)returns uuid language plpgsql security definer set search_path=public as $$
declare event_id uuid;begin
 if auth.role()<>'service_role'then raise exception 'guest_timeline_append_requires_service_role'using errcode='42501';end if;
 insert into public.guest_relationship_events(workspace_id,guest_id,occurred_at,event_type,category,visibility,actor_type,actor_id,actor_display_name,summary,reservation_id,booking_id,property_id,conversation_id,message_id,source_type,source_id,source_version,metadata)
 values(p_workspace_id,p_guest_id,p_occurred_at,p_event_type,p_category,p_visibility,p_actor_type,p_actor_id,p_actor_display_name,p_summary,p_reservation_id,p_booking_id,p_property_id,p_conversation_id,p_message_id,p_source_type,p_source_id,coalesce(p_source_version,'1'),coalesce(p_metadata,'{}'))
 on conflict(workspace_id,source_type,source_id,source_version,event_type)do nothing returning id into event_id;
 return event_id;
end;
$$;
revoke all on function public.append_guest_relationship_event(uuid,uuid,timestamptz,text,text,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,jsonb)from public;
grant execute on function public.append_guest_relationship_event(uuid,uuid,timestamptz,text,text,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,jsonb)to service_role;

create or replace function public.capture_guest_message_relationship_event()returns trigger language plpgsql security definer set search_path=public as $$
declare conversation public.guest_conversations%rowtype;begin
 select*into conversation from public.guest_conversations where id=new.conversation_id;
 insert into public.guest_relationship_events(workspace_id,guest_id,occurred_at,event_type,category,visibility,actor_type,actor_id,actor_display_name,summary,reservation_id,booking_id,property_id,conversation_id,message_id,source_type,source_id,source_version,metadata)
 values(conversation.workspace_id,conversation.guest_id,new.created_at,case when new.direction='inbound'then'guest-replied'else'message-sent'end,'messages','operational',case when new.direction='inbound'then'guest'else'operator'end,new.sender_profile_id::text,new.sender_display_name,case when new.direction='inbound'then'Guest replied.'else'Operator sent a message.'end,conversation.reservation_id,conversation.booking_id,conversation.property_id,conversation.id,new.id,'guest-message',new.id,'created',jsonb_build_object('direction',new.direction,'channel',new.message_channel,'templateId',new.template_id))on conflict do nothing;return new;
end;
$$;
create trigger guest_message_relationship_event after insert on public.guest_communication_messages for each row execute function public.capture_guest_message_relationship_event();

create or replace function public.capture_guest_delivery_relationship_event()returns trigger language plpgsql security definer set search_path=public as $$
declare conversation public.guest_conversations%rowtype;event_name text;begin
 if new.status not in('delivered','read','failed')then return new;end if;event_name:=case when new.status='delivered'then'message-delivered'when new.status='read'then'message-read'else'message-delivery-failed'end;
 select*into conversation from public.guest_conversations where id=new.conversation_id;
 insert into public.guest_relationship_events(workspace_id,guest_id,occurred_at,event_type,category,visibility,actor_type,summary,reservation_id,booking_id,property_id,conversation_id,message_id,source_type,source_id,source_version,metadata)
 values(conversation.workspace_id,conversation.guest_id,new.occurred_at,event_name,'messages','operational','provider',case when new.status='delivered'then'Message delivered.'when new.status='read'then'Message read.'else'Message delivery failed.'end,conversation.reservation_id,conversation.booking_id,conversation.property_id,conversation.id,new.message_id,'delivery-event',new.id,new.status,jsonb_build_object('status',new.status,'provider',new.provider,'retryable',new.retryable))on conflict do nothing;return new;
end;
$$;
create trigger guest_delivery_relationship_event after insert on public.guest_message_delivery_events for each row execute function public.capture_guest_delivery_relationship_event();

create or replace function public.capture_guest_note_relationship_event()returns trigger language plpgsql security definer set search_path=public as $$
declare conversation public.guest_conversations%rowtype;begin select*into conversation from public.guest_conversations where id=new.conversation_id;
 insert into public.guest_relationship_events(workspace_id,guest_id,occurred_at,event_type,category,visibility,actor_type,actor_id,summary,reservation_id,booking_id,property_id,conversation_id,source_type,source_id,source_version,metadata)
 values(conversation.workspace_id,conversation.guest_id,new.created_at,'internal-note','notes','internal','operator',new.author_profile_id::text,'Internal guest relationship note added.',conversation.reservation_id,conversation.booking_id,conversation.property_id,conversation.id,'guest-note',new.id,'created',jsonb_build_object('pinned',new.pinned))on conflict do nothing;return new;end;
$$;
create trigger guest_note_relationship_event after insert on public.guest_communication_notes for each row execute function public.capture_guest_note_relationship_event();

create or replace function public.capture_guest_conversation_activity_relationship_event()returns trigger language plpgsql security definer set search_path=public as $$
declare conversation public.guest_conversations%rowtype;mapped text;template_category text;begin
 if new.event_type='template-applied'then select category into template_category from public.guest_communication_templates where id=new.metadata->>'templateId';end if;
 mapped:=case when new.event_type='conversation-archived'then'conversation-archived'when new.event_type='template-applied'and template_category='review-request'then'review-requested'when new.event_type='template-applied'and template_category='check-in'then'check-in-reminder-sent'when new.event_type='template-applied'then'template-used'when new.event_type='attachment-added'then'attachment-added'else null end;if mapped is null then return new;end if;
 select*into conversation from public.guest_conversations where id=new.conversation_id;
 insert into public.guest_relationship_events(workspace_id,guest_id,occurred_at,event_type,category,visibility,actor_type,actor_id,summary,reservation_id,booking_id,property_id,conversation_id,source_type,source_id,source_version,metadata)
 values(conversation.workspace_id,conversation.guest_id,new.occurred_at,mapped,case when mapped='review-requested'then'reviews'else'messages'end,'internal','operator',new.actor_profile_id::text,new.safe_summary,conversation.reservation_id,conversation.booking_id,conversation.property_id,conversation.id,'conversation-activity',new.id,new.event_type,new.metadata)on conflict do nothing;return new;end;
$$;
create trigger guest_conversation_activity_relationship_event after insert on public.guest_conversation_activity for each row execute function public.capture_guest_conversation_activity_relationship_event();

create or replace function public.capture_guest_booking_relationship_event()returns trigger language plpgsql security definer set search_path=public as $$
declare workspace uuid;event_name text;occurred timestamptz;begin if new.primary_guest_id is null then return new;end if;select owner_id into workspace from public.guests where id=new.primary_guest_id;if workspace is null then return new;end if;
 event_name:=case when tg_op='INSERT'then'reservation-created'when new.status='cancelled'and old.status is distinct from new.status then'reservation-cancelled'when new.status='completed'and old.status is distinct from new.status then'checkout'when new.check_in=current_date and old.status is distinct from new.status then'check-in'else'reservation-updated'end;occurred:=coalesce(new.updated_at,new.created_at,now());
 insert into public.guest_relationship_events(workspace_id,guest_id,occurred_at,event_type,category,visibility,actor_type,summary,reservation_id,booking_id,property_id,source_type,source_id,source_version,metadata)
 values(workspace,new.primary_guest_id,occurred,event_name,'reservations','operational','provider',case when event_name='reservation-created' then'Reservation created.'when event_name='reservation-cancelled'then'Reservation cancelled.'when event_name='checkout'then'Guest checked out.'when event_name='check-in'then'Guest checked in.'else'Reservation details updated.'end,coalesce(new.external_reservation_id,new.booking_code,new.id::text),new.id,new.property_id,'booking',new.id::text,case when tg_op='INSERT'then'created'else'updated:'||occurred::text end,jsonb_build_object('arrival',new.check_in,'departure',new.check_out,'status',new.status,'bookingSource',new.source,'nights',new.check_out-new.check_in))on conflict do nothing;return new;end;
$$;
create trigger guest_booking_relationship_event after insert or update on public.bookings for each row execute function public.capture_guest_booking_relationship_event();

create or replace function public.capture_guest_maintenance_relationship_event()returns trigger language plpgsql security definer set search_path=public as $$
declare conversation record;event_name text;occurred timestamptz;begin event_name:=case when tg_op='INSERT'then'maintenance-issue'when new.status='resolved'and old.status is distinct from new.status then'maintenance-resolved'else null end;if event_name is null then return new;end if;occurred:=coalesce(new.resolved_at,new.created_at,now());
 for conversation in select distinct on(c.guest_id)c.* from public.guest_conversations c where c.property_id=new.property_id order by c.guest_id,c.last_activity_at desc loop
  insert into public.guest_relationship_events(workspace_id,guest_id,occurred_at,event_type,category,visibility,actor_type,summary,reservation_id,booking_id,property_id,conversation_id,source_type,source_id,source_version,metadata)
  values(conversation.workspace_id,conversation.guest_id,occurred,event_name,'maintenance','operational','system',case when event_name='maintenance-resolved'then'Maintenance issue resolved.'else'Maintenance issue recorded for the property.'end,conversation.reservation_id,conversation.booking_id,new.property_id,conversation.id,'maintenance-request',new.id::text,event_name,jsonb_build_object('priority',new.priority,'status',new.status,'issueType','maintenance'))on conflict do nothing;end loop;return new;end;
$$;
create trigger guest_maintenance_relationship_event after insert or update on public.maintenance_requests for each row execute function public.capture_guest_maintenance_relationship_event();

create or replace function public.capture_guest_guidebook_relationship_event()returns trigger language plpgsql security definer set search_path=public as $$
declare guide public.guidebooks%rowtype;booking record;begin select*into guide from public.guidebooks where id=new.guidebook_id;
 for booking in select b.* from public.bookings b where b.property_id=guide.property_id and b.primary_guest_id is not null and b.check_out>=new.published_at::date loop
  insert into public.guest_relationship_events(workspace_id,guest_id,occurred_at,event_type,category,visibility,actor_type,actor_id,summary,reservation_id,booking_id,property_id,source_type,source_id,source_version,metadata)
  values(guide.workspace_id,booking.primary_guest_id,new.published_at,'guidebook-published','guidebooks','operational','operator',new.published_by_profile_id::text,'Guidebook version published for the guest stay.',coalesce(booking.external_reservation_id,booking.booking_code,booking.id::text),booking.id,guide.property_id,'guidebook-version',new.id::text,new.version::text,jsonb_build_object('guidebookId',guide.id,'version',new.version))on conflict do nothing;end loop;return new;end;
$$;
create trigger guest_guidebook_relationship_event after insert on public.guidebook_versions for each row execute function public.capture_guest_guidebook_relationship_event();

-- Establish history for records that predate the event stream.
insert into public.guest_relationship_events(workspace_id,guest_id,occurred_at,event_type,category,visibility,actor_type,summary,reservation_id,booking_id,property_id,source_type,source_id,source_version,metadata)
select g.owner_id,b.primary_guest_id,b.created_at,'reservation-created','reservations','operational','provider','Reservation created.',coalesce(b.external_reservation_id,b.booking_code,b.id::text),b.id,b.property_id,'booking',b.id::text,'created',jsonb_build_object('arrival',b.check_in,'departure',b.check_out,'status',b.status,'bookingSource',b.source,'nights',b.check_out-b.check_in)from public.bookings b join public.guests g on g.id=b.primary_guest_id where b.primary_guest_id is not null on conflict do nothing;
insert into public.guest_relationship_events(workspace_id,guest_id,occurred_at,event_type,category,visibility,actor_type,actor_id,actor_display_name,summary,reservation_id,booking_id,property_id,conversation_id,message_id,source_type,source_id,source_version,metadata)
select c.workspace_id,c.guest_id,m.created_at,case when m.direction='inbound'then'guest-replied'else'message-sent'end,'messages','operational',case when m.direction='inbound'then'guest'else'operator'end,m.sender_profile_id::text,m.sender_display_name,case when m.direction='inbound'then'Guest replied.'else'Operator sent a message.'end,c.reservation_id,c.booking_id,c.property_id,c.id,m.id,'guest-message',m.id,'created',jsonb_build_object('direction',m.direction,'channel',m.message_channel,'templateId',m.template_id)from public.guest_communication_messages m join public.guest_conversations c on c.id=m.conversation_id on conflict do nothing;
insert into public.guest_relationship_events(workspace_id,guest_id,occurred_at,event_type,category,visibility,actor_type,actor_id,summary,reservation_id,booking_id,property_id,conversation_id,source_type,source_id,source_version,metadata)
select c.workspace_id,c.guest_id,n.created_at,'internal-note','notes','internal','operator',n.author_profile_id::text,'Internal guest relationship note added.',c.reservation_id,c.booking_id,c.property_id,c.id,'guest-note',n.id,'created',jsonb_build_object('pinned',n.pinned)from public.guest_communication_notes n join public.guest_conversations c on c.id=n.conversation_id on conflict do nothing;
commit;
