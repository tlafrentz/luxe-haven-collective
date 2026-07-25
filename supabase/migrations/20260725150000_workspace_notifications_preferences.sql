-- Sprint 4E: personal notification policy and user workspace preferences.
begin;

create table public.workspace_notification_defaults (
  workspace_id uuid primary key references public.owners(id) on delete cascade,
  defaults jsonb not null default '{}'::jsonb,
  policy_version text not null default 'workspace-notification-policy-v1',
  updated_by_profile_id uuid references public.profiles(id) on delete set null,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_notification_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  channels jsonb not null default '{"inApp":true,"email":true}'::jsonb,
  subscriptions jsonb not null default '[]'::jsonb,
  digest jsonb not null default '{"frequency":"weekly","day":1,"time":"08:00"}'::jsonb,
  quiet_hours jsonb not null default '{"enabled":false,"start":"22:00","end":"07:00","allowCritical":true}'::jsonb,
  timezone text not null default 'America/Chicago',
  confirmed boolean not null default false,
  schema_version integer not null default 1,
  last_command_id text,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,profile_id)
);

create table public.user_workspace_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  timezone text,
  locale text not null default 'en-US',
  default_landing_page text not null default 'home' check(default_landing_page in ('home','workspace','bookings','actions','intelligence')),
  default_property_mode text not null default 'all-accessible' check(default_property_mode in ('all-accessible','last-used','specific')),
  default_property_id uuid references public.properties(id) on delete set null,
  date_format text not null default 'system' check(date_format in ('system','mdy','medium')),
  time_format text not null default 'system' check(time_format in ('system','12-hour','24-hour')),
  display_density text not null default 'comfortable' check(display_density in ('comfortable','compact')),
  motion_preference text not null default 'system' check(motion_preference in ('system','reduced')),
  intelligence_detail text not null default 'standard' check(intelligence_detail in ('summary','standard','detailed')),
  last_command_id text,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,profile_id),
  check(default_property_mode='specific' or default_property_id is null)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check(category in ('operations','guests-bookings','actions','performance-intelligence','properties-systems','team-security')),
  event_type text not null,
  urgency text not null check(urgency in ('critical','action-required','informational')),
  subject_type text not null,
  subject_id text not null,
  property_id uuid references public.properties(id) on delete cascade,
  title text not null,
  body text not null,
  action_url text,
  status text not null default 'unread' check(status in ('unread','read','dismissed','expired')),
  required boolean not null default false,
  deduplication_key text not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(workspace_id,recipient_profile_id,deduplication_key)
);
create index notifications_recipient_status_created_idx on public.notifications(recipient_profile_id,status,created_at desc);
create index notifications_workspace_event_idx on public.notifications(workspace_id,event_type,created_at desc);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check(channel in ('in-app','email')),
  status text not null check(status in ('queued','delivered','failed','deferred','suppressed')),
  attempted_at timestamptz,
  delivered_at timestamptz,
  failure_code text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notification_id,channel)
);

create table public.workspace_notification_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  command_id text not null,
  occurred_at timestamptz not null default now(),
  unique(workspace_id,command_id)
);

insert into public.user_notification_preferences(workspace_id,profile_id,timezone)
select membership.workspace_id,membership.profile_id,
  coalesce(nullif(owner.timezone,''),'America/Chicago')
from public.workspace_memberships membership
join public.owners owner on owner.id=membership.workspace_id
where membership.status='active'
on conflict(workspace_id,profile_id) do nothing;
insert into public.user_workspace_preferences(workspace_id,profile_id,timezone,locale)
select membership.workspace_id,membership.profile_id,owner.timezone,coalesce(owner.language,'en-US')
from public.workspace_memberships membership join public.owners owner on owner.id=membership.workspace_id
where membership.status='active'
on conflict(workspace_id,profile_id) do nothing;

alter table public.workspace_notification_defaults enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.user_workspace_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.workspace_notification_activity enable row level security;

create policy "Active members read workspace notification defaults" on public.workspace_notification_defaults for select to authenticated
using(public.active_workspace_role(workspace_id) is not null or public.is_admin());
create policy "Members manage own notification preferences" on public.user_notification_preferences for all to authenticated
using(profile_id=auth.uid() and public.active_workspace_role(workspace_id) is not null)
with check(profile_id=auth.uid() and public.active_workspace_role(workspace_id) is not null);
create policy "Members manage own workspace preferences" on public.user_workspace_preferences for all to authenticated
using(profile_id=auth.uid() and public.active_workspace_role(workspace_id) is not null)
with check(profile_id=auth.uid() and public.active_workspace_role(workspace_id) is not null);
create policy "Recipients read own notifications" on public.notifications for select to authenticated
using(recipient_profile_id=auth.uid() and public.active_workspace_role(workspace_id) is not null
  and (property_id is null or public.can_access_workspace_property(property_id)));
