-- AUTH-EMAIL-001: bind Supabase Admin invitations to one governed workspace
-- invitation before any authentication email is sent.

begin;

alter table public.workspace_invitations
  drop constraint if exists workspace_invitations_role_check;
alter table public.workspace_invitations
  add constraint workspace_invitations_role_check
  check (role in ('owner','administrator','operator','contributor','viewer'));

alter table public.workspace_invitations
  drop constraint if exists workspace_invitations_status_check;
alter table public.workspace_invitations
  add constraint workspace_invitations_status_check
  check (status in ('pending','accepted','cancelled','revoked','expired'));

alter table public.workspace_invitations
  add column if not exists correlation_id uuid,
  add column if not exists reason text,
  add column if not exists auth_invitation_user_id uuid,
  add column if not exists consumed_by_profile_id uuid references public.profiles(id) on delete set null;

create unique index if not exists workspace_invitations_auth_user_uidx
  on public.workspace_invitations(auth_invitation_user_id)
  where auth_invitation_user_id is not null;

create or replace function public.create_admin_workspace_owner_invitation(
  p_workspace_id uuid,
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_correlation_id uuid,
  p_idempotency_key text,
  p_reason text
)
returns public.workspace_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  normalized_email text := lower(trim(p_email));
  fingerprint text;
  receipt public.workspace_access_command_receipts%rowtype;
  invitation public.workspace_invitations%rowtype;
begin
  if actor_id is null or not public.is_admin() then
    raise exception 'ADMIN_WORKSPACE_INVITATION_FORBIDDEN' using errcode='42501';
  end if;
  if normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'ADMIN_WORKSPACE_INVITATION_EMAIL_INVALID' using errcode='22023';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '7 days' then
    raise exception 'ADMIN_WORKSPACE_INVITATION_EXPIRY_INVALID' using errcode='22023';
  end if;
  if length(trim(coalesce(p_reason,''))) < 8 then
    raise exception 'ADMIN_WORKSPACE_INVITATION_REASON_REQUIRED' using errcode='22023';
  end if;
  if length(coalesce(p_idempotency_key,'')) < 16 or length(coalesce(p_token_hash,'')) <> 64 then
    raise exception 'ADMIN_WORKSPACE_INVITATION_COMMAND_INVALID' using errcode='22023';
  end if;

  perform 1 from public.owners where id=p_workspace_id for update;
  if not found then raise exception 'ADMIN_WORKSPACE_INVITATION_WORKSPACE_NOT_FOUND' using errcode='22023'; end if;

  fingerprint := pg_catalog.encode(extensions.digest(
    concat_ws(':',p_workspace_id::text,normalized_email,p_correlation_id::text,trim(p_reason)),
    'sha256'
  ),'hex');
  select * into receipt from public.workspace_access_command_receipts
  where workspace_id=p_workspace_id and command_id=p_idempotency_key;
  if found then
    if receipt.payload_hash<>fingerprint then
      raise exception 'ADMIN_WORKSPACE_INVITATION_REPLAY_MISMATCH' using errcode='22023';
    end if;
    select * into invitation from public.workspace_invitations
    where id=(receipt.result->>'id')::uuid;
    if not found then raise exception 'ADMIN_WORKSPACE_INVITATION_REPLAY_ORPHANED'; end if;
    return invitation;
  end if;

  if exists(
    select 1 from public.workspace_memberships membership
    join public.profiles profile on profile.id=membership.profile_id
    where membership.workspace_id=p_workspace_id
      and lower(profile.email)=normalized_email
      and membership.status in ('active','suspended')
  ) then raise exception 'ADMIN_WORKSPACE_INVITATION_MEMBERSHIP_EXISTS' using errcode='23505'; end if;

  insert into public.workspace_invitations(
    workspace_id,email,role,status,property_access_mode,property_ids,
    invited_by_profile_id,token_hash,expires_at,correlation_id,reason
  ) values (
    p_workspace_id,normalized_email,'owner','pending','all','{}',
    actor_id,p_token_hash,p_expires_at,p_correlation_id,trim(p_reason)
  ) returning * into invitation;

  insert into public.workspace_access_activity(
    workspace_id,actor_profile_id,target_invitation_id,target_label,action,new_summary
  ) values (
    p_workspace_id,actor_id,invitation.id,normalized_email,'admin-owner-invitation-created',
    jsonb_build_object('role','owner','correlationId',p_correlation_id)
  );
  insert into public.workspace_access_command_receipts(workspace_id,command_id,payload_hash,result)
  values(p_workspace_id,p_idempotency_key,fingerprint,jsonb_build_object('id',invitation.id));
  return invitation;
