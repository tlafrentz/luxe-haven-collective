\set ON_ERROR_STOP on
-- PA-001: Platform Access Architecture foundation verification against the
-- real migration chain. Non-destructive (rollback at the end).
begin;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,crypt('Local-PA001-Only!',gen_salt('bf')),now(),'{}','{}',now(),now()
from (values
  ('a9010000-0000-4000-8000-000000000001'::uuid,'pa001-admin@example.invalid'),
  ('a9010000-0000-4000-8000-000000000002'::uuid,'pa001-owner1@example.invalid'),
  ('a9010000-0000-4000-8000-000000000003'::uuid,'pa001-admin1@example.invalid'),
  ('a9010000-0000-4000-8000-000000000004'::uuid,'pa001-manager1@example.invalid'),
  ('a9010000-0000-4000-8000-000000000005'::uuid,'pa001-contributor1@example.invalid'),
  ('a9010000-0000-4000-8000-000000000006'::uuid,'pa001-viewer1@example.invalid'),
  ('a9010000-0000-4000-8000-000000000007'::uuid,'pa001-nonmember@example.invalid'),
  ('a9010000-0000-4000-8000-000000000008'::uuid,'pa001-newgrant@example.invalid')
) fixture(id,email) on conflict(id) do nothing;

insert into public.profiles(id,email,full_name,role) values
('a9010000-0000-4000-8000-000000000001','pa001-admin@example.invalid','PA001 Platform Admin','admin'),
('a9010000-0000-4000-8000-000000000002','pa001-owner1@example.invalid','PA001 Owner1','owner'),
('a9010000-0000-4000-8000-000000000003','pa001-admin1@example.invalid','PA001 Admin1','owner'),
('a9010000-0000-4000-8000-000000000004','pa001-manager1@example.invalid','PA001 Manager1','owner'),
('a9010000-0000-4000-8000-000000000005','pa001-contributor1@example.invalid','PA001 Contributor1','owner'),
('a9010000-0000-4000-8000-000000000006','pa001-viewer1@example.invalid','PA001 Viewer1','owner'),
('a9010000-0000-4000-8000-000000000007','pa001-nonmember@example.invalid','PA001 NonMember','owner'),
('a9010000-0000-4000-8000-000000000008','pa001-newgrant@example.invalid','PA001 NewGrant','owner')
on conflict(id) do update set role=excluded.role;

insert into public.owners(id,profile_id) values
('b9010000-0000-4000-8000-000000000001','a9010000-0000-4000-8000-000000000002')
on conflict(id) do nothing;

insert into public.workspace_memberships(workspace_id,profile_id,role,status,property_access_mode) values
('b9010000-0000-4000-8000-000000000001','a9010000-0000-4000-8000-000000000002','owner','active','all'),
('b9010000-0000-4000-8000-000000000001','a9010000-0000-4000-8000-000000000003','administrator','active','none'),
('b9010000-0000-4000-8000-000000000001','a9010000-0000-4000-8000-000000000004','operator','active','none'),
('b9010000-0000-4000-8000-000000000001','a9010000-0000-4000-8000-000000000005','contributor','active','none'),
('b9010000-0000-4000-8000-000000000001','a9010000-0000-4000-8000-000000000006','viewer','active','none'),
('b9010000-0000-4000-8000-000000000001','a9010000-0000-4000-8000-000000000008','contributor','active','none')
on conflict(workspace_id,profile_id) do nothing;

-- Bootstrap role_assignments using the platform-admin bypass (is_admin()),
-- exactly as an operator would do it before any workspace Owner exists.
select set_config('request.jwt.claim.sub','a9010000-0000-4000-8000-000000000001',false);