create policy "Recipients update own notifications" on public.notifications for update to authenticated
using(recipient_profile_id=auth.uid() and public.active_workspace_role(workspace_id) is not null)
with check(recipient_profile_id=auth.uid());
create policy "Recipients read own notification deliveries" on public.notification_deliveries for select to authenticated
using(exists(select 1 from public.notifications n where n.id=notification_id and n.recipient_profile_id=auth.uid()));
create policy "Administrators read notification policy activity" on public.workspace_notification_activity for select to authenticated
using(public.active_workspace_role(workspace_id) in ('owner','administrator') or public.is_admin());

grant select on public.workspace_notification_defaults,public.notification_deliveries,public.workspace_notification_activity to authenticated;
grant select on public.user_notification_preferences,public.user_workspace_preferences to authenticated;
grant select on public.notifications to authenticated;

create or replace function public.update_personal_workspace_settings(
  p_workspace_id uuid,p_section text,p_payload jsonb,p_expected_revision bigint,p_command_id text
) returns bigint language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid(); next_revision bigint;
begin
  if actor_id is null or public.active_workspace_role(p_workspace_id) is null then
    raise exception 'Active workspace membership is required' using errcode='42501';
  end if;
  if p_section='notifications' then
    select revision into next_revision from public.user_notification_preferences
      where workspace_id=p_workspace_id and profile_id=actor_id and last_command_id=p_command_id;
    if next_revision is not null then return next_revision; end if;
    if coalesce((p_payload#>>'{quietHours,allowCritical}')::boolean,true)=false then
      raise exception 'Critical notification bypass cannot be disabled' using errcode='22023';
    end if;
    insert into public.user_notification_preferences(workspace_id,profile_id,channels,subscriptions,digest,quiet_hours,timezone,confirmed,revision,last_command_id)
    values(p_workspace_id,actor_id,p_payload->'channels',p_payload->'subscriptions',p_payload->'digest',p_payload->'quietHours',p_payload->>'timezone',true,1,p_command_id)
    on conflict(workspace_id,profile_id) do update set
      channels=excluded.channels,subscriptions=excluded.subscriptions,digest=excluded.digest,
      quiet_hours=excluded.quiet_hours,timezone=excluded.timezone,confirmed=true,
      revision=user_notification_preferences.revision+1,last_command_id=p_command_id,updated_at=now()
    where user_notification_preferences.revision=p_expected_revision
    returning revision into next_revision;
  elsif p_section='preferences' then
    select revision into next_revision from public.user_workspace_preferences
      where workspace_id=p_workspace_id and profile_id=actor_id and last_command_id=p_command_id;
    if next_revision is not null then return next_revision; end if;
    if (p_payload->>'defaultPropertyMode')='specific' and not public.can_access_workspace_property((p_payload->>'defaultPropertyId')::uuid) then
      raise exception 'Default property is not accessible' using errcode='42501';
    end if;
    insert into public.user_workspace_preferences(workspace_id,profile_id,timezone,locale,default_landing_page,default_property_mode,default_property_id,date_format,time_format,display_density,motion_preference,intelligence_detail,revision,last_command_id)
    values(p_workspace_id,actor_id,nullif(p_payload->>'timezone',''),p_payload->>'locale',p_payload->>'defaultLandingPage',
      p_payload->>'defaultPropertyMode',nullif(p_payload->>'defaultPropertyId','')::uuid,p_payload->>'dateFormat',
      p_payload->>'timeFormat',p_payload->>'density',p_payload->>'motion',p_payload->>'intelligenceDetail',1,p_command_id)
    on conflict(workspace_id,profile_id) do update set timezone=excluded.timezone,locale=excluded.locale,
      default_landing_page=excluded.default_landing_page,default_property_mode=excluded.default_property_mode,
      default_property_id=excluded.default_property_id,date_format=excluded.date_format,time_format=excluded.time_format,
      display_density=excluded.display_density,motion_preference=excluded.motion_preference,
      intelligence_detail=excluded.intelligence_detail,revision=user_workspace_preferences.revision+1,last_command_id=p_command_id,updated_at=now()
    where user_workspace_preferences.revision=p_expected_revision
    returning revision into next_revision;
  else raise exception 'Unsupported settings section' using errcode='22023';
  end if;
  if next_revision is null then raise exception 'Settings changed in another session' using errcode='40001'; end if;
  return next_revision;
end $$;
revoke all on function public.update_personal_workspace_settings(uuid,text,jsonb,bigint,text) from public;
grant execute on function public.update_personal_workspace_settings(uuid,text,jsonb,bigint,text) to authenticated;

create or replace function public.update_notification_state(p_notification_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if p_status not in ('read','dismissed') then raise exception 'Invalid notification state'; end if;
  update public.notifications set status=p_status,read_at=case when p_status='read' then now() else read_at end,
    dismissed_at=case when p_status='dismissed' then now() else dismissed_at end
  where id=p_notification_id and recipient_profile_id=auth.uid()
    and public.active_workspace_role(workspace_id) is not null
    and not(required and p_status='dismissed');
  if not found then raise exception 'Notification cannot be updated' using errcode='42501'; end if;
end $$;
revoke all on function public.update_notification_state(uuid,text) from public;
grant execute on function public.update_notification_state(uuid,text) to authenticated;

commit;
