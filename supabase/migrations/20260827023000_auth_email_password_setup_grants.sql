-- AUTH-EMAIL-001: server-bound, single-use password setup grants.

begin;

create table public.auth_password_setup_grants (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check(length(token_hash)=64),
  flow text not null check(flow in ('invitation','recovery')),
  invitation_id uuid references public.workspace_invitations(id) on delete cascade,
  auth_user_id uuid not null,
  normalized_email text not null check(normalized_email=lower(trim(normalized_email))),
  status text not null default 'active' check(status in ('active','claimed','consumed','failed','revoked','expired')),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_password_setup_grants_flow_binding check(
    (flow='invitation' and invitation_id is not null)
    or (flow='recovery' and invitation_id is null)
  )
);

create unique index auth_password_setup_grants_invitation_uidx
  on public.auth_password_setup_grants(invitation_id)
  where invitation_id is not null;
create unique index auth_password_setup_grants_active_actor_uidx
  on public.auth_password_setup_grants(auth_user_id)
  where status in ('active','claimed');
create index auth_password_setup_grants_actor_status_idx
  on public.auth_password_setup_grants(auth_user_id,status,expires_at);
alter table public.auth_password_setup_grants enable row level security;

create or replace function public.invalidate_invitation_password_setup_grants()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.status<>'pending'
     or new.auth_invitation_user_id is distinct from old.auth_invitation_user_id
     or new.email is distinct from old.email then
    update public.auth_password_setup_grants set status='revoked',updated_at=now()
    where invitation_id=new.id and status in ('active','claimed');
  end if;
  return new;
end;
$$;
create trigger invalidate_invitation_password_setup_grants_trigger
after update on public.workspace_invitations
for each row execute function public.invalidate_invitation_password_setup_grants();

