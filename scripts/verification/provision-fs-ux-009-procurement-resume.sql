\set ON_ERROR_STOP on
begin;

alter table public.furnishing_activation_capabilities disable trigger fsux8_capability_sequence_guard;
update public.furnishing_activation_releases
set global_state='internal',global_kill_switch=false,configuration_valid=true
where milestone='FS-008A';
insert into public.furnishing_activation_workspaces(
  release_id,workspace_id,enabled,kill_switch,cohort,effective_from,expires_at,
  approved_by,reason,optimistic_version
) select id,'ffc03a5f-6578-49e5-8751-3bc3c36fce9e',true,false,'internal',now(),now()+interval '1 day',
  'b89c4f4a-8a80-45a4-839c-30deab45fd3a','FS-UX-009 procurement resume',1
from public.furnishing_activation_releases where milestone='FS-008A';
insert into public.furnishing_activation_capabilities(
  release_id,capability,enabled,optimistic_version,verification_state,verified_at,verified_by,verification_event_id
) select release.id,capability,true,1,'verified',now(),'b1b72f07-fe0b-4e37-9ff3-08d570a0ee49',
  '99400000-0000-4000-8000-000000000001'
from public.furnishing_activation_releases release
cross join unnest(array['catalog_viewing','design_workspace','budgeting','procurement_readiness']) capability
where release.milestone='FS-008A';
alter table public.furnishing_activation_capabilities enable trigger fsux8_capability_sequence_guard;

insert into public.customer_account_memberships(id,tenant_id,customer_account_id,profile_id,status)
values('99700000-0000-4000-8000-000000000001','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  '38ed6a6f-e3e1-48da-ae95-d82031954564','b1b72f07-fe0b-4e37-9ff3-08d570a0ee49','active');
insert into public.commercial_entitlements(
  id,tenant_id,customer_account_id,capability_code,resource_scope_type,resource_scope_id,
  source,source_reference_id,offer_code,offer_version,status,effective_from
) values('99700000-0000-4000-8000-000000000002','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  '38ed6a6f-e3e1-48da-ae95-d82031954564','furnishing.project.access','workspace',
  'ffc03a5f-6578-49e5-8751-3bc3c36fce9e','offer_activation','fsux9-procurement-resume',
  'FS-DESIGN',1,'active',now());

update public.furnishing_products set status='approved',retired_at=null,retirement_reason=null
where id='99600000-0000-4000-8000-000000000010';
update public.furnishing_product_offers set status='active',availability='in_stock'
where id='99600000-0000-4000-8000-000000000012';
update public.furnishing_product_offer_assignments set revoked_at=null
where id='99600000-0000-4000-8000-000000000014';

insert into public.furnishing_projects
select (jsonb_populate_record(null::public.furnishing_projects,to_jsonb(source)||jsonb_build_object(
  'id','99700000-0000-4000-8000-000000000040',
  'name','C8-D Isolated Furnishing Lifecycle - FS-UX-009 procurement resume',
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
  'source_idempotency_key','fsux9-procurement-resume-snapshot','archived_at',null
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
insert into public.furnishing_controlled_fixture_designations(
  id,project_id,workspace_id,controlled_customer_account_id,controlled_property_id,tenant_id,
  controlled_run_id,candidate_commit,correlation_id,purpose,created_by,created_at,expires_at
) values('99700000-0000-4000-8000-000000000042','99700000-0000-4000-8000-000000000040',
  'ffc03a5f-6578-49e5-8751-3bc3c36fce9e','38ed6a6f-e3e1-48da-ae95-d82031954564',
  '5493cd81-d120-4930-bf52-5ac24b3cd308','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  '99700000-0000-4000-8000-000000000043','local-fs008g-finalization',
  '99700000-0000-4000-8000-000000000090','FS-UX-009 procurement-through-installation resume',
  'b1b72f07-fe0b-4e37-9ff3-08d570a0ee49',now()-interval '1 minute',now()+interval '1 day');

commit;
