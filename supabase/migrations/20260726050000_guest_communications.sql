-- PC-001E: Conversation-centered Guest Communication Workspace.
create table public.guest_conversations(
 id text primary key,workspace_id uuid not null references public.profiles(id),reservation_id text not null,booking_id uuid not null references public.bookings(id),
 guest_id uuid not null references public.guests(id),property_id uuid not null references public.properties(id),channel text not null check(channel in('hospitable','email','sms','airbnb','vrbo','internal')),
 status text not null check(status in('unread','needs-reply','waiting-on-guest','waiting-on-host','resolved','archived')),assigned_to_profile_id uuid references public.profiles(id),
 unread_count integer not null default 0 check(unread_count>=0),last_activity_at timestamptz not null,provider_conversation_id text,revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(workspace_id,booking_id,channel),unique(channel,provider_conversation_id)
);
create table public.guest_communication_messages(
 id text primary key,conversation_id text not null references public.guest_conversations(id),sender_type text not null check(sender_type in('guest','operator','provider','system')),
 sender_profile_id uuid references public.profiles(id),sender_display_name text not null,body text not null check(length(body)between 1 and 10000),
 delivery_status text not null check(delivery_status in('draft','queued','sent','delivered','failed','read','unknown')),provider_message_id text,scheduled_for timestamptz,
 created_at timestamptz not null,delivered_at timestamptz,read_at timestamptz,failure_code text,idempotency_key text unique not null,unique(conversation_id,provider_message_id)
);
create table public.guest_communication_templates(
 id text primary key,workspace_id uuid references public.profiles(id),category text not null,title text not null,body text not null,variables text[] not null default '{}',
 status text not null check(status in('active','inactive','archived')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(workspace_id,title)
);
create table public.guest_communication_notes(
 id text primary key,conversation_id text not null references public.guest_conversations(id),body text not null check(length(body)between 1 and 5000),pinned boolean not null default false,
 author_profile_id uuid not null references public.profiles(id),created_at timestamptz not null default now()
);
create table public.guest_communication_attachments(
 id text primary key,conversation_id text not null references public.guest_conversations(id),message_id text references public.guest_communication_messages(id),
 attachment_type text not null check(attachment_type in('image','pdf','guidebook','link')),name text not null,storage_path text,url text,mime_type text,size_bytes bigint,
 created_at timestamptz not null default now(),check(storage_path is not null or url is not null)
);
create table public.guest_communication_timeline(
 id text primary key,conversation_id text not null references public.guest_conversations(id),event_type text not null check(event_type in('message','template-used','guidebook-sent','internal-note','status-changed','action-created','attachment')),
 visibility text not null check(visibility in('guest','internal')),message_id text references public.guest_communication_messages(id),note_id text references public.guest_communication_notes(id),
 safe_summary text not null,metadata jsonb not null default '{}',occurred_at timestamptz not null
);
create table public.guest_communication_action_links(
 id text primary key,conversation_id text not null references public.guest_conversations(id),platform_action_id text not null,action_type text not null,created_by_profile_id uuid not null,
 created_at timestamptz not null default now(),unique(conversation_id,platform_action_id)
);
create table public.guest_communication_ai_drafts(
 id text primary key,conversation_id text not null references public.guest_conversations(id),body text not null,context_version text not null,source_references text[] not null,
 status text not null check(status in('generated','accepted','discarded','edited')),created_by_profile_id uuid not null,created_at timestamptz not null default now(),reviewed_at timestamptz
);
create index guest_conversation_inbox_idx on public.guest_conversations(workspace_id,status,last_activity_at desc);
create index guest_message_timeline_idx on public.guest_communication_messages(conversation_id,created_at);
create index guest_timeline_idx on public.guest_communication_timeline(conversation_id,occurred_at);
alter table public.guest_conversations enable row level security;alter table public.guest_communication_messages enable row level security;alter table public.guest_communication_templates enable row level security;
alter table public.guest_communication_notes enable row level security;alter table public.guest_communication_attachments enable row level security;alter table public.guest_communication_timeline enable row level security;
alter table public.guest_communication_action_links enable row level security;alter table public.guest_communication_ai_drafts enable row level security;
create policy "Owners read conversations" on public.guest_conversations for select to authenticated using(workspace_id=auth.uid()or public.is_admin());
create policy "Owners read conversation messages" on public.guest_communication_messages for select to authenticated using(exists(select 1 from public.guest_conversations c where c.id=conversation_id and(c.workspace_id=auth.uid()or public.is_admin())));
create policy "Owners read communication templates" on public.guest_communication_templates for select to authenticated using(workspace_id is null or workspace_id=auth.uid()or public.is_admin());
create policy "Owners read private communication notes" on public.guest_communication_notes for select to authenticated using(exists(select 1 from public.guest_conversations c where c.id=conversation_id and(c.workspace_id=auth.uid()or public.is_admin())));
create policy "Owners read communication attachments" on public.guest_communication_attachments for select to authenticated using(exists(select 1 from public.guest_conversations c where c.id=conversation_id and(c.workspace_id=auth.uid()or public.is_admin())));
create policy "Owners read communication timeline" on public.guest_communication_timeline for select to authenticated using(exists(select 1 from public.guest_conversations c where c.id=conversation_id and(c.workspace_id=auth.uid()or public.is_admin())));
create policy "Owners read communication action links" on public.guest_communication_action_links for select to authenticated using(exists(select 1 from public.guest_conversations c where c.id=conversation_id and(c.workspace_id=auth.uid()or public.is_admin())));
create policy "Owners read own AI drafts" on public.guest_communication_ai_drafts for select to authenticated using(created_by_profile_id=auth.uid()and exists(select 1 from public.guest_conversations c where c.id=conversation_id and c.workspace_id=auth.uid()));
grant select on public.guest_conversations,public.guest_communication_messages,public.guest_communication_templates,public.guest_communication_notes,public.guest_communication_attachments,public.guest_communication_timeline,public.guest_communication_action_links,public.guest_communication_ai_drafts to authenticated;
create or replace function public.prevent_guest_communication_history_change()returns trigger language plpgsql set search_path='' as $$begin raise exception 'guest communication history is immutable' using errcode='55000';end;$$;
create trigger guest_messages_immutable before update or delete on public.guest_communication_messages for each row when(old.delivery_status not in('draft','queued'))execute function public.prevent_guest_communication_history_change();
create trigger guest_notes_immutable before update or delete on public.guest_communication_notes for each row execute function public.prevent_guest_communication_history_change();
create trigger guest_timeline_immutable before update or delete on public.guest_communication_timeline for each row execute function public.prevent_guest_communication_history_change();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('guest-communication-attachments','guest-communication-attachments',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id)do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "Service role manages guest communication attachments" on storage.objects for all to service_role using(bucket_id='guest-communication-attachments')with check(bucket_id='guest-communication-attachments');

insert into public.guest_communication_templates(id,workspace_id,category,title,body,variables,status)values
('communication-template-booking-confirmation',null,'booking-confirmation','Booking Confirmation','Hello {{guestName}}, your stay at {{propertyName}} from {{arrival}} to {{departure}} is confirmed.',array['guestName','propertyName','arrival','departure'],'active'),
('communication-template-pre-arrival',null,'pre-arrival','Pre-arrival','Hello {{guestName}}, we look forward to welcoming you to {{propertyName}}. Your Guidebook is {{guidebookLink}}.',array['guestName','propertyName','guidebookLink'],'active'),
('communication-template-check-in',null,'check-in','Check-in','Check-in begins at {{checkInTime}}. Your Guidebook is {{guidebookLink}}.',array['checkInTime','guidebookLink'],'active'),
('communication-template-parking',null,'parking','Parking','Parking details are available in your Guidebook: {{guidebookLink}}.',array['guidebookLink'],'active'),
('communication-template-wifi',null,'wifi','Wi-Fi','The Wi-Fi details for {{propertyName}} are: {{wifi}}.',array['propertyName','wifi'],'active'),
('communication-template-first-night',null,'first-night','First Night','Hello {{guestName}}, how is your first night at {{propertyName}}?',array['guestName','propertyName'],'active'),
('communication-template-checkout',null,'checkout-reminder','Checkout Reminder','Checkout is at {{checkoutTime}}. Thank you for staying with us.',array['checkoutTime'],'active'),
('communication-template-review',null,'review-request','Review Request','Thank you for staying at {{propertyName}}. We would appreciate your feedback.',array['propertyName'],'active'),
('communication-template-issue',null,'issue-acknowledgement','Issue Acknowledgement','Thank you for letting us know, {{guestName}}. We are reviewing this now.',array['guestName'],'active'),
('communication-template-thank-you',null,'thank-you','Thank You','Thank you for staying with us, {{guestName}}.',array['guestName'],'active');

insert into public.commerce_entitlement_templates(id,entitlement_key,name,description,scope_type,grant_type,duration_policy,status,metadata,created_at,updated_at)
values('commerce-entitlement-guest-communications','guest_communications.use','Use Guest Communications','View and operate the Guest Communication Workspace.','workspace','capability','subscription-period','active','{}',now(),now())
on conflict(entitlement_key)do nothing;
