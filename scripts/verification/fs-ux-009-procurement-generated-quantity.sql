\set ON_ERROR_STOP on
begin;

set local app.fs008g_cleanup='on';
update public.furnishing_activation_releases
set global_state='internal',global_kill_switch=false,configuration_valid=true
where milestone='FS-008A';

-- Disposable minimum approved-snapshot prerequisite. The transaction rolls back.
insert into public.furnishing_projects
select (jsonb_populate_record(null::public.furnishing_projects,to_jsonb(source)||jsonb_build_object(
  'id','99700000-0000-4000-8000-000000000040','name','FS-UX-009 procurement quantity proof',
  'lifecycle_status','approved','current_plan_version_id',null,'archived_at',null
))).* from public.furnishing_projects source
where source.id='99600000-0000-4000-8000-000000000040';
insert into public.furnishing_rooms
select (jsonb_populate_record(null::public.furnishing_rooms,to_jsonb(source)||jsonb_build_object(
  'id','99700000-0000-4000-8000-000000000041',
  'project_id','99700000-0000-4000-8000-000000000040'
))).* from public.furnishing_rooms source
where source.id='99600000-0000-4000-8000-000000000041';
insert into public.furnishing_plans
select (jsonb_populate_record(null::public.furnishing_plans,to_jsonb(source)||jsonb_build_object(
  'id','99700000-0000-4000-8000-000000000050',
  'project_id','99700000-0000-4000-8000-000000000040','status','approved'
))).* from public.furnishing_plans source
where source.project_id='99600000-0000-4000-8000-000000000040';
update public.furnishing_projects set current_plan_version_id='99700000-0000-4000-8000-000000000050'
where id='99700000-0000-4000-8000-000000000040';
insert into public.fs008d_project_catalog_snapshots
select (jsonb_populate_record(null::public.fs008d_project_catalog_snapshots,to_jsonb(source)||jsonb_build_object(
  'id','99700000-0000-4000-8000-000000000060',
  'project_id','99700000-0000-4000-8000-000000000040',
  'approved_plan_id','99700000-0000-4000-8000-000000000050',
  'source_idempotency_key','fsux9-procurement-generated-quantity-snapshot','archived_at',null
))).* from public.fs008d_project_catalog_snapshots source
where source.project_id='99600000-0000-4000-8000-000000000040';
insert into public.fs008d_snapshot_items
select (jsonb_populate_record(null::public.fs008d_snapshot_items,to_jsonb(source)||jsonb_build_object(
  'id','99700000-0000-4000-8000-000000000061',
  'snapshot_id','99700000-0000-4000-8000-000000000060',
  'project_id','99700000-0000-4000-8000-000000000040',
  'room_id','99700000-0000-4000-8000-000000000041','archived_at',null
))).* from public.fs008d_snapshot_items source
where source.project_id='99600000-0000-4000-8000-000000000040';

-- A separately scoped project/snapshot pair proves cross-workspace lineage fails closed.
insert into public.furnishing_projects
select (jsonb_populate_record(null::public.furnishing_projects,to_jsonb(source)||jsonb_build_object(
  'id','99700000-0000-4000-8000-000000000140','workspace_id','fec193f8-c180-47c0-bcb5-71fb2a910f15',
  'name','FS-UX-009 wrong-workspace procurement proof','lifecycle_status','approved',
  'current_plan_version_id',null,'archived_at',null
))).* from public.furnishing_projects source
where source.id='99600000-0000-4000-8000-000000000040';
insert into public.furnishing_plans
select (jsonb_populate_record(null::public.furnishing_plans,to_jsonb(source)||jsonb_build_object(
  'id','99700000-0000-4000-8000-000000000150',
  'project_id','99700000-0000-4000-8000-000000000140','status','approved'
))).* from public.furnishing_plans source
where source.project_id='99600000-0000-4000-8000-000000000040';
update public.furnishing_projects set current_plan_version_id='99700000-0000-4000-8000-000000000150'
where id='99700000-0000-4000-8000-000000000140';
insert into public.fs008d_project_catalog_snapshots
select (jsonb_populate_record(null::public.fs008d_project_catalog_snapshots,to_jsonb(source)||jsonb_build_object(
  'id','99700000-0000-4000-8000-000000000160',
  'project_id','99700000-0000-4000-8000-000000000140',
  'approved_plan_id','99700000-0000-4000-8000-000000000150',
  'source_idempotency_key','fsux9-procurement-wrong-workspace-snapshot','archived_at',null
))).* from public.fs008d_project_catalog_snapshots source
where source.project_id='99600000-0000-4000-8000-000000000040';

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='b89c4f4a-8a80-45a4-839c-30deab45fd3a';