do $$
declare r jsonb;
begin
  r := public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000002','role','workspace_owner','workspace_id','b9010000-0000-4000-8000-000000000001','reason','pa001 fixture bootstrap','idempotency_key','pa001-bootstrap-owner1'));
  if r->>'status'<>'granted' then raise exception 'PA001_BOOTSTRAP_OWNER_UNEXPECTED: %', r; end if;

  r := public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000003','role','administrator','workspace_id','b9010000-0000-4000-8000-000000000001','reason','pa001 fixture bootstrap','idempotency_key','pa001-bootstrap-admin1'));
  if r->>'status'<>'granted' then raise exception 'PA001_BOOTSTRAP_ADMIN_UNEXPECTED: %', r; end if;

  r := public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000004','role','manager','workspace_id','b9010000-0000-4000-8000-000000000001','module','guidebooks','scope_type','workspace','reason','pa001 fixture bootstrap','idempotency_key','pa001-bootstrap-manager1'));
  if r->>'status'<>'granted' then raise exception 'PA001_BOOTSTRAP_MANAGER_UNEXPECTED: %', r; end if;

  r := public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000005','role','contributor','workspace_id','b9010000-0000-4000-8000-000000000001','module','guidebooks','scope_type','property','scope_id','prop-1','reason','pa001 fixture bootstrap','idempotency_key','pa001-bootstrap-contributor1'));
  if r->>'status'<>'granted' then raise exception 'PA001_BOOTSTRAP_CONTRIBUTOR_UNEXPECTED: %', r; end if;

  r := public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000006','role','viewer','workspace_id','b9010000-0000-4000-8000-000000000001','module','financials','scope_type','workspace','reason','pa001 fixture bootstrap','idempotency_key','pa001-bootstrap-viewer1'));
  if r->>'status'<>'granted' then raise exception 'PA001_BOOTSTRAP_VIEWER_UNEXPECTED: %', r; end if;
end $$;

-- 1. Seed integrity -----------------------------------------------------------
do $$
declare role_count int; bad_id_count int; viewer_non_view_count int;
begin
  select count(*) into role_count from public.roles where state='active';
  if role_count<>5 then raise exception 'PA001_SEED_ROLE_COUNT_WRONG: %', role_count; end if;

  select count(*) into bad_id_count from public.privilege_definitions where id<>module||'.'||resource||'.'||action;
  if bad_id_count<>0 then raise exception 'PA001_SEED_PRIVILEGE_ID_MISMATCH: %', bad_id_count; end if;

  select count(*) into viewer_non_view_count
  from public.role_privileges rp
  join public.roles r on r.id=rp.role_id
  join public.privilege_definitions pd on pd.id=rp.privilege_id
  where r.canonical_name='viewer' and rp.superseded_at is null
    and pd.action<>'view' and pd.action not like 'view\_%' escape '\' and pd.action not like '%\_view' escape '\';
  if viewer_non_view_count<>0 then raise exception 'PA001_SEED_VIEWER_BUNDLE_NOT_VIEW_ONLY: %', viewer_non_view_count; end if;
end $$;

-- 2. Basic allow/deny + scope hierarchy + union across assignments -----------
do $$
declare d record;
begin
  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000004','b9010000-0000-4000-8000-000000000001','guidebooks.guidebook.view');
  if not d.allowed or d.reason_code<>'PA_ALLOW' then raise exception 'PA001_MANAGER_VIEW_SHOULD_ALLOW: %', d; end if;

  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000004','b9010000-0000-4000-8000-000000000001','financials.summary.view_summary');
  if d.allowed or d.reason_code<>'PA_DENY_NO_GRANT' then raise exception 'PA001_MANAGER_WRONG_MODULE_SHOULD_DENY: %', d; end if;

  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000006','b9010000-0000-4000-8000-000000000001','financials.transaction.reconcile');
  if d.allowed or d.reason_code<>'PA_DENY_NO_GRANT' then raise exception 'PA001_VIEWER_CANNOT_RECONCILE: %', d; end if;

  -- Scope hierarchy: Manager1's workspace-scoped grant covers a narrower property request.
  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000004','b9010000-0000-4000-8000-000000000001','guidebooks.guidebook.publish','property','prop-9');
  if not d.allowed then raise exception 'PA001_BROADER_GRANT_SHOULD_COVER_NARROWER_SCOPE: %', d; end if;

  -- Contributor1's property-scoped grant covers that property...
  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000005','b9010000-0000-4000-8000-000000000001','guidebooks.guidebook.edit','property','prop-1');
  if not d.allowed then raise exception 'PA001_PROPERTY_SCOPED_GRANT_SHOULD_COVER_SAME_PROPERTY: %', d; end if;

  -- ...but not a sibling property.
  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000005','b9010000-0000-4000-8000-000000000001','guidebooks.guidebook.edit','property','prop-2');
  if d.allowed then raise exception 'PA001_PROPERTY_SCOPED_GRANT_SHOULD_NOT_COVER_SIBLING: %', d; end if;
