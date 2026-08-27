create table public.auth_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  recipient_digest text not null check (length(recipient_digest)=64),
  status text not null default 'pending' check (status in ('pending','emailed','failed','expired','consumed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index auth_recovery_requests_expiry_idx on public.auth_recovery_requests(status,expires_at);
alter table public.auth_recovery_requests enable row level security;
revoke all on table public.auth_recovery_requests from public,anon,authenticated;
grant all on table public.auth_recovery_requests to service_role;

alter table public.auth_email_action_states
  add column recovery_request_id uuid references public.auth_recovery_requests(id) on delete cascade,
  add column auth_user_id uuid,
  add column version integer not null default 1 check (version>0),
  add column claim_correlation uuid,
  add column verified_at timestamptz,
  add column grant_issued_at timestamptz,
  add column failure_code text;
alter table public.auth_email_action_states drop constraint auth_email_action_states_status_check;
alter table public.auth_email_action_states add constraint auth_email_action_states_status_check
  check (status in ('pending','claimed','verified','grant_issued','consumed','rejected','expired','verification_failed','cancelled'));
alter table public.auth_email_action_states add constraint auth_email_action_states_recovery_binding
  check (flow<>'recovery' or (recovery_request_id is not null and auth_user_id is not null));
create unique index auth_email_action_states_one_advancing_token_uidx
  on public.auth_email_action_states(token_digest)
  where status in ('claimed','verified','grant_issued','consumed');

alter table public.auth_password_setup_grants
  add column action_state_id uuid references public.auth_email_action_states(id);
create unique index auth_password_setup_grants_action_state_uidx
  on public.auth_password_setup_grants(action_state_id)
  where action_state_id is not null;

create or replace function public.claim_recovery_email_action_state(
  p_state_id uuid,
  p_browser_nonce_digest text,
  p_expected_version integer,
  p_correlation uuid
)
returns table(
  id uuid, auth_user_id uuid, token_ciphertext text, token_iv text,
  token_tag text, token_digest text, redirect_to text, version integer
)
language plpgsql
security definer
set search_path=public
as $$
declare state_record public.auth_email_action_states%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'RECOVERY_ACTION_CLAIM_FORBIDDEN' using errcode='42501'; end if;
  if length(coalesce(p_browser_nonce_digest,''))<>64 or p_expected_version<1 or p_correlation is null then
    raise exception 'RECOVERY_ACTION_CLAIM_INVALID' using errcode='22023';
  end if;
  select * into state_record from public.auth_email_action_states state
  where state.id=p_state_id for update;
  if not found or state_record.flow<>'recovery' or state_record.status<>'pending'
     or state_record.expires_at<=now() or state_record.version<>p_expected_version
     or state_record.browser_nonce_digest<>p_browser_nonce_digest then
    return;
  end if;
  if exists(select 1 from public.auth_email_action_states competing
    where competing.token_digest=state_record.token_digest
      and competing.id<>state_record.id
      and competing.status in ('claimed','verified','grant_issued','consumed')) then
    update public.auth_email_action_states set status='rejected',failure_code='ACTION_STATE_ALREADY_CLAIMED',updated_at=now()
    where public.auth_email_action_states.id=state_record.id;
    return;
  end if;
  update public.auth_email_action_states as claimed_state set status='claimed',claimed_at=now(),
    claim_correlation=p_correlation,version=claimed_state.version+1,updated_at=now()
  where claimed_state.id=state_record.id;
  return query select state_record.id,state_record.auth_user_id,state_record.token_ciphertext,
    state_record.token_iv,state_record.token_tag,state_record.token_digest,state_record.redirect_to,
    state_record.version+1;
end;
$$;

create or replace function public.issue_recovery_password_setup_grant_v2(
  p_action_state_id uuid,
  p_auth_user_id uuid,
  p_grant_hash text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare state_record public.auth_email_action_states%rowtype; actor_email text; grant_id uuid;
begin
  if auth.role()<>'service_role' then raise exception 'RECOVERY_GRANT_ISSUE_FORBIDDEN' using errcode='42501'; end if;
  if length(coalesce(p_grant_hash,''))<>64 or p_expires_at<=now() or p_expires_at>now()+interval '15 minutes' then
    raise exception 'RECOVERY_GRANT_ISSUE_INVALID' using errcode='22023';
  end if;
  select * into state_record from public.auth_email_action_states where id=p_action_state_id for update;
  if not found or state_record.flow<>'recovery' or state_record.status<>'claimed'
     or state_record.expires_at<=now() or state_record.auth_user_id<>p_auth_user_id then
    raise exception 'RECOVERY_GRANT_STATE_INVALID' using errcode='42501';
  end if;
  select lower(trim(email)) into actor_email from public.profiles where id=p_auth_user_id;
  if actor_email is null then raise exception 'RECOVERY_GRANT_IDENTITY_INVALID' using errcode='42501'; end if;
  insert into public.auth_password_setup_grants(
    token_hash,flow,action_state_id,auth_user_id,normalized_email,expires_at
  ) values (p_grant_hash,'recovery',p_action_state_id,p_auth_user_id,actor_email,p_expires_at)
  returning id into grant_id;
  update public.auth_email_action_states set status='verified',verified_at=now(),
    version=version+1,updated_at=now() where id=p_action_state_id;
  update public.auth_email_action_states set status='grant_issued',
    grant_issued_at=now(),version=version+1,updated_at=now() where id=p_action_state_id;
  return grant_id;
end;
$$;

create or replace function public.expire_auth_email_recovery_states()
returns integer
language plpgsql
security definer
set search_path=public
as $$
declare expired_count integer;
begin
  if auth.role()<>'service_role' then raise exception 'RECOVERY_STATE_EXPIRY_FORBIDDEN' using errcode='42501'; end if;
  with expired_states as (
    update public.auth_email_action_states
      set status='expired',failure_code='ACTION_STATE_EXPIRED',version=version+1,updated_at=now()
      where flow='recovery' and status='pending' and expires_at<=now()
      returning recovery_request_id
  ), expired_requests as (
    update public.auth_recovery_requests request
      set status='expired',updated_at=now()
      where request.status in ('pending','emailed')
        and (request.expires_at<=now() or request.id in (select recovery_request_id from expired_states))
      returning 1
  )
  select count(*) into expired_count from expired_states;
  return expired_count;
end;
$$;

create or replace function public.validate_password_setup_grant(
  p_grant_token text,
  p_flow text
)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.auth_password_setup_grants grant_record
    left join public.workspace_invitations invitation on invitation.id=grant_record.invitation_id
    left join public.auth_email_action_states action_state on action_state.id=grant_record.action_state_id
    where grant_record.token_hash=pg_catalog.encode(extensions.digest(p_grant_token,'sha256'),'hex')
      and grant_record.auth_user_id=auth.uid()
      and grant_record.flow=p_flow
      and grant_record.status='active'
      and grant_record.expires_at>now()
      and (
        (p_flow='recovery' and grant_record.action_state_id is not null and action_state.status='grant_issued'
          and action_state.auth_user_id=auth.uid())
        or (p_flow='invitation' and grant_record.invitation_id is not null and invitation.status='pending'
          and invitation.expires_at>now() and invitation.auth_invitation_user_id=auth.uid()
          and invitation.email=grant_record.normalized_email)
      )
  )
$$;

create or replace function public.complete_password_setup_from_auth_user_update()
returns trigger language plpgsql security definer set search_path=public as $$
declare grant_record public.auth_password_setup_grants%rowtype; invitation public.workspace_invitations%rowtype; membership_id uuid;
begin
  if new.encrypted_password is not distinct from old.encrypted_password then return new; end if;
  select * into grant_record from public.auth_password_setup_grants
    where auth_user_id=new.id and status='claimed' for update;
  if not found then return new; end if;
  if grant_record.expires_at<=now() then raise exception 'PASSWORD_SETUP_GRANT_EXPIRED' using errcode='42501'; end if;
  if grant_record.flow='recovery' then
    update public.auth_password_setup_grants set status='consumed',consumed_at=now(),updated_at=now() where id=grant_record.id;
    update public.auth_email_action_states set status='consumed',consumed_at=now(),version=version+1,updated_at=now()
      where id=grant_record.action_state_id and status='grant_issued';
    update public.auth_recovery_requests request set status='consumed',updated_at=now()
      from public.auth_email_action_states state
      where state.id=grant_record.action_state_id and request.id=state.recovery_request_id;
    return new;
  end if;
  select * into invitation from public.workspace_invitations where id=grant_record.invitation_id for update;
  if not found or invitation.status<>'pending' or invitation.expires_at<=now()
     or invitation.auth_invitation_user_id<>new.id or invitation.email<>grant_record.normalized_email
     or exists(select 1 from public.workspace_memberships where workspace_id=invitation.workspace_id and profile_id=new.id) then
    raise exception 'INVITATION_SETUP_COMPLETION_REJECTED' using errcode='42501';
  end if;
  insert into public.workspace_memberships(workspace_id,profile_id,role,status,property_access_mode,invited_by_profile_id,joined_at)
  values(invitation.workspace_id,new.id,invitation.role,'active',invitation.property_access_mode,invitation.invited_by_profile_id,now())
  returning id into membership_id;
  if invitation.property_access_mode='selected' then
    insert into public.workspace_member_property_access(membership_id,property_id) select membership_id,unnest(invitation.property_ids);
  end if;
  update public.workspace_invitations set status='accepted',accepted_at=now(),consumed_by_profile_id=new.id,
    token_hash=md5(random()::text),updated_at=now() where id=invitation.id;
  update public.auth_password_setup_grants set status='consumed',consumed_at=now(),updated_at=now() where id=grant_record.id;
  insert into public.workspace_access_activity(workspace_id,actor_profile_id,target_membership_id,target_invitation_id,target_label,action,new_summary)
  values(invitation.workspace_id,new.id,membership_id,invitation.id,invitation.email,'invitation-accepted',jsonb_build_object('role',invitation.role,'correlationId',invitation.correlation_id));
  insert into public.workspace_access_notifications(workspace_id,recipient_profile_id,notification_type,target_id)
  values(invitation.workspace_id,invitation.invited_by_profile_id,'invitation-accepted',membership_id);
  return new;
end;
$$;

revoke all on function public.claim_recovery_email_action_state(uuid,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.claim_recovery_email_action_state(uuid,text,integer,uuid) to service_role;
revoke all on function public.issue_recovery_password_setup_grant_v2(uuid,uuid,text,timestamptz) from public,anon,authenticated;
grant execute on function public.issue_recovery_password_setup_grant_v2(uuid,uuid,text,timestamptz) to service_role;
revoke all on function public.expire_auth_email_recovery_states() from public,anon,authenticated;
grant execute on function public.expire_auth_email_recovery_states() to service_role;
revoke execute on function public.issue_recovery_password_setup_grant(text,timestamptz) from authenticated;