create or replace function public.issue_invitation_password_setup_grant(
  p_workspace_id uuid,
  p_invitation_token text,
  p_grant_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  actor_id uuid:=auth.uid();
  actor_email text;
  invitation public.workspace_invitations%rowtype;
  grant_id uuid;
begin
  if actor_id is null then raise exception 'INVITATION_SETUP_GRANT_FORBIDDEN' using errcode='42501'; end if;
  if length(coalesce(p_grant_hash,''))<>64
     or p_expires_at<=now() or p_expires_at>now()+interval '15 minutes' then
    raise exception 'INVITATION_SETUP_GRANT_INVALID' using errcode='22023';
  end if;
  select lower(trim(email)) into actor_email from public.profiles where id=actor_id;
  select * into invitation from public.workspace_invitations
  where workspace_id=p_workspace_id
    and token_hash=pg_catalog.encode(extensions.digest(p_invitation_token,'sha256'),'hex')
  for update;
  if not found
     or invitation.status<>'pending'
     or invitation.expires_at<=now()
     or invitation.auth_invitation_user_id is null
     or invitation.auth_invitation_user_id<>actor_id
     or invitation.email<>actor_email
     or exists(select 1 from public.workspace_memberships where workspace_id=invitation.workspace_id and profile_id=actor_id) then
    raise exception 'INVITATION_SETUP_GRANT_NOT_AVAILABLE' using errcode='42501';
  end if;
  if exists(select 1 from public.auth_password_setup_grants where invitation_id=invitation.id) then
    raise exception 'INVITATION_SETUP_GRANT_ALREADY_ISSUED' using errcode='23505';
  end if;
  insert into public.auth_password_setup_grants(
    token_hash,flow,invitation_id,auth_user_id,normalized_email,expires_at
  ) values (p_grant_hash,'invitation',invitation.id,actor_id,actor_email,p_expires_at)
  returning id into grant_id;
  return grant_id;
end;
$$;

create or replace function public.issue_recovery_password_setup_grant(
  p_grant_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  actor_id uuid:=auth.uid();
  actor_email text;
  recovery_sent_at timestamptz;
  grant_id uuid;
begin
  if actor_id is null then raise exception 'RECOVERY_SETUP_GRANT_FORBIDDEN' using errcode='42501'; end if;
  if length(coalesce(p_grant_hash,''))<>64
     or p_expires_at<=now() or p_expires_at>now()+interval '15 minutes' then
    raise exception 'RECOVERY_SETUP_GRANT_INVALID' using errcode='22023';
  end if;
  select lower(trim(profile.email)), auth_user.recovery_sent_at
  into actor_email,recovery_sent_at
  from public.profiles profile
  join auth.users auth_user on auth_user.id=profile.id
  where profile.id=actor_id;
  if actor_email is null or recovery_sent_at is null or recovery_sent_at<now()-interval '15 minutes' then
    raise exception 'RECOVERY_SETUP_GRANT_NOT_AVAILABLE' using errcode='42501';
  end if;
  if exists(select 1 from public.auth_password_setup_grants
    where auth_user_id=actor_id and flow='recovery' and created_at>=recovery_sent_at) then
    raise exception 'RECOVERY_SETUP_GRANT_ALREADY_ISSUED' using errcode='23505';
  end if;
  insert into public.auth_password_setup_grants(
    token_hash,flow,auth_user_id,normalized_email,expires_at
  ) values (p_grant_hash,'recovery',actor_id,actor_email,p_expires_at)
  returning id into grant_id;
  return grant_id;
end;
$$;

create or replace function public.validate_password_setup_grant(
  p_grant_token text,
  p_flow text
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.auth_password_setup_grants grant_record
    left join public.workspace_invitations invitation on invitation.id=grant_record.invitation_id
    where grant_record.token_hash=pg_catalog.encode(extensions.digest(p_grant_token,'sha256'),'hex')
      and grant_record.auth_user_id=auth.uid()
      and grant_record.flow=p_flow
      and grant_record.status='active'
      and grant_record.expires_at>now()
      and (
        p_flow='recovery'
        or (
          invitation.status='pending'
          and invitation.expires_at>now()
          and invitation.auth_invitation_user_id=auth.uid()
          and invitation.email=grant_record.normalized_email
          and not exists(select 1 from public.workspace_memberships membership
            where membership.workspace_id=invitation.workspace_id and membership.profile_id=auth.uid())
        )
      )
  )
$$;

create or replace function public.claim_password_setup_grant(
  p_grant_token text,
  p_flow text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare grant_record public.auth_password_setup_grants%rowtype;
begin
  select * into grant_record from public.auth_password_setup_grants
  where token_hash=pg_catalog.encode(extensions.digest(p_grant_token,'sha256'),'hex')
  for update;
  if not found or grant_record.auth_user_id<>auth.uid() or grant_record.flow<>p_flow
     or grant_record.status<>'active' or grant_record.expires_at<=now()
     or not public.validate_password_setup_grant(p_grant_token,p_flow) then
    raise exception 'PASSWORD_SETUP_GRANT_NOT_AVAILABLE' using errcode='42501';
  end if;
  update public.auth_password_setup_grants set status='claimed',claimed_at=now(),updated_at=now()
  where id=grant_record.id;
  return grant_record.id;
end;
$$;

create or replace function public.fail_claimed_password_setup_grant(
  p_grant_id uuid,
  p_grant_token text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.auth_password_setup_grants set status='failed',updated_at=now()
  where id=p_grant_id and auth_user_id=auth.uid() and status='claimed'
    and token_hash=pg_catalog.encode(extensions.digest(p_grant_token,'sha256'),'hex');
end;
$$;

create or replace function public.complete_password_setup_from_auth_user_update()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  grant_record public.auth_password_setup_grants%rowtype;
  invitation public.workspace_invitations%rowtype;
  membership_id uuid;
begin
  if new.encrypted_password is not distinct from old.encrypted_password then
    return new;
  end if;
  select * into grant_record from public.auth_password_setup_grants
  where auth_user_id=new.id and status='claimed'
  for update;
  if not found then return new; end if;
  if grant_record.expires_at<=now() then
    raise exception 'PASSWORD_SETUP_GRANT_EXPIRED' using errcode='42501';
  end if;
  if grant_record.flow='recovery' then
    update public.auth_password_setup_grants
      set status='consumed',consumed_at=now(),updated_at=now()
      where id=grant_record.id;
    return new;
  end if;
  select * into invitation from public.workspace_invitations
  where id=grant_record.invitation_id for update;
  if not found or invitation.status<>'pending' or invitation.expires_at<=now()
     or invitation.auth_invitation_user_id<>new.id
     or invitation.email<>grant_record.normalized_email
     or exists(select 1 from public.workspace_memberships where workspace_id=invitation.workspace_id and profile_id=new.id) then
    raise exception 'INVITATION_SETUP_COMPLETION_REJECTED' using errcode='42501';
  end if;
  insert into public.workspace_memberships(
    workspace_id,profile_id,role,status,property_access_mode,invited_by_profile_id,joined_at
  ) values (
    invitation.workspace_id,new.id,invitation.role,'active',invitation.property_access_mode,
    invitation.invited_by_profile_id,now()
  ) returning id into membership_id;
  if invitation.property_access_mode='selected' then
    insert into public.workspace_member_property_access(membership_id,property_id)
    select membership_id,unnest(invitation.property_ids);
  end if;
  update public.workspace_invitations set status='accepted',accepted_at=now(),
    consumed_by_profile_id=new.id,token_hash=md5(random()::text),updated_at=now()
  where id=invitation.id;
  update public.auth_password_setup_grants set status='consumed',consumed_at=now(),updated_at=now()
  where id=grant_record.id;
  insert into public.workspace_access_activity(
    workspace_id,actor_profile_id,target_membership_id,target_invitation_id,target_label,action,new_summary
  ) values (
    invitation.workspace_id,new.id,membership_id,invitation.id,invitation.email,
    'invitation-accepted',jsonb_build_object('role',invitation.role,'correlationId',invitation.correlation_id)
  );
  insert into public.workspace_access_notifications(workspace_id,recipient_profile_id,notification_type,target_id)
  values(invitation.workspace_id,invitation.invited_by_profile_id,'invitation-accepted',membership_id);
  return new;
end;
$$;

create trigger complete_password_setup_from_auth_user_update_trigger
after update of encrypted_password on auth.users
for each row execute function public.complete_password_setup_from_auth_user_update();

create or replace function public.password_setup_grant_completed(
  p_grant_id uuid,
  p_grant_token text,
  p_flow text
)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1 from public.auth_password_setup_grants
    where id=p_grant_id
      and token_hash=pg_catalog.encode(extensions.digest(p_grant_token,'sha256'),'hex')
      and auth_user_id=auth.uid()
      and flow=p_flow
      and status='consumed'
  )
$$;

create or replace function public.accept_workspace_invitation(
  p_workspace_id uuid, p_token text, p_command_id text
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  invitation public.workspace_invitations%rowtype;
  resolved_membership_id uuid;
begin
  if actor_id is null then raise exception 'Authentication is required' using errcode='42501'; end if;
  select lower(trim(email)) into actor_email from public.profiles where id=actor_id;
  select * into invitation from public.workspace_invitations
  where workspace_id=p_workspace_id
    and token_hash=pg_catalog.encode(extensions.digest(p_token,'sha256'),'hex')
  for update;
  if not found then raise exception 'Invitation token is invalid' using errcode='42501'; end if;
  if invitation.correlation_id is not null then
    raise exception 'PASSWORD_SETUP_GRANT_REQUIRED' using errcode='42501';
  end if;
  if invitation.status<>'pending' then raise exception 'Invitation is no longer pending' using errcode='22023'; end if;
  if invitation.expires_at<=now() then
    update public.workspace_invitations set status='expired',token_hash=md5(random()::text),updated_at=now() where id=invitation.id;
    raise exception 'Invitation has expired' using errcode='22023';
  end if;
  if actor_email<>invitation.email then raise exception 'Invitation email does not match authenticated profile' using errcode='42501'; end if;
  if invitation.auth_invitation_user_id is not null and invitation.auth_invitation_user_id<>actor_id then
    raise exception 'Invitation identity does not match authenticated user' using errcode='42501';
  end if;
  if invitation.correlation_id is not null and invitation.auth_invitation_user_id is null then
    raise exception 'Invitation authentication binding is incomplete' using errcode='22023';
  end if;
  if exists(select 1 from public.workspace_memberships where workspace_id=p_workspace_id and profile_id=actor_id) then
    raise exception 'Workspace membership already exists' using errcode='23505';
  end if;
  insert into public.workspace_memberships(
    workspace_id,profile_id,role,status,property_access_mode,invited_by_profile_id,joined_at
  ) values (
    p_workspace_id,actor_id,invitation.role,'active',invitation.property_access_mode,
    invitation.invited_by_profile_id,now()
  ) returning id into resolved_membership_id;
  if invitation.property_access_mode='selected' then
    insert into public.workspace_member_property_access(membership_id,property_id)
    select resolved_membership_id,unnest(invitation.property_ids);
  end if;
  update public.workspace_invitations set status='accepted',accepted_at=now(),consumed_by_profile_id=actor_id,
    token_hash=md5(random()::text),updated_at=now() where id=invitation.id;
  insert into public.workspace_access_activity(
    workspace_id,actor_profile_id,target_membership_id,target_invitation_id,target_label,action,new_summary
  ) values (
    p_workspace_id,actor_id,resolved_membership_id,invitation.id,invitation.email,
    'invitation-accepted',jsonb_build_object('role',invitation.role,'correlationId',invitation.correlation_id)
  );
  insert into public.workspace_access_notifications(workspace_id,recipient_profile_id,notification_type,target_id)
  values(p_workspace_id,invitation.invited_by_profile_id,'invitation-accepted',resolved_membership_id);
  return resolved_membership_id;
end;
$$;

revoke all on table public.auth_password_setup_grants from public,anon,authenticated;
grant all on table public.auth_password_setup_grants to service_role;
revoke all on function public.issue_invitation_password_setup_grant(uuid,text,text,timestamptz) from public,anon;
revoke all on function public.issue_recovery_password_setup_grant(text,timestamptz) from public,anon;
revoke all on function public.validate_password_setup_grant(text,text) from public,anon;
revoke all on function public.claim_password_setup_grant(text,text) from public,anon;
revoke all on function public.fail_claimed_password_setup_grant(uuid,text) from public,anon;
revoke all on function public.password_setup_grant_completed(uuid,text,text) from public,anon;
grant execute on function public.issue_invitation_password_setup_grant(uuid,text,text,timestamptz) to authenticated;
grant execute on function public.issue_recovery_password_setup_grant(text,timestamptz) to authenticated;
grant execute on function public.validate_password_setup_grant(text,text) to authenticated;
grant execute on function public.claim_password_setup_grant(text,text) to authenticated;
grant execute on function public.fail_claimed_password_setup_grant(uuid,text) to authenticated;
grant execute on function public.password_setup_grant_completed(uuid,text,text) to authenticated;
revoke all on function public.invalidate_invitation_password_setup_grants() from public,anon,authenticated;
revoke all on function public.complete_password_setup_from_auth_user_update() from public,anon,authenticated;

commit;
