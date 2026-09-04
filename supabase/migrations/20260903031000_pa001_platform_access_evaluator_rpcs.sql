-- PA-001: Platform Access Architecture — canonical evaluator and governed
-- role-assignment RPCs. Ships unused: no existing RLS policy, server
-- action, or RPC calls any of these yet.
begin;

-- 1. Canonical evaluator ------------------------------------------------------
-- Stable (no writes) so it stays cheap enough for later milestones to embed
-- in RLS without fighting SEC-006's "no indefinite caching" requirement.
create or replace function public.evaluate_privilege(
  p_subject_id uuid,
  p_workspace_id uuid,
  p_privilege_id text,
  p_scope_type public.access_scope_type default 'workspace',
  p_scope_id text default null
) returns table (
  allowed boolean,
  reason_code text,
  matching_assignment_ids uuid[]
) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  priv public.privilege_definitions%rowtype;
  ids uuid[];
  is_platform_staff boolean;
begin
  if p_subject_id is null then
    return query select false, 'PA_DENY_ANONYMOUS', array[]::uuid[];
    return;
  end if;

  -- Deliberately keyed off p_subject_id, not auth.uid()/is_admin(): this
  -- function evaluates an arbitrary subject's access (e.g. an admin UI
  -- inspecting someone else's permissions), so "is the subject being
  -- evaluated platform staff" must not depend on who happens to be calling.
  select exists(select 1 from public.profiles where id = p_subject_id and role = 'admin') into is_platform_staff;

  if not is_platform_staff and not exists (
    select 1 from public.workspace_memberships m
    where m.workspace_id = p_workspace_id and m.profile_id = p_subject_id and m.status = 'active'
  ) then
    return query select false, 'PA_DENY_NOT_WORKSPACE_MEMBER', array[]::uuid[];
    return;
  end if;

  select * into priv from public.privilege_definitions where id = p_privilege_id and state = 'active';
  if not found then
    return query select false,
      case when exists (select 1 from public.privilege_definitions where id = p_privilege_id and state = 'retired')
        then 'PA_DENY_RETIRED_PRIVILEGE' else 'PA_DENY_UNKNOWN_PRIVILEGE' end,
      array[]::uuid[];
    return;
  end if;

  if not (p_scope_type = any(priv.allowed_scopes)) then
    return query select false, 'PA_DENY_SCOPE_UNSUPPORTED', array[]::uuid[];
    return;
  end if;

  if is_platform_staff then
    return query select true, 'PA_ALLOW_PLATFORM_STAFF', array[]::uuid[];
    return;
  end if;

  select array_agg(ra.id) into ids
  from public.role_assignments ra
  join public.role_privileges rp
    on rp.role_id = ra.role_id and rp.superseded_at is null and rp.privilege_id = p_privilege_id
  where ra.workspace_id = p_workspace_id
    and ra.subject_id = p_subject_id
    and ra.state = 'active'
    and ra.valid_from <= now()
    and (ra.valid_until is null or ra.valid_until > now())
    and (ra.module is null or ra.module = priv.module)
    and (
      (ra.scope_type = p_scope_type and ra.scope_id is not distinct from p_scope_id)
      or ra.scope_type < p_scope_type
    );

  if ids is null or array_length(ids, 1) is null then
    if exists (
      select 1 from public.role_assignments ra
      join public.role_privileges rp
        on rp.role_id = ra.role_id and rp.superseded_at is null and rp.privilege_id = p_privilege_id
      where ra.workspace_id = p_workspace_id and ra.subject_id = p_subject_id
        and (ra.module is null or ra.module = priv.module)
        and (
          (ra.scope_type = p_scope_type)
          or ra.scope_type < p_scope_type
        )
        and (ra.state <> 'active' or ra.valid_from > now() or (ra.valid_until is not null and ra.valid_until <= now()))
    ) then
      return query select false, 'PA_DENY_EXPIRED_OR_REVOKED', array[]::uuid[];
    else
      return query select false, 'PA_DENY_NO_GRANT', array[]::uuid[];
    end if;
    return;
  end if;

  return query select true, 'PA_ALLOW', ids;
