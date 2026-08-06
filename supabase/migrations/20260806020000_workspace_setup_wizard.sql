-- UX-001 Chapter 3: workspace setup wizard support.
-- Additive only: reuses workspace_onboarding / workspace_readiness_activity /
-- workspace_property_system_activity rather than introducing parallel tables.
begin;

alter table public.workspace_onboarding
  add column if not exists skipped_steps text[] not null default '{}';

alter table public.properties
  add column if not exists source text not null default 'provider'
    check (source in ('provider','manual'));

-- Marks a wizard step as satisfied without a live health signal (used both for
-- genuinely optional steps like Team, and for Connect, whose only path in this
-- pass is a manual acknowledgement since no real PMS OAuth exists yet).
create or replace function public.apply_workspace_setup_command(
  p_workspace_id uuid, p_action text, p_step_code text, p_command_id text
) returns void language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); actor_role text;
begin
  actor_role := public.active_workspace_role(p_workspace_id);
  if actor_id is null or actor_role not in ('owner','administrator') then
    raise exception 'Workspace setup requires workspace administration' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.workspace_readiness_activity
    where workspace_id = p_workspace_id and command_id = p_command_id
  ) then return; end if;

  if p_action = 'skip-step' then
    insert into public.workspace_onboarding (workspace_id, status, started_at, skipped_steps)
    values (p_workspace_id, 'in-progress', now(), array[p_step_code])
    on conflict (workspace_id) do update
    set skipped_steps = array(select distinct unnest(workspace_onboarding.skipped_steps || p_step_code)),
        updated_at = now();
  elsif p_action = 'complete-setup' then
    insert into public.workspace_onboarding (workspace_id, status, started_at, completed_at, completed_by_profile_id)
    values (p_workspace_id, 'completed', now(), now(), actor_id)
    on conflict (workspace_id) do update
    set status = 'completed', completed_at = coalesce(workspace_onboarding.completed_at, now()),
        completed_by_profile_id = actor_id, updated_at = now();
  else
    raise exception 'Unsupported workspace setup command';
  end if;

  insert into public.workspace_readiness_activity (workspace_id, actor_profile_id, action, command_id)
  values (p_workspace_id, actor_id, p_action || ':' || coalesce(p_step_code, ''), p_command_id);
end;
$$;
revoke all on function public.apply_workspace_setup_command(uuid,text,text,text) from public;
grant execute on function public.apply_workspace_setup_command(uuid,text,text,text) to authenticated;

-- Manual property creation: the one genuine gap in property management today
-- (apply_workspace_property_system_command only manages already-discovered rows).
create or replace function public.create_manual_workspace_property(
  p_workspace_id uuid, p_name text, p_city text, p_state text, p_command_id text
) returns uuid language plpgsql security definer set search_path = public as $$
declare actor_id uuid := auth.uid(); actor_role text; new_property_id uuid;
begin
  actor_role := public.active_workspace_role(p_workspace_id);
  if actor_id is null or actor_role not in ('owner','administrator') then
    raise exception 'Property creation requires workspace administration' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.workspace_property_system_activity
    where workspace_id = p_workspace_id and command_id = p_command_id
  ) then
    select property_id into new_property_id
    from public.workspace_property_system_activity
    where workspace_id = p_workspace_id and command_id = p_command_id;
    return new_property_id;
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Property name is required' using errcode = '22023';
  end if;

  insert into public.properties (owner_id, name, slug, description, city, state, status, source)
  values (
    p_workspace_id, p_name,
    lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6),
    '', coalesce(nullif(trim(p_city), ''), 'Unknown'), coalesce(nullif(trim(p_state), ''), 'Unknown'),
    'draft', 'manual'
  )
  returning id into new_property_id;

  insert into public.property_workspace_configuration (property_id, workspace_id, inclusion, updated_by_profile_id)
  values (new_property_id, p_workspace_id, 'included', actor_id);

  insert into public.workspace_property_system_activity
    (workspace_id, actor_profile_id, property_id, action, command_id)
  values (p_workspace_id, actor_id, new_property_id, 'create-manual-property', p_command_id);

  return new_property_id;
end;
$$;
revoke all on function public.create_manual_workspace_property(uuid,text,text,text,text) from public;
grant execute on function public.create_manual_workspace_property(uuid,text,text,text,text) to authenticated;

commit;