end $$;

-- 3. Union across multiple role assignments (AUTH-003) ------------------------
select set_config('request.jwt.claim.sub','a9010000-0000-4000-8000-000000000001',false);
do $$
declare r jsonb; d record;
begin
  r := public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000004','role','contributor','workspace_id','b9010000-0000-4000-8000-000000000001','module','financials','scope_type','workspace','reason','pa001 union test','idempotency_key','pa001-union-manager1-financials'));
  if r->>'status'<>'granted' then raise exception 'PA001_UNION_GRANT_UNEXPECTED: %', r; end if;

  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000004','b9010000-0000-4000-8000-000000000001','guidebooks.guidebook.view');
  if not d.allowed then raise exception 'PA001_UNION_STILL_HAS_ORIGINAL_GRANT: %', d; end if;

  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000004','b9010000-0000-4000-8000-000000000001','financials.transaction.categorize');
  if not d.allowed then raise exception 'PA001_UNION_HAS_NEW_GRANT_TOO: %', d; end if;
end $$;

-- 4. Unknown / retired privilege always denies --------------------------------
do $$
declare d record;
begin
  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000004','b9010000-0000-4000-8000-000000000001','nonexistent.thing.action');
  if d.allowed or d.reason_code<>'PA_DENY_UNKNOWN_PRIVILEGE' then raise exception 'PA001_UNKNOWN_PRIVILEGE_SHOULD_DENY: %', d; end if;

  update public.privilege_definitions set state='retired' where id='guidebooks.guidebook.export';
  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000004','b9010000-0000-4000-8000-000000000001','guidebooks.guidebook.export');
  if d.allowed or d.reason_code<>'PA_DENY_RETIRED_PRIVILEGE' then raise exception 'PA001_RETIRED_PRIVILEGE_SHOULD_DENY_EVEN_IF_BUNDLED: %', d; end if;
  update public.privilege_definitions set state='active' where id='guidebooks.guidebook.export';
end $$;

-- 5. Expired assignment (state still 'active') denies at evaluation time ------
do $$
declare v_role_id uuid; d record;
begin
  select id into v_role_id from public.roles where canonical_name='viewer';
  insert into public.role_assignments (subject_id,role_id,workspace_id,module,scope_type,valid_from,valid_until,state,assigner_id,reason)
  values ('a9010000-0000-4000-8000-000000000007',v_role_id,'b9010000-0000-4000-8000-000000000001','operations','workspace',now()-interval '10 days',now()-interval '1 day','active','a9010000-0000-4000-8000-000000000001','pa001 expiry fixture');

  -- give the subject an active membership so we isolate the expiry check
  insert into public.workspace_memberships(workspace_id,profile_id,role,status) values
  ('b9010000-0000-4000-8000-000000000001','a9010000-0000-4000-8000-000000000007','viewer','active')
  on conflict(workspace_id,profile_id) do update set status='active';

  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000007','b9010000-0000-4000-8000-000000000001','operations.task.view');
  if d.allowed or d.reason_code<>'PA_DENY_EXPIRED_OR_REVOKED' then raise exception 'PA001_EXPIRED_ASSIGNMENT_SHOULD_DENY_REGARDLESS_OF_STATE_COLUMN: %', d; end if;
end $$;

-- 6. Anonymous / non-member default deny --------------------------------------
do $$
declare d record;
begin
  select * into d from public.evaluate_privilege(null,'b9010000-0000-4000-8000-000000000001','guidebooks.guidebook.view');
  if d.allowed or d.reason_code<>'PA_DENY_ANONYMOUS' then raise exception 'PA001_ANONYMOUS_SHOULD_DENY: %', d; end if;

  -- a9...0008 has an active workspace_memberships row from setup but no
  -- role_assignments yet at this point in the test -- proves membership
  -- alone does not imply a grant.
  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000008','b9010000-0000-4000-8000-000000000001','guidebooks.guidebook.view');
  if d.allowed or d.reason_code<>'PA_DENY_NO_GRANT' then raise exception 'PA001_MEMBER_WITHOUT_GRANT_SHOULD_DENY: %', d; end if;

  update public.workspace_memberships set status='suspended' where workspace_id='b9010000-0000-4000-8000-000000000001' and profile_id='a9010000-0000-4000-8000-000000000008';
  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000008','b9010000-0000-4000-8000-000000000001','guidebooks.guidebook.view');
  if d.allowed or d.reason_code<>'PA_DENY_NOT_WORKSPACE_MEMBER' then raise exception 'PA001_SUSPENDED_MEMBER_SHOULD_DENY: %', d; end if;
  update public.workspace_memberships set status='active' where workspace_id='b9010000-0000-4000-8000-000000000001' and profile_id='a9010000-0000-4000-8000-000000000008';