end $$;

revoke all on function public.evaluate_privilege(uuid,uuid,text,public.access_scope_type,text) from public,anon;
grant execute on function public.evaluate_privilege(uuid,uuid,text,public.access_scope_type,text) to authenticated;

-- 2. create_role_assignment ----------------------------------------------------
create or replace function public.create_role_assignment(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  actor uuid := auth.uid();
  v_subject_id uuid;
  v_role_name text;
  v_role_id uuid;
  v_workspace_id uuid;
  v_module text;
  v_scope_type public.access_scope_type;
  v_scope_id text;
  v_valid_from timestamptz;
  v_valid_until timestamptz;
  v_reason text;
  v_idempotency_key text;
  v_correlation_id uuid;
  v_fingerprint text;
  v_prior public.role_assignment_command_receipts%rowtype;
  v_permitted boolean;
  v_actor_is_owner boolean;
  v_assignment public.role_assignments%rowtype;
  v_event_type text;
  v_before jsonb := '{}'::jsonb;
  v_result jsonb;
begin
  if actor is null then
    raise exception 'PA_ASSIGNMENT_UNAUTHENTICATED';
  end if;

  begin
    v_subject_id := (p_input->>'subject_id')::uuid;
    v_role_name := p_input->>'role';
    v_workspace_id := (p_input->>'workspace_id')::uuid;
    v_module := nullif(p_input->>'module', '');
    v_scope_type := coalesce((p_input->>'scope_type')::public.access_scope_type, 'workspace');
    v_scope_id := nullif(p_input->>'scope_id', '');
    v_valid_from := coalesce((p_input->>'valid_from')::timestamptz, now());
    v_valid_until := (p_input->>'valid_until')::timestamptz;
    v_reason := p_input->>'reason';
    v_idempotency_key := p_input->>'idempotency_key';
    v_correlation_id := coalesce((p_input->>'correlation_id')::uuid, gen_random_uuid());
  exception when others then
    raise exception 'PA_ASSIGNMENT_COMMAND_INVALID';
  end;

  if v_subject_id is null or v_role_name is null or v_workspace_id is null
     or v_reason is null or trim(v_reason) = '' or v_idempotency_key is null then
    raise exception 'PA_ASSIGNMENT_COMMAND_INVALID';
  end if;

  select id into v_role_id from public.roles where canonical_name = v_role_name and state = 'active';
  if v_role_id is null then
    raise exception 'PA_ASSIGNMENT_UNKNOWN_ROLE';
  end if;

  -- Serializes concurrent create/modify requests for the same subject in
  -- the same workspace.
  perform pg_advisory_xact_lock(hashtextextended('pa-role-assignment:' || v_workspace_id::text || ':' || v_subject_id::text, 0));

  v_fingerprint := encode(digest(
    v_subject_id::text || '|' || v_role_name || '|' || v_workspace_id::text || '|' ||
    coalesce(v_module, '') || '|' || v_scope_type::text || '|' || coalesce(v_scope_id, '') || '|' ||
    coalesce(v_valid_until::text, ''), 'sha256'), 'hex');

  select * into v_prior from public.role_assignment_command_receipts where idempotency_key = v_idempotency_key for update;
  if found then
    if v_prior.request_fingerprint <> v_fingerprint then
      raise exception 'PA_ASSIGNMENT_IDEMPOTENCY_CONFLICT';
    end if;
    return v_prior.result || jsonb_build_object('status', 'replayed');
  end if;

  -- IAM-006: self-escalation is never allowed, no exceptions.
  if v_subject_id = actor then
    raise exception 'PA_ASSIGNMENT_SELF_ESCALATION_DENIED';
  end if;

  -- IAM-006: delegation ceiling.
  select allowed into v_permitted from public.evaluate_privilege(actor, v_workspace_id, 'workspace.roles.roles_manage', 'workspace', null);
  if not coalesce(v_permitted, false) then
    raise exception 'PA_ASSIGNMENT_PERMISSION_DENIED';
  end if;

  -- Only an existing Owner (or platform staff) may mint a new Owner.
  if v_role_name = 'workspace_owner' then
    select exists(
      select 1 from public.role_assignments ra join public.roles r on r.id = ra.role_id
      where ra.workspace_id = v_workspace_id and ra.subject_id = actor and ra.state = 'active'
        and r.canonical_name = 'workspace_owner'
        and ra.valid_from <= now() and (ra.valid_until is null or ra.valid_until > now())
    ) into v_actor_is_owner;
    if not coalesce(v_actor_is_owner, false) and not public.is_admin() then
      raise exception 'PA_ASSIGNMENT_OWNER_GRANT_RESTRICTED';
    end if;
  end if;

  -- IAM-003: converge duplicate/near-duplicate active requests to one row.
  select * into v_assignment from public.role_assignments
  where subject_id = v_subject_id and role_id = v_role_id and workspace_id = v_workspace_id
    and coalesce(module, '') = coalesce(v_module, '')
    and scope_type = v_scope_type and coalesce(scope_id, '') = coalesce(v_scope_id, '')
    and state = 'active'
  for update;

  if found then
    v_event_type := 'modified';
    v_before := to_jsonb(v_assignment);
    update public.role_assignments
    set valid_until = v_valid_until, reason = v_reason, assigner_id = actor, version = version + 1, updated_at = now()
    where id = v_assignment.id
    returning * into v_assignment;
  else
    v_event_type := 'granted';
    insert into public.role_assignments (subject_id, role_id, workspace_id, module, scope_type, scope_id, valid_from, valid_until, assigner_id, reason)
    values (v_subject_id, v_role_id, v_workspace_id, v_module, v_scope_type, v_scope_id, v_valid_from, v_valid_until, actor, v_reason)
    returning * into v_assignment;
  end if;

  insert into public.access_change_events (event_type, assignment_id, subject_id, role_id, workspace_id, module, scope_type, scope_id, assigner_id, reason, before_state, after_state, correlation_id, idempotency_key)
  values (v_event_type, v_assignment.id, v_subject_id, v_role_id, v_workspace_id, v_module, v_scope_type, v_scope_id, actor, v_reason, v_before, to_jsonb(v_assignment), v_correlation_id, v_idempotency_key);

  insert into public.authorization_audit (actor_id, effective_subject_id, workspace_id, privilege_id, decision, reason_code, matching_assignment_ids, correlation_id)
  values (actor, v_subject_id, v_workspace_id, 'workspace.roles.roles_manage', 'allow', 'PA_ALLOW', array[v_assignment.id], v_correlation_id);

  v_result := jsonb_build_object('status', v_event_type, 'assignmentId', v_assignment.id, 'version', v_assignment.version);

  insert into public.role_assignment_command_receipts (idempotency_key, actor_id, request_fingerprint, result)
  values (v_idempotency_key, actor, v_fingerprint, v_result);

  return v_result;
end $$;

-- 3. revoke_role_assignment ----------------------------------------------------
create or replace function public.revoke_role_assignment(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  actor uuid := auth.uid();
  v_assignment_id uuid;
  v_expected_version bigint;
  v_reason text;
  v_idempotency_key text;
  v_correlation_id uuid;
  v_fingerprint text;
  v_prior public.role_assignment_command_receipts%rowtype;
  v_row public.role_assignments%rowtype;
  v_role_name text;
  v_permitted boolean;
  v_owner_count int;
  v_before jsonb;
  v_result jsonb;
begin
  if actor is null then
    raise exception 'PA_ASSIGNMENT_UNAUTHENTICATED';
  end if;

  begin
    v_assignment_id := (p_input->>'assignment_id')::uuid;
    v_expected_version := (p_input->>'expected_version')::bigint;
    v_reason := p_input->>'reason';
    v_idempotency_key := p_input->>'idempotency_key';
    v_correlation_id := coalesce((p_input->>'correlation_id')::uuid, gen_random_uuid());
  exception when others then
    raise exception 'PA_ASSIGNMENT_COMMAND_INVALID';
  end;

  if v_assignment_id is null or v_expected_version is null
     or v_reason is null or trim(v_reason) = '' or v_idempotency_key is null then
    raise exception 'PA_ASSIGNMENT_COMMAND_INVALID';
  end if;

  select * into v_row from public.role_assignments where id = v_assignment_id;
  if not found then
    raise exception 'PA_ASSIGNMENT_NOT_FOUND';
  end if;

  -- Advisory-locked on workspace_id ALONE (not the assignment or subject):
  -- this is what makes the last-Workspace-Owner check below race-free --
  -- every revoke/expire touching this workspace fully serializes here.
  perform pg_advisory_xact_lock(hashtextextended('pa-owner-guard:' || v_row.workspace_id::text, 0));

  v_fingerprint := encode(digest(v_assignment_id::text || '|' || v_expected_version::text || '|' || v_reason, 'sha256'), 'hex');

  select * into v_prior from public.role_assignment_command_receipts where idempotency_key = v_idempotency_key for update;
  if found then
    if v_prior.request_fingerprint <> v_fingerprint then
      raise exception 'PA_ASSIGNMENT_IDEMPOTENCY_CONFLICT';
    end if;
    return v_prior.result || jsonb_build_object('status', 'replayed');
  end if;

  -- Re-read under the advisory lock.
  select * into v_row from public.role_assignments where id = v_assignment_id for update;

  if v_row.subject_id = actor then
    raise exception 'PA_ASSIGNMENT_SELF_REVOKE_DENIED';
  end if;

  select allowed into v_permitted from public.evaluate_privilege(actor, v_row.workspace_id, 'workspace.roles.roles_manage', 'workspace', null);
  if not coalesce(v_permitted, false) then
    raise exception 'PA_ASSIGNMENT_PERMISSION_DENIED';
  end if;

  select canonical_name into v_role_name from public.roles where id = v_row.role_id;

  if v_role_name = 'workspace_owner' then
    select exists(
      select 1 from public.role_assignments ra join public.roles r on r.id = ra.role_id
      where ra.workspace_id = v_row.workspace_id and ra.subject_id = actor and ra.state = 'active'
        and r.canonical_name = 'workspace_owner'
        and ra.valid_from <= now() and (ra.valid_until is null or ra.valid_until > now())
    ) into v_permitted;
    if not coalesce(v_permitted, false) and not public.is_admin() then
      raise exception 'PA_ASSIGNMENT_OWNER_GRANT_RESTRICTED';
    end if;
  end if;

  if v_row.version <> v_expected_version then
    raise exception 'PA_ASSIGNMENT_STALE_VERSION' using errcode = '40001';
  end if;

  if v_row.state <> 'active' then
    raise exception 'PA_ASSIGNMENT_NOT_ACTIVE';
  end if;

  -- AUTH-005: at least one active Workspace Owner must always remain. Safe
  -- under concurrency because the whole check-then-act sequence happens
  -- inside the workspace-scoped advisory lock taken above.
  if v_role_name = 'workspace_owner' then
    select count(*) into v_owner_count
    from public.role_assignments ra join public.roles r on r.id = ra.role_id
    where ra.workspace_id = v_row.workspace_id and r.canonical_name = 'workspace_owner'
      and ra.state = 'active' and ra.id <> v_row.id
      and ra.valid_from <= now() and (ra.valid_until is null or ra.valid_until > now());
    if v_owner_count = 0 then
      raise exception 'PA_ASSIGNMENT_LAST_OWNER_PROTECTED';
    end if;
  end if;

  v_before := to_jsonb(v_row);

  update public.role_assignments
  set state = 'revoked', valid_until = coalesce(valid_until, now()), version = version + 1, updated_at = now()
  where id = v_assignment_id
  returning * into v_row;

  insert into public.access_change_events (event_type, assignment_id, subject_id, role_id, workspace_id, module, scope_type, scope_id, assigner_id, reason, before_state, after_state, correlation_id, idempotency_key)
  values ('revoked', v_row.id, v_row.subject_id, v_row.role_id, v_row.workspace_id, v_row.module, v_row.scope_type, v_row.scope_id, actor, v_reason, v_before, to_jsonb(v_row), v_correlation_id, v_idempotency_key);

  insert into public.authorization_audit (actor_id, effective_subject_id, workspace_id, privilege_id, decision, reason_code, matching_assignment_ids, correlation_id)
  values (actor, v_row.subject_id, v_row.workspace_id, 'workspace.roles.roles_manage', 'allow', 'PA_ALLOW', array[v_row.id], v_correlation_id);

  v_result := jsonb_build_object('status', 'revoked', 'assignmentId', v_row.id, 'version', v_row.version);

  insert into public.role_assignment_command_receipts (idempotency_key, actor_id, request_fingerprint, result)
  values (v_idempotency_key, actor, v_fingerprint, v_result);

  return v_result;
end $$;

-- 4. get_effective_access -------------------------------------------------------
create or replace function public.get_effective_access(p_subject_id uuid, p_workspace_id uuid)
returns table (
  privilege_id text, module text, scope_type public.access_scope_type, scope_id text,
  role_id uuid, source_assignment_id uuid
) language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  caller uuid := auth.uid();
  permitted boolean;
begin
  if caller is null then
    raise exception 'PA_UNAUTHENTICATED';
  end if;

  if caller <> p_subject_id and not public.is_admin() then
    select allowed into permitted from public.evaluate_privilege(caller, p_workspace_id, 'workspace.roles.roles_view', 'workspace', null);
    if not coalesce(permitted, false) then
      insert into public.authorization_audit (actor_id, effective_subject_id, workspace_id, privilege_id, decision, reason_code, correlation_id)
      values (caller, p_subject_id, p_workspace_id, 'workspace.roles.roles_view', 'deny', 'PA_DENY_ACCESS_PROJECTION', gen_random_uuid());
      raise exception 'PA_ACCESS_PROJECTION_DENIED';
    end if;
    insert into public.authorization_audit (actor_id, effective_subject_id, workspace_id, privilege_id, decision, reason_code, correlation_id)
    values (caller, p_subject_id, p_workspace_id, 'workspace.roles.roles_view', 'allow', 'PA_ALLOW', gen_random_uuid());
  end if;

  return query
  select rp.privilege_id, pd.module, ra.scope_type, ra.scope_id, ra.role_id, ra.id
  from public.role_assignments ra
  join public.role_privileges rp on rp.role_id = ra.role_id and rp.superseded_at is null
  join public.privilege_definitions pd on pd.id = rp.privilege_id and pd.state = 'active'
  where ra.workspace_id = p_workspace_id and ra.subject_id = p_subject_id
    and ra.state = 'active' and ra.valid_from <= now() and (ra.valid_until is null or ra.valid_until > now());
end $$;

-- 5. expire_stale_role_assignments -- optional housekeeping, not load-bearing
-- for correctness (evaluate_privilege always checks valid_until directly).
create or replace function public.expire_stale_role_assignments()
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_count integer;
begin
  update public.role_assignments
  set state = 'expired', updated_at = now()
  where state = 'active' and valid_until is not null and valid_until <= now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.create_role_assignment(jsonb), public.revoke_role_assignment(jsonb), public.get_effective_access(uuid,uuid) from public,anon;
grant execute on function public.create_role_assignment(jsonb), public.revoke_role_assignment(jsonb), public.get_effective_access(uuid,uuid) to authenticated;

revoke all on function public.expire_stale_role_assignments() from public,anon,authenticated;
grant execute on function public.expire_stale_role_assignments() to service_role;

commit;
