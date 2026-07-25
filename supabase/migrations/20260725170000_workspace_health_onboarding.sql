-- Sprint 4F: readiness history, onboarding review, and issue interaction state.
begin;
create table public.workspace_onboarding (
  workspace_id uuid primary key references public.owners(id) on delete cascade,
  status text not null default 'not-started' check(status in ('not-started','in-progress','ready-for-review','completed','needs-attention')),
  started_at timestamptz,completed_at timestamptz,last_reviewed_at timestamptz,
  completed_by_profile_id uuid references public.profiles(id) on delete set null,
  source_version text not null default 'workspace-readiness-v1',
  created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.workspace_health_issues (
  id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.owners(id) on delete cascade,
  issue_code text not null,dimension text not null,severity text not null check(severity in ('critical','action-required','recommended','informational')),
  status text not null default 'active' check(status in ('active','acknowledged','resolved','dismissed')),
  subject_type text,subject_id text,first_detected_at timestamptz not null default now(),last_detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,acknowledged_by_profile_id uuid references public.profiles(id) on delete set null,
  dismissed_at timestamptz,dismissed_by_profile_id uuid references public.profiles(id) on delete set null,resolved_at timestamptz,
  created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(workspace_id,issue_code,subject_type,subject_id)
);
create index workspace_health_issues_active_idx on public.workspace_health_issues(workspace_id,status,severity,last_detected_at desc);
create table public.workspace_readiness_activity (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.owners(id) on delete cascade,
 actor_profile_id uuid references public.profiles(id) on delete set null,action text not null,command_id text not null,
 occurred_at timestamptz not null default now(),unique(workspace_id,command_id)
);
insert into public.workspace_onboarding(workspace_id,status,started_at)
select owner.id,'in-progress',owner.created_at from public.owners owner on conflict(workspace_id) do nothing;
alter table public.workspace_onboarding enable row level security;
alter table public.workspace_health_issues enable row level security;
alter table public.workspace_readiness_activity enable row level security;
create policy "Active members read onboarding" on public.workspace_onboarding for select to authenticated using(public.active_workspace_role(workspace_id) is not null or public.is_admin());
create policy "Active members read health issues" on public.workspace_health_issues for select to authenticated using(public.active_workspace_role(workspace_id) is not null or public.is_admin());
create policy "Administrators read readiness activity" on public.workspace_readiness_activity for select to authenticated using(public.active_workspace_role(workspace_id) in ('owner','administrator') or public.is_admin());
grant select on public.workspace_onboarding,public.workspace_health_issues,public.workspace_readiness_activity to authenticated;
create or replace function public.apply_workspace_health_command(p_workspace_id uuid,p_action text,p_issue_code text,p_command_id text)
returns void language plpgsql security definer set search_path=public as $$
declare actor_id uuid:=auth.uid();issue_row public.workspace_health_issues%rowtype;
begin
 if actor_id is null or public.active_workspace_role(p_workspace_id) is null then raise exception 'Active workspace membership is required' using errcode='42501'; end if;
 if exists(select 1 from public.workspace_readiness_activity where workspace_id=p_workspace_id and command_id=p_command_id) then return; end if;
 if p_action='complete-review' then
   if public.active_workspace_role(p_workspace_id) not in ('owner','administrator') then raise exception 'Readiness review requires administration' using errcode='42501'; end if;
   insert into public.workspace_onboarding(workspace_id,status,started_at,completed_at,last_reviewed_at,completed_by_profile_id)
   values(p_workspace_id,'completed',now(),now(),now(),actor_id) on conflict(workspace_id) do update
   set status='completed',completed_at=coalesce(workspace_onboarding.completed_at,now()),last_reviewed_at=now(),completed_by_profile_id=actor_id,updated_at=now();
 elsif p_action in ('acknowledge','dismiss') then
   select * into issue_row from public.workspace_health_issues where workspace_id=p_workspace_id and issue_code=p_issue_code for update;
   if not found then raise exception 'Health issue was not found'; end if;
   if p_action='dismiss' and issue_row.severity not in ('recommended','informational') then raise exception 'This issue cannot be dismissed' using errcode='22023'; end if;
   update public.workspace_health_issues set status=case when p_action='dismiss' then 'dismissed' else 'acknowledged' end,
     acknowledged_at=case when p_action='acknowledge' then now() else acknowledged_at end,
     acknowledged_by_profile_id=case when p_action='acknowledge' then actor_id else acknowledged_by_profile_id end,
     dismissed_at=case when p_action='dismiss' then now() else dismissed_at end,
     dismissed_by_profile_id=case when p_action='dismiss' then actor_id else dismissed_by_profile_id end,updated_at=now()
   where id=issue_row.id;
 else raise exception 'Unsupported health command';
 end if;
 insert into public.workspace_readiness_activity(workspace_id,actor_profile_id,action,command_id) values(p_workspace_id,actor_id,p_action,p_command_id);
end $$;
revoke all on function public.apply_workspace_health_command(uuid,text,text,text) from public;
grant execute on function public.apply_workspace_health_command(uuid,text,text,text) to authenticated;
do $$ begin
 if exists(select 1 from public.owners o left join public.profiles p on p.id=o.profile_id where p.id is null) then raise exception 'Owner without valid profile detected'; end if;
 if exists(select 1 from public.properties p left join public.owners o on o.id=p.owner_id where p.status='active' and o.id is null) then raise exception 'Orphan active property detected'; end if;
 if exists(select 1 from public.workspace_memberships m where m.property_access_mode='selected' and m.status='active' and not exists(select 1 from public.workspace_member_property_access a where a.membership_id=m.id)) then raise exception 'Ambiguous selected-property membership detected'; end if;
end $$;
commit;