end $$;

-- 7. Revoked assignment denies immediately ------------------------------------
select set_config('request.jwt.claim.sub','a9010000-0000-4000-8000-000000000003',false);
do $$
declare v_assignment record; r jsonb; d record;
begin
  select ra.* into v_assignment from public.role_assignments ra join public.roles ro on ro.id=ra.role_id
  where ra.subject_id='a9010000-0000-4000-8000-000000000004' and ro.canonical_name='contributor' and ra.module='financials' and ra.state='active';

  r := public.revoke_role_assignment(jsonb_build_object('assignment_id',v_assignment.id,'expected_version',v_assignment.version,'reason','pa001 revoke test','idempotency_key','pa001-revoke-manager1-financials'));
  if r->>'status'<>'revoked' then raise exception 'PA001_REVOKE_UNEXPECTED: %', r; end if;

  select * into d from public.evaluate_privilege('a9010000-0000-4000-8000-000000000004','b9010000-0000-4000-8000-000000000001','financials.transaction.categorize');
  if d.allowed then raise exception 'PA001_REVOKED_ASSIGNMENT_STILL_ALLOWS: %', d; end if;
end $$;

-- 8. Duplicate-idempotent create_role_assignment (IAM-003) --------------------
select set_config('request.jwt.claim.sub','a9010000-0000-4000-8000-000000000001',false);
do $$
declare r1 jsonb; r2 jsonb; r3 jsonb; active_count int;
begin
  r1 := public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000008','role','contributor','workspace_id','b9010000-0000-4000-8000-000000000001','module','operations','scope_type','workspace','reason','pa001 idempotency test','idempotency_key','pa001-idem-key-1'));
  if r1->>'status'<>'granted' then raise exception 'PA001_IDEM_FIRST_CALL_UNEXPECTED: %', r1; end if;

  r2 := public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000008','role','contributor','workspace_id','b9010000-0000-4000-8000-000000000001','module','operations','scope_type','workspace','reason','pa001 idempotency test','idempotency_key','pa001-idem-key-1'));
  if r2->>'status'<>'replayed' or r2->>'assignmentId'<>r1->>'assignmentId' then raise exception 'PA001_IDEM_REPLAY_UNEXPECTED: %', r2; end if;

  r3 := public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000008','role','contributor','workspace_id','b9010000-0000-4000-8000-000000000001','module','operations','scope_type','workspace','valid_until',(now()+interval '30 days')::text,'reason','pa001 idempotency test extended','idempotency_key','pa001-idem-key-2'));
  if r3->>'status'<>'modified' or r3->>'assignmentId'<>r1->>'assignmentId' then raise exception 'PA001_IDEM_SECOND_KEY_SHOULD_CONVERGE_NOT_DUPLICATE: %', r3; end if;

  select count(*) into active_count from public.role_assignments ra join public.roles ro on ro.id=ra.role_id
  where ra.subject_id='a9010000-0000-4000-8000-000000000008' and ro.canonical_name='contributor' and ra.module='operations' and ra.state='active';
  if active_count<>1 then raise exception 'PA001_IDEM_SHOULD_LEAVE_EXACTLY_ONE_ACTIVE_ROW: %', active_count; end if;
end $$;

-- 9. Delegation-ceiling, Owner-grant restriction, self-escalation (IAM-006) ---
do $$
declare
  assignments_before int; audit_before int; events_before int;
  assignments_after int; audit_after int; events_after int;
  failed boolean;
