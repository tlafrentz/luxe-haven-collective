-- Sprint 4C: workspace-scoped membership and property authorization.

begin;
create extension if not exists pgcrypto;

create table if not exists public.workspace_memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner','administrator','operator','contributor','viewer')),
  status text not null default 'active' check (status in ('invited','active','suspended','removed','expired')),
  property_access_mode text not null default 'none' check (property_access_mode in ('all','selected','none')),
  invited_by_profile_id uuid references public.profiles(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, profile_id),
  constraint workspace_memberships_owner_all_properties check (
    role <> 'owner' or property_access_mode = 'all'
  )
);

create index if not exists workspace_memberships_workspace_status_idx
on public.workspace_memberships (workspace_id, status, role);
create index if not exists workspace_memberships_profile_status_idx
on public.workspace_memberships (profile_id, status);

create table if not exists public.workspace_member_property_access (
  membership_id uuid not null references public.workspace_memberships(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (membership_id, property_id)
);
create index if not exists workspace_member_property_access_property_idx
on public.workspace_member_property_access (property_id, membership_id);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  email text not null,
  role text not null check (role in ('administrator','operator','contributor','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','cancelled','expired')),
  property_access_mode text not null check (property_access_mode in ('all','selected','none')),
  property_ids uuid[] not null default '{}'::uuid[],
  invited_by_profile_id uuid not null references public.profiles(id) on delete restrict,
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_invitations_email_normalized check (email = lower(trim(email))),
  constraint workspace_invitations_selected_nonempty check (
    property_access_mode <> 'selected' or cardinality(property_ids) > 0
  )
);
create unique index if not exists workspace_invitations_one_pending_email_idx
on public.workspace_invitations (workspace_id, email) where status = 'pending';
create index if not exists workspace_invitations_workspace_status_idx
on public.workspace_invitations (workspace_id, status, created_at desc);
create index if not exists workspace_invitations_expiry_idx
on public.workspace_invitations (expires_at) where status = 'pending';