do $$
declare
  snapshot_id uuid;
  revision bigint;
  command jsonb;
  created jsonb;
  replayed jsonb;
  v_baseline_id uuid;
  expected_quantity numeric;
  actual_quantity numeric;
  failure text;
begin
  select id,plan_revision into snapshot_id,revision
  from public.fs008d_project_catalog_snapshots
  where project_id='99700000-0000-4000-8000-000000000040' and archived_at is null;
  command:=jsonb_build_object(
    'source_kind','catalog_snapshot','source_id',snapshot_id,
    'expected_source_version',revision,
    'idempotency_key','fsux9-procurement-generated-quantity',
    'correlation_id','99600000-0000-4000-8000-000000000091'
  );
  created:=public.create_or_replay_procurement_baseline(command);
  replayed:=public.create_or_replay_procurement_baseline(command);
  v_baseline_id:=(created->>'id')::uuid;
  if created->>'status'<>'created' or replayed->>'status'<>'replayed'
    or replayed->>'id'<>created->>'id'
  then raise exception 'PROCUREMENT_CREATE_REPLAY_FAILED';end if;
  if (select count(*) from public.furnishing_procurement_baselines baseline where baseline.id=v_baseline_id)<>1
    or (select count(*) from public.furnishing_procurement_lines line where line.baseline_id=v_baseline_id)<>1
  then raise exception 'PROCUREMENT_DUPLICATE_BASELINE';end if;
  select item.quantity, line.procurement_quantity
  into expected_quantity,actual_quantity
  from public.fs008d_snapshot_items item
  join public.furnishing_procurement_lines line on line.source_snapshot_item_id=item.id
  where line.baseline_id=v_baseline_id;
  if actual_quantity is distinct from expected_quantity
    or (created->'lines'->0->>'procurementQuantity')::numeric is distinct from expected_quantity
  then raise exception 'PROCUREMENT_GENERATED_QUANTITY_MISMATCH';end if;

  begin
    perform public.create_or_replay_procurement_baseline(command||jsonb_build_object(
      'expected_source_version',revision+1));
    raise exception 'EXPECTED_REPLAY_CONFLICT';
  exception when others then
    failure:=sqlerrm;
    if failure='EXPECTED_REPLAY_CONFLICT' or failure not like '%PROCUREMENT_BASELINE_REPLAY_CONFLICT%'
    then raise;end if;
  end;
end $$;

reset role;
delete from public.furnishing_procurement_events
where baseline_id in(select id from public.furnishing_procurement_baselines
  where project_id='99700000-0000-4000-8000-000000000040');
delete from public.furnishing_procurement_lines
where baseline_id in(select id from public.furnishing_procurement_baselines
  where project_id='99700000-0000-4000-8000-000000000040');
delete from public.furnishing_procurement_baselines
where project_id='99700000-0000-4000-8000-000000000040';
create or replace function pg_temp.fail_procurement_audit() returns trigger language plpgsql as
  'begin raise exception ''FSUX9_FORCED_AUDIT_FAILURE'';end';