begin
  select count(*) into assignments_before from public.role_assignments;
  select count(*) into audit_before from public.authorization_audit;
  select count(*) into events_before from public.access_change_events;

  -- Contributor1 (no roles_manage privilege) attempts to grant a role.
  perform set_config('request.jwt.claim.sub','a9010000-0000-4000-8000-000000000005',false);
  failed := false;
  begin
    perform public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000007','role','viewer','workspace_id','b9010000-0000-4000-8000-000000000001','module','operations','scope_type','workspace','reason','should be denied','idempotency_key','pa001-denial-contributor-escalation'));
  exception when others then
    failed := true;
    if sqlerrm<>'PA_ASSIGNMENT_PERMISSION_DENIED' then raise exception 'PA001_DELEGATION_CEILING_WRONG_ERROR: %', sqlerrm; end if;
  end;
  if not failed then raise exception 'PA001_DELEGATION_CEILING_SHOULD_HAVE_FAILED'; end if;

  -- Administrator1 (has roles_manage, but is not an Owner) attempts to mint a new Owner.
  perform set_config('request.jwt.claim.sub','a9010000-0000-4000-8000-000000000003',false);
  failed := false;
  begin
    perform public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000007','role','workspace_owner','workspace_id','b9010000-0000-4000-8000-000000000001','reason','should be denied','idempotency_key','pa001-denial-admin-owner-grant'));
  exception when others then
    failed := true;
    if sqlerrm<>'PA_ASSIGNMENT_OWNER_GRANT_RESTRICTED' then raise exception 'PA001_OWNER_GRANT_RESTRICTION_WRONG_ERROR: %', sqlerrm; end if;
  end;
  if not failed then raise exception 'PA001_OWNER_GRANT_RESTRICTION_SHOULD_HAVE_FAILED'; end if;

  -- Owner1 attempts to grant themselves an additional role.
  perform set_config('request.jwt.claim.sub','a9010000-0000-4000-8000-000000000002',false);
  failed := false;
  begin
    perform public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000002','role','viewer','workspace_id','b9010000-0000-4000-8000-000000000001','module','operations','scope_type','workspace','reason','should be denied','idempotency_key','pa001-denial-self-escalation'));
  exception when others then
    failed := true;
    if sqlerrm<>'PA_ASSIGNMENT_SELF_ESCALATION_DENIED' then raise exception 'PA001_SELF_ESCALATION_WRONG_ERROR: %', sqlerrm; end if;
  end;
  if not failed then raise exception 'PA001_SELF_ESCALATION_SHOULD_HAVE_FAILED'; end if;

  select count(*) into assignments_after from public.role_assignments;
  select count(*) into audit_after from public.authorization_audit;
  select count(*) into events_after from public.access_change_events;
  if assignments_after<>assignments_before or audit_after<>audit_before or events_after<>events_before then
    raise exception 'PA001_DENIED_ATTEMPTS_MUST_NOT_CHANGE_STATE: assignments % -> %, audit % -> %, events % -> %',
      assignments_before, assignments_after, audit_before, audit_after, events_before, events_after;
  end if;
end $$;

