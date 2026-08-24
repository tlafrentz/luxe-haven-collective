-- Keep the invitation acceptance security boundary unchanged while resolving
-- pgcrypto from its canonical extensions schema.
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
  where workspace_id=p_workspace_id and token_hash=pg_catalog.encode(extensions.digest(p_token,'sha256'),'hex')
  for update;
  if not found then raise exception 'Invitation token is invalid' using errcode='42501'; end if;
  if invitation.status<>'pending' then raise exception 'Invitation is no longer pending' using errcode='22023'; end if;
  if invitation.expires_at<=now() then
    update public.workspace_invitations set status='expired',token_hash=md5(random()::text),updated_at=now() where id=invitation.id;
    raise exception 'Invitation has expired' using errcode='22023';
  end if;
  if actor_email<>invitation.email then raise exception 'Invitation email does not match authenticated profile' using errcode='42501'; end if;
  insert into public.workspace_memberships(workspace_id,profile_id,role,status,property_access_mode,invited_by_profile_id,joined_at)
  values(p_workspace_id,actor_id,invitation.role,'active',invitation.property_access_mode,invitation.invited_by_profile_id,now())
  on conflict(workspace_id,profile_id) do update set
    role=excluded.role,status='active',property_access_mode=excluded.property_access_mode,
    invited_by_profile_id=excluded.invited_by_profile_id,joined_at=now(),updated_at=now()
  returning id into resolved_membership_id;
  delete from public.workspace_member_property_access access where access.membership_id=resolved_membership_id;
  if invitation.property_access_mode='selected' then
    insert into public.workspace_member_property_access(membership_id,property_id)
    select resolved_membership_id,unnest(invitation.property_ids);
  end if;
  update public.workspace_invitations set status='accepted',accepted_at=now(),token_hash=md5(random()::text),updated_at=now() where id=invitation.id;
  insert into public.workspace_access_activity(workspace_id,actor_profile_id,target_membership_id,target_invitation_id,target_label,action,new_summary)
  values(p_workspace_id,actor_id,resolved_membership_id,invitation.id,invitation.email,'invitation-accepted',jsonb_build_object('role',invitation.role));
  insert into public.workspace_access_notifications(workspace_id,recipient_profile_id,notification_type,target_id)
  values(p_workspace_id,invitation.invited_by_profile_id,'invitation-accepted',resolved_membership_id);
  return resolved_membership_id;
end;
$$;

revoke all on function public.accept_workspace_invitation(uuid,text,text) from public;
grant execute on function public.accept_workspace_invitation(uuid,text,text) to authenticated;