create trigger fsux9_force_audit_failure before insert on public.furnishing_procurement_events
  for each row execute function pg_temp.fail_procurement_audit();

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='b89c4f4a-8a80-45a4-839c-30deab45fd3a';
do $$declare failure text;begin
  begin
    perform public.create_or_replay_procurement_baseline(jsonb_build_object(
      'source_kind','catalog_snapshot','source_id','99700000-0000-4000-8000-000000000060',
      'expected_source_version',(select plan_revision from public.fs008d_project_catalog_snapshots where id='99700000-0000-4000-8000-000000000060'),
      'idempotency_key','fsux9-procurement-forced-audit-failure',
      'correlation_id','99600000-0000-4000-8000-000000000093'));
    raise exception 'EXPECTED_AUDIT_FAILURE';
  exception when others then
    failure:=sqlerrm;
    if failure='EXPECTED_AUDIT_FAILURE' or failure not like '%FSUX9_FORCED_AUDIT_FAILURE%'
    then raise;end if;
  end;
end $$;
reset role;
drop trigger fsux9_force_audit_failure on public.furnishing_procurement_events;
do $$begin
  if exists(select 1 from public.furnishing_procurement_baselines where project_id='99700000-0000-4000-8000-000000000040')
    or exists(select 1 from public.furnishing_procurement_lines line join public.furnishing_procurement_baselines baseline on baseline.id=line.baseline_id where baseline.project_id='99700000-0000-4000-8000-000000000040')
  then raise exception 'PROCUREMENT_AUDIT_FAILURE_NOT_ATOMIC';end if;
end $$;

set local role authenticated;
set local request.jwt.claim.role='authenticated';
set local request.jwt.claim.sub='b89c4f4a-8a80-45a4-839c-30deab45fd3a';
do $$declare failure text;begin
  begin
    perform public.create_or_replay_procurement_baseline(jsonb_build_object(
      'source_kind','catalog_snapshot','source_id','99700000-0000-4000-8000-000000000060',
      'expected_source_version',(select plan_revision+1 from public.fs008d_project_catalog_snapshots where id='99700000-0000-4000-8000-000000000060'),
      'idempotency_key','fsux9-procurement-stale-denial',
      'correlation_id','99600000-0000-4000-8000-000000000094'));
    raise exception 'EXPECTED_STALE_DENIAL';
  exception when others then
    failure:=sqlerrm;
    if failure='EXPECTED_STALE_DENIAL' or failure not like '%PROCUREMENT_SOURCE_VERSION_STALE%'
    then raise;end if;
  end;
end $$;

do $$declare failure text;begin
  begin
    perform public.create_or_replay_procurement_baseline(jsonb_build_object(
      'source_kind','catalog_snapshot','source_id','99700000-0000-4000-8000-000000000160',
      'expected_source_version',(select plan_revision from public.fs008d_project_catalog_snapshots where id='99700000-0000-4000-8000-000000000160'),
      'idempotency_key','fsux9-procurement-wrong-workspace',
      'correlation_id','99600000-0000-4000-8000-000000000095'));
    raise exception 'EXPECTED_WORKSPACE_DENIAL';
  exception when others then
    failure:=sqlerrm;
    if failure='EXPECTED_WORKSPACE_DENIAL' or failure not like '%PROCUREMENT_SOURCE_SCOPE_INVALID%'
    then raise;end if;
  end;
end $$;

set local request.jwt.claim.sub='b1b72f07-fe0b-4e37-9ff3-08d570a0ee49';
do $$begin
  begin
    perform public.create_or_replay_procurement_baseline(jsonb_build_object(
      'source_kind','catalog_snapshot','source_id',(select id from public.fs008d_project_catalog_snapshots where project_id='99700000-0000-4000-8000-000000000040' and archived_at is null),
      'expected_source_version',(select plan_revision from public.fs008d_project_catalog_snapshots where project_id='99700000-0000-4000-8000-000000000040' and archived_at is null),
      'idempotency_key','fsux9-procurement-owner-denied',
      'correlation_id','99600000-0000-4000-8000-000000000092'));
    raise exception 'EXPECTED_UNAUTHORIZED_DENIAL';
  exception when insufficient_privilege then null;
  end;
end $$;

rollback;