end;
$$;

create or replace function public.bind_admin_workspace_invitation_auth_user(
  p_invitation_id uuid,
  p_auth_user_id uuid,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare invitation public.workspace_invitations%rowtype;
begin
  if auth.role()<>'service_role' then
    raise exception 'ADMIN_WORKSPACE_INVITATION_BIND_FORBIDDEN' using errcode='42501';
  end if;
  select * into invitation from public.workspace_invitations where id=p_invitation_id for update;
  if not found or invitation.status<>'pending' or invitation.correlation_id<>p_correlation_id then
    raise exception 'ADMIN_WORKSPACE_INVITATION_BIND_MISMATCH' using errcode='22023';
  end if;
  update public.workspace_invitations
  set auth_invitation_user_id=p_auth_user_id,updated_at=now()
  where id=p_invitation_id and auth_invitation_user_id is null;
  if not found and invitation.auth_invitation_user_id<>p_auth_user_id then
    raise exception 'ADMIN_WORKSPACE_INVITATION_AUTH_USER_MISMATCH' using errcode='22023';
  end if;
end;
$$;

create or replace function public.revoke_admin_workspace_invitation_delivery_failure(
  p_invitation_id uuid,
  p_correlation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare invitation public.workspace_invitations%rowtype;
begin
  if auth.role()<>'service_role' then
    raise exception 'ADMIN_WORKSPACE_INVITATION_REVOKE_FORBIDDEN' using errcode='42501';
  end if;
  update public.workspace_invitations set
    status='revoked',token_hash=md5(random()::text),updated_at=now()
  where id=p_invitation_id and correlation_id=p_correlation_id and status='pending'
  returning * into invitation;
  if found then
    insert into public.workspace_access_activity(
      workspace_id,actor_profile_id,target_invitation_id,target_label,action,new_summary
    ) values (
      invitation.workspace_id,invitation.invited_by_profile_id,invitation.id,
      invitation.email,'admin-owner-invitation-delivery-failed',
      jsonb_build_object('correlationId',p_correlation_id)
    );
  end if;
end;
$$;

create or replace function public.has_pending_workspace_invitation()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.workspace_invitations invitation
    join public.profiles profile on profile.id=auth.uid()
    where invitation.email=lower(profile.email)
      and invitation.status='pending'
      and invitation.expires_at>now()
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
  select lower(email) into actor_email from public.profiles where id=actor_id;
  select * into invitation from public.workspace_invitations
  where workspace_id=p_workspace_id
    and token_hash=pg_catalog.encode(extensions.digest(p_token,'sha256'),'hex')
  for update;
  if not found then raise exception 'Invitation token is invalid' using errcode='42501'; end if;
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
  update public.workspace_invitations set
    status='accepted',accepted_at=now(),consumed_by_profile_id=actor_id,
    token_hash=md5(random()::text),updated_at=now()
  where id=invitation.id;
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

revoke all on function public.create_admin_workspace_owner_invitation(uuid,text,text,timestamptz,uuid,text,text) from public;
revoke all on function public.bind_admin_workspace_invitation_auth_user(uuid,uuid,uuid) from public;
revoke all on function public.revoke_admin_workspace_invitation_delivery_failure(uuid,uuid) from public;
revoke all on function public.has_pending_workspace_invitation() from public;
grant execute on function public.create_admin_workspace_owner_invitation(uuid,text,text,timestamptz,uuid,text,text) to authenticated;
grant execute on function public.bind_admin_workspace_invitation_auth_user(uuid,uuid,uuid) to service_role;
grant execute on function public.revoke_admin_workspace_invitation_delivery_failure(uuid,uuid) to service_role;
grant execute on function public.has_pending_workspace_invitation() to authenticated;

commit;