create table if not exists public.workspace_access_activity (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  target_membership_id uuid references public.workspace_memberships(id) on delete set null,
  target_invitation_id uuid references public.workspace_invitations(id) on delete set null,
  target_label text not null,
  action text not null,
  previous_summary jsonb,
  new_summary jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists workspace_access_activity_workspace_idx
on public.workspace_access_activity (workspace_id, occurred_at desc);

create table if not exists public.workspace_access_notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  recipient_profile_id uuid references public.profiles(id) on delete cascade,
  recipient_email text,
  notification_type text not null,
  target_id uuid,
  delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table if not exists public.workspace_access_command_receipts (
  workspace_id uuid not null references public.owners(id) on delete cascade,
  command_id text not null,
  payload_hash text not null,
  result jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now(),
  primary key (workspace_id, command_id)
);

-- Existing owners become the first explicit active memberships. Invalid owner
-- profile references are not invented and remain visible through integrity checks.
insert into public.workspace_memberships (
  workspace_id, profile_id, role, status, property_access_mode, joined_at
)
select o.id, o.profile_id, 'owner', 'active', 'all', now()
from public.owners o
join public.profiles p on p.id = o.profile_id
where o.profile_id is not null
on conflict (workspace_id, profile_id) do update
set
  role = case when workspace_memberships.role = 'owner' then 'owner' else workspace_memberships.role end,
  property_access_mode = case when workspace_memberships.role = 'owner' then 'all' else workspace_memberships.property_access_mode end;

create or replace function public.active_workspace_role(p_workspace_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select membership.role
  from public.workspace_memberships membership
  where membership.workspace_id = p_workspace_id
    and membership.profile_id = auth.uid()
    and membership.status = 'active'
  limit 1
$$;

create or replace function public.can_access_workspace_property(p_property_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.properties property
    join public.workspace_memberships membership
      on membership.workspace_id = property.owner_id
     and membership.profile_id = auth.uid()
     and membership.status = 'active'
    where property.id = p_property_id
      and (
        membership.role in ('owner','administrator')
        or membership.property_access_mode = 'all'
        or (
          membership.property_access_mode = 'selected'
          and exists (
            select 1 from public.workspace_member_property_access access
            where access.membership_id = membership.id
              and access.property_id = property.id
          )
        )
      )
  )
$$;

create or replace function public.workspace_property_ids(p_workspace_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select property.id
  from public.properties property
  join public.workspace_memberships membership
    on membership.workspace_id = property.owner_id
   and membership.profile_id = auth.uid()
   and membership.status = 'active'
  where property.owner_id = p_workspace_id
    and (
      membership.role in ('owner','administrator')
      or membership.property_access_mode = 'all'
      or (
        membership.property_access_mode = 'selected'
        and exists (
          select 1 from public.workspace_member_property_access access
          where access.membership_id = membership.id
            and access.property_id = property.id
        )
      )
    )
$$;

create or replace function public.can_update_workspace_organization(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.active_workspace_role(p_workspace_id) in ('owner','administrator')
     or public.is_admin()
$$;

alter table public.workspace_memberships enable row level security;
alter table public.workspace_member_property_access enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.workspace_access_activity enable row level security;
alter table public.workspace_access_notifications enable row level security;
alter table public.workspace_access_command_receipts enable row level security;

create policy "Members read authorized workspace memberships"
on public.workspace_memberships for select to authenticated using (
  profile_id = auth.uid()
  or public.active_workspace_role(workspace_id) in ('owner','administrator')
);
create policy "Managers read workspace invitations"
on public.workspace_invitations for select to authenticated using (
  public.active_workspace_role(workspace_id) in ('owner','administrator')
);
create policy "Members read permitted property assignments"
on public.workspace_member_property_access for select to authenticated using (
  exists (
    select 1 from public.workspace_memberships membership
    where membership.id = membership_id
      and (
        membership.profile_id = auth.uid()
        or public.active_workspace_role(membership.workspace_id) in ('owner','administrator')
      )
  )
);
create policy "Managers read workspace access activity"
on public.workspace_access_activity for select to authenticated using (
  public.active_workspace_role(workspace_id) in ('owner','administrator')
);

grant select on public.workspace_memberships, public.workspace_member_property_access,
  public.workspace_invitations, public.workspace_access_activity to authenticated;

drop policy if exists "Workspace members read own owner" on public.owners;
create policy "Workspace members read organization owner"
on public.owners for select to authenticated using (
  public.active_workspace_role(id) is not null or profile_id=auth.uid() or public.is_admin()
);
drop policy if exists "Workspace members read organization activity"
on public.organization_activity;
create policy "Workspace administrators read organization activity"
on public.organization_activity for select to authenticated using (
  public.active_workspace_role(workspace_id) in ('owner','administrator')
  or public.is_admin()
);

drop policy if exists "Owners can read their properties" on public.properties;
create policy "Workspace members read authorized properties"
on public.properties for select to authenticated
using (public.can_access_workspace_property(id) or public.is_admin());

drop policy if exists "Owners can read property bookings" on public.bookings;
create policy "Workspace members read authorized bookings"
on public.bookings for select to authenticated
using (public.can_access_workspace_property(property_id) or public.is_admin());

drop policy if exists "Owners can view own property media" on public.property_media;
create policy "Workspace members read authorized property media"
on public.property_media for select to authenticated
using (public.can_access_workspace_property(property_id) or public.is_admin());

drop policy if exists "Owners can read property maintenance" on public.maintenance_requests;
create policy "Workspace members read authorized maintenance"
on public.maintenance_requests for select to authenticated
using (public.can_access_workspace_property(property_id) or public.is_admin());

create or replace function public.apply_workspace_access_command(
  p_workspace_id uuid,
  p_action text,
  p_target_id uuid,
  p_payload jsonb,
  p_command_id text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  receipt public.workspace_access_command_receipts%rowtype;
  fingerprint text := md5(p_action || ':' || coalesce(p_target_id::text, '') || ':' || p_payload::text);
  target_membership public.workspace_memberships%rowtype;
  invitation public.workspace_invitations%rowtype;
  result jsonb := '{}'::jsonb;
  next_role text;
  next_mode text;
  next_status text;
  owner_count integer;
begin
  actor_role := public.active_workspace_role(p_workspace_id);
  if actor_id is null or actor_role not in ('owner','administrator') then
    raise exception 'Workspace access management is not permitted' using errcode = '42501';
  end if;

  select * into receipt from public.workspace_access_command_receipts
  where workspace_id = p_workspace_id and command_id = p_command_id;
  if found then
    if receipt.payload_hash <> fingerprint then
      raise exception 'Access command reused with different input' using errcode = '22023';
    end if;
    return receipt.result;
  end if;

  if p_action = 'invite' then
    next_role := p_payload->>'role';
    next_mode := p_payload->>'propertyAccessMode';
    if next_role = 'owner' or next_role not in ('administrator','operator','contributor','viewer') then
      raise exception 'Owner invitations require a reserved ownership workflow' using errcode = '42501';
    end if;
    if actor_role = 'administrator' and next_role = 'owner' then
      raise exception 'Administrators cannot grant Owner access' using errcode = '42501';
    end if;
    if next_role='administrator' then next_mode := 'all'; end if;
    if next_mode='selected' and jsonb_array_length(coalesce(p_payload->'propertyIds','[]'::jsonb))=0 then
      raise exception 'Selected access requires a property' using errcode = '23514';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(coalesce(p_payload->'propertyIds','[]'::jsonb)) requested(value)
      where not exists (
        select 1 from public.properties property
        where property.id=requested.value::uuid and property.owner_id=p_workspace_id
      )
    ) then
      raise exception 'Invitation contains a property outside this workspace' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.workspace_memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      where membership.workspace_id = p_workspace_id
        and lower(profile.email) = lower(p_payload->>'email')
        and membership.status in ('active','suspended')
    ) then
      raise exception 'This person already has workspace access' using errcode = '23505';
    end if;
    insert into public.workspace_invitations (
      workspace_id, email, role, status, property_access_mode, property_ids,
      invited_by_profile_id, token_hash, expires_at
    ) values (
      p_workspace_id, lower(trim(p_payload->>'email')), next_role, 'pending',
      next_mode, coalesce(
        array(
          select value::uuid
          from jsonb_array_elements_text(coalesce(p_payload->'propertyIds','[]'::jsonb)) requested(value)
        ),
        '{}'::uuid[]
      ),
      actor_id, p_payload->>'tokenHash', (p_payload->>'expiresAt')::timestamptz
    ) returning * into invitation;
    insert into public.workspace_access_activity (
      workspace_id, actor_profile_id, target_invitation_id, target_label, action, new_summary
    ) values (
      p_workspace_id, actor_id, invitation.id, invitation.email, 'member-invited',
      jsonb_build_object('role', invitation.role, 'propertyAccessMode', invitation.property_access_mode)
    );
    insert into public.workspace_access_notifications (
      workspace_id, recipient_email, notification_type, target_id
    ) values (p_workspace_id, invitation.email, 'invitation-sent', invitation.id);
    result := to_jsonb(invitation);

  elsif p_action = 'resend-invitation' then
    update public.workspace_invitations set
      token_hash = p_payload->>'tokenHash',
      expires_at = (p_payload->>'expiresAt')::timestamptz,
      updated_at = now()
    where id = p_target_id and workspace_id = p_workspace_id and status = 'pending'
    returning * into invitation;
    if not found then raise exception 'Pending invitation was not found' using errcode = '22023'; end if;
    insert into public.workspace_access_activity (
      workspace_id, actor_profile_id, target_invitation_id, target_label, action
    ) values (p_workspace_id, actor_id, invitation.id, invitation.email, 'invitation-resent');
    insert into public.workspace_access_notifications (
      workspace_id, recipient_email, notification_type, target_id
    ) values (p_workspace_id, invitation.email, 'invitation-sent', invitation.id);
    result := to_jsonb(invitation);

  elsif p_action = 'cancel-invitation' then
    update public.workspace_invitations set status='cancelled', cancelled_at=now(), token_hash=md5(random()::text), updated_at=now()
    where id=p_target_id and workspace_id=p_workspace_id and status='pending'
    returning * into invitation;
    if not found then raise exception 'Pending invitation was not found' using errcode = '22023'; end if;
    insert into public.workspace_access_activity (workspace_id,actor_profile_id,target_invitation_id,target_label,action)
    values (p_workspace_id,actor_id,invitation.id,invitation.email,'invitation-cancelled');
    result := jsonb_build_object('id', invitation.id);

  else
    select * into target_membership from public.workspace_memberships
    where id=p_target_id and workspace_id=p_workspace_id for update;
    if not found then raise exception 'Workspace member was not found' using errcode = '42501'; end if;
    if target_membership.profile_id = actor_id and p_action in ('change-role','change-access','suspend','remove') then
      raise exception 'Members cannot expand or remove their own access' using errcode = '42501';
    end if;
    select count(*) into owner_count from public.workspace_memberships
    where workspace_id=p_workspace_id and role='owner' and status='active';

    if p_action = 'change-role' then
      next_role := p_payload->>'role';
      if next_role='owner' and target_membership.role<>'owner' then
        raise exception 'Granting Owner requires the reserved ownership workflow' using errcode = '42501';
      end if;
      if actor_role='administrator' and (target_membership.role='owner' or next_role='owner') then
        raise exception 'Administrators cannot manage Owner access' using errcode = '42501';
      end if;
      if target_membership.role='owner' and next_role<>'owner' and owner_count<=1 then
        raise exception 'The final active Owner cannot be demoted' using errcode = '23514';
      end if;
      update public.workspace_memberships set role=next_role,
        property_access_mode=case when next_role in ('owner','administrator') then 'all' else property_access_mode end,
        updated_at=now() where id=p_target_id;
      if next_role in ('owner','administrator') then delete from public.workspace_member_property_access where membership_id=p_target_id; end if;
      insert into public.workspace_access_activity (workspace_id,actor_profile_id,target_membership_id,target_label,action,previous_summary,new_summary)
      values (p_workspace_id,actor_id,p_target_id,target_membership.profile_id::text,'role-changed',jsonb_build_object('role',target_membership.role),jsonb_build_object('role',next_role));

    elsif p_action = 'change-access' then
      if target_membership.role in ('owner','administrator') then next_mode := 'all'; else next_mode := p_payload->>'propertyAccessMode'; end if;
      if next_mode='selected' and jsonb_array_length(coalesce(p_payload->'propertyIds','[]'::jsonb))=0 then
        raise exception 'Selected access requires a property' using errcode = '23514';
      end if;
      if exists (
        select 1 from jsonb_array_elements_text(coalesce(p_payload->'propertyIds','[]'::jsonb)) requested(value)
        where not exists (
          select 1 from public.properties property
          where property.id=requested.value::uuid and property.owner_id=p_workspace_id
        )
      ) then
        raise exception 'Property access contains a property outside this workspace' using errcode = '42501';
      end if;
      update public.workspace_memberships set property_access_mode=next_mode,updated_at=now() where id=p_target_id;
      delete from public.workspace_member_property_access where membership_id=p_target_id;
      if next_mode='selected' then
        insert into public.workspace_member_property_access(membership_id,property_id)
        select p_target_id, value::uuid from jsonb_array_elements_text(p_payload->'propertyIds')
        where exists (select 1 from public.properties property where property.id=value::uuid and property.owner_id=p_workspace_id);
      end if;
      insert into public.workspace_access_activity (workspace_id,actor_profile_id,target_membership_id,target_label,action,previous_summary,new_summary)
      values (p_workspace_id,actor_id,p_target_id,target_membership.profile_id::text,'property-access-changed',jsonb_build_object('mode',target_membership.property_access_mode),jsonb_build_object('mode',next_mode));

    elsif p_action in ('suspend','restore','remove') then
      next_status := case p_action when 'suspend' then 'suspended' when 'restore' then 'active' else 'removed' end;
      if target_membership.role='owner' and target_membership.status='active' and next_status<>'active' and owner_count<=1 then
        raise exception 'The final active Owner cannot be suspended or removed' using errcode = '23514';
      end if;
      if actor_role='administrator' and target_membership.role='owner' then
        raise exception 'Administrators cannot manage Owner access' using errcode = '42501';
      end if;
      update public.workspace_memberships set status=next_status,updated_at=now() where id=p_target_id;
      insert into public.workspace_access_activity (workspace_id,actor_profile_id,target_membership_id,target_label,action,previous_summary,new_summary)
      values (p_workspace_id,actor_id,p_target_id,target_membership.profile_id::text,
        case p_action when 'suspend' then 'member-suspended' when 'restore' then 'member-restored' else 'member-removed' end,
        jsonb_build_object('status',target_membership.status),jsonb_build_object('status',next_status));
      insert into public.workspace_access_notifications(workspace_id,recipient_profile_id,notification_type,target_id)
      values(p_workspace_id,target_membership.profile_id,
        case p_action when 'suspend' then 'member-suspended' when 'restore' then 'member-restored' else 'member-removed' end,
        p_target_id);
    else raise exception 'Unsupported workspace access command' using errcode = '22023';
    end if;
    result := jsonb_build_object('membershipId', p_target_id);
  end if;

  insert into public.workspace_access_command_receipts(workspace_id,command_id,payload_hash,result)
  values(p_workspace_id,p_command_id,fingerprint,result);
  return result;
end;
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
  where workspace_id=p_workspace_id and token_hash=encode(digest(p_token,'sha256'),'hex')
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
  delete from public.workspace_member_property_access access
  where access.membership_id=resolved_membership_id;
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

revoke all on function public.apply_workspace_access_command(uuid,text,uuid,jsonb,text) from public;
revoke all on function public.accept_workspace_invitation(uuid,text,text) from public;
grant execute on function public.apply_workspace_access_command(uuid,text,uuid,jsonb,text) to authenticated;
grant execute on function public.accept_workspace_invitation(uuid,text,text) to authenticated;
grant execute on function public.active_workspace_role(uuid), public.can_access_workspace_property(uuid), public.workspace_property_ids(uuid) to authenticated;

do $$
begin
  if exists (
    select 1 from public.owners owner
    join public.profiles profile on profile.id=owner.profile_id
    left join public.workspace_memberships membership
      on membership.workspace_id=owner.id and membership.profile_id=owner.profile_id
    where owner.profile_id is not null and membership.id is null
  ) then raise exception 'Owner membership backfill left a valid owner without membership'; end if;
end $$;

commit;