-- 10. Sequential last-owner protection (single-session correctness) ----------
select set_config('request.jwt.claim.sub','a9010000-0000-4000-8000-000000000001',false);
do $$
declare r jsonb; v_owner1 record; v_owner2 record; failed boolean;
begin
  r := public.create_role_assignment(jsonb_build_object('subject_id','a9010000-0000-4000-8000-000000000007','role','workspace_owner','workspace_id','b9010000-0000-4000-8000-000000000001','reason','second owner for last-owner test','idempotency_key','pa001-second-owner'));
  if r->>'status'<>'granted' then raise exception 'PA001_SECOND_OWNER_GRANT_UNEXPECTED: %', r; end if;

  select ra.* into v_owner1 from public.role_assignments ra join public.roles ro on ro.id=ra.role_id where ra.subject_id='a9010000-0000-4000-8000-000000000002' and ro.canonical_name='workspace_owner' and ra.state='active';
  select ra.* into v_owner2 from public.role_assignments ra join public.roles ro on ro.id=ra.role_id where ra.subject_id='a9010000-0000-4000-8000-000000000007' and ro.canonical_name='workspace_owner' and ra.state='active';

  -- Only an existing Owner (or platform staff) may revoke an Owner's
  -- assignment -- Administrator1 cannot, so use the platform-admin bypass
  -- here (this also lets the same actor legitimately attempt the second,
  -- last-owner revoke below, which no peer Owner could ever reach: self-
  -- revoke is always blocked, so the only way to observe "revoking the
  -- last owner" is via a non-owner platform-admin actor).
  r := public.revoke_role_assignment(jsonb_build_object('assignment_id',v_owner2.id,'expected_version',v_owner2.version,'reason','revoke second owner','idempotency_key','pa001-revoke-second-owner'));
  if r->>'status'<>'revoked' then raise exception 'PA001_REVOKE_SECOND_OWNER_UNEXPECTED: %', r; end if;

  -- Now only Owner1 remains active -- revoking them must be blocked.
  failed := false;
  begin
    perform public.revoke_role_assignment(jsonb_build_object('assignment_id',v_owner1.id,'expected_version',v_owner1.version,'reason','should be denied','idempotency_key','pa001-revoke-last-owner'));
  exception when others then
    failed := true;
    if sqlerrm<>'PA_ASSIGNMENT_LAST_OWNER_PROTECTED' then raise exception 'PA001_LAST_OWNER_WRONG_ERROR: %', sqlerrm; end if;
  end;
  if not failed then raise exception 'PA001_LAST_OWNER_SHOULD_HAVE_FAILED'; end if;

  if not exists(select 1 from public.role_assignments ra join public.roles ro on ro.id=ra.role_id where ra.workspace_id='b9010000-0000-4000-8000-000000000001' and ro.canonical_name='workspace_owner' and ra.state='active') then
    raise exception 'PA001_WORKSPACE_MUST_STILL_HAVE_AN_ACTIVE_OWNER';
  end if;
end $$;

-- 11. Owner/Administrator backfill logic correctness (re-run in isolation) ---
do $$
declare owner_count int; admin_count int; legacy_count int;
begin
  insert into public.owners(id,profile_id) values ('b9010000-0000-4000-8000-000000000099','a9010000-0000-4000-8000-000000000001') on conflict(id) do nothing;
  insert into public.workspace_memberships(workspace_id,profile_id,role,status,property_access_mode) values
  ('b9010000-0000-4000-8000-000000000099','a9010000-0000-4000-8000-000000000003','owner','active','all'),
  ('b9010000-0000-4000-8000-000000000099','a9010000-0000-4000-8000-000000000004','administrator','active','none'),
  ('b9010000-0000-4000-8000-000000000099','a9010000-0000-4000-8000-000000000005','operator','active','none'),
  ('b9010000-0000-4000-8000-000000000099','a9010000-0000-4000-8000-000000000006','viewer','active','none')
  on conflict(workspace_id,profile_id) do nothing;

  insert into public.role_assignments (subject_id, role_id, workspace_id, module, scope_type, scope_id, assigner_id, reason)
  select m.profile_id, r.id, m.workspace_id, null, 'workspace', null, m.profile_id,
         'pa-001 backfill: bridged from workspace_memberships'
  from public.workspace_memberships m
  join public.roles r on r.canonical_name = case m.role when 'owner' then 'workspace_owner' else 'administrator' end
  where m.role in ('owner','administrator') and m.status = 'active' and m.workspace_id='b9010000-0000-4000-8000-000000000099'
  on conflict do nothing;

  select count(*) into owner_count from public.role_assignments ra join public.roles ro on ro.id=ra.role_id where ra.workspace_id='b9010000-0000-4000-8000-000000000099' and ra.subject_id='a9010000-0000-4000-8000-000000000003' and ro.canonical_name='workspace_owner';
  select count(*) into admin_count from public.role_assignments ra join public.roles ro on ro.id=ra.role_id where ra.workspace_id='b9010000-0000-4000-8000-000000000099' and ra.subject_id='a9010000-0000-4000-8000-000000000004' and ro.canonical_name='administrator';
  select count(*) into legacy_count from public.role_assignments where workspace_id='b9010000-0000-4000-8000-000000000099' and subject_id in ('a9010000-0000-4000-8000-000000000005','a9010000-0000-4000-8000-000000000006');

  if owner_count<>1 then raise exception 'PA001_BACKFILL_OWNER_MISSING_OR_DUPLICATED: %', owner_count; end if;
  if admin_count<>1 then raise exception 'PA001_BACKFILL_ADMIN_MISSING_OR_DUPLICATED: %', admin_count; end if;
  if legacy_count<>0 then raise exception 'PA001_BACKFILL_MUST_NOT_BRIDGE_OPERATOR_CONTRIBUTOR_VIEWER: %', legacy_count; end if;
end $$;

rollback;
select 'PA-001 platform access foundation verification passed' as result;
