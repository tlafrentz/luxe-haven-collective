-- AUTH-EMAIL-002: allow an authenticated, bound invitee to recover a lost
-- acceptance continuation without granting workspace access.

begin;

create or replace function public.has_pending_workspace_invitation()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.workspace_invitations invitation
    join public.profiles profile on profile.id=auth.uid()
    where invitation.auth_invitation_user_id=auth.uid()
      and invitation.email=lower(profile.email)
      and invitation.status='pending'
      and invitation.expires_at>now()
      and not exists(
        select 1 from public.workspace_memberships membership
        where membership.workspace_id=invitation.workspace_id
          and membership.profile_id=auth.uid()
      )
  )
$$;

create or replace function public.rotate_bound_workspace_invitation_token(
  p_token_hash text,
  p_expires_at timestamptz,
  p_correlation_id uuid,
  p_idempotency_key text
)
returns public.workspace_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_email text;
  fingerprint text;
  receipt public.workspace_access_command_receipts%rowtype;
  invitation public.workspace_invitations%rowtype;
begin
  if actor_id is null then
    raise exception 'BOUND_INVITATION_RESUME_FORBIDDEN' using errcode='42501';
  end if;
  if length(coalesce(p_token_hash,''))<>64
     or length(coalesce(p_idempotency_key,''))<16
     or p_expires_at<=now()
     or p_expires_at>now()+interval '24 hours' then
    raise exception 'BOUND_INVITATION_RESUME_COMMAND_INVALID' using errcode='22023';
  end if;

  select lower(email) into actor_email
  from public.profiles where id=actor_id;
  if actor_email is null then
    raise exception 'BOUND_INVITATION_RESUME_FORBIDDEN' using errcode='42501';
  end if;

  select * into invitation
  from public.workspace_invitations
  where auth_invitation_user_id=actor_id
    and email=actor_email
    and status='pending'
    and expires_at>now()
  order by created_at desc
  limit 1
  for update;
  if not found then
    raise exception 'BOUND_INVITATION_RESUME_NOT_FOUND' using errcode='P0002';
  end if;
  if exists(
    select 1 from public.workspace_memberships
    where workspace_id=invitation.workspace_id and profile_id=actor_id
  ) then
    raise exception 'BOUND_INVITATION_RESUME_MEMBERSHIP_EXISTS' using errcode='23505';
  end if;

  fingerprint := pg_catalog.encode(extensions.digest(
    concat_ws(':',actor_id::text,invitation.id::text,p_correlation_id::text),
    'sha256'
  ),'hex');
  select * into receipt from public.workspace_access_command_receipts
  where workspace_id=invitation.workspace_id and command_id=p_idempotency_key;
  if found then
    if receipt.payload_hash<>fingerprint then
      raise exception 'BOUND_INVITATION_RESUME_REPLAY_MISMATCH' using errcode='22023';
    end if;
    return invitation;
  end if;

  update public.workspace_invitations set
    token_hash=p_token_hash,
    expires_at=p_expires_at,
    updated_at=now()
  where id=invitation.id
  returning * into invitation;

  insert into public.workspace_access_activity(
    workspace_id,actor_profile_id,target_invitation_id,target_label,action,new_summary
  ) values (
    invitation.workspace_id,actor_id,invitation.id,invitation.email,
    'bound-invitation-resumed',
    jsonb_build_object('correlationId',p_correlation_id,'expiresAt',p_expires_at)
  );
  insert into public.workspace_access_command_receipts(
    workspace_id,command_id,payload_hash,result
  ) values (
    invitation.workspace_id,p_idempotency_key,fingerprint,
    jsonb_build_object('id',invitation.id,'correlationId',p_correlation_id)
  );
  return invitation;
end;
$$;

revoke all on function public.rotate_bound_workspace_invitation_token(text,timestamptz,uuid,text) from public;
grant execute on function public.rotate_bound_workspace_invitation_token(text,timestamptz,uuid,text) to authenticated;

commit;
