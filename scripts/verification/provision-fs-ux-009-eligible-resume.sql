\set ON_ERROR_STOP on
begin;

alter table public.furnishing_activation_capabilities disable trigger fsux8_capability_sequence_guard;
update public.furnishing_activation_releases set global_state='internal',global_kill_switch=false,
  configuration_valid=true where milestone='FS-008A';
insert into public.furnishing_activation_workspaces(
  release_id,workspace_id,enabled,kill_switch,cohort,effective_from,expires_at,
  approved_by,reason,optimistic_version
) select id,'ffc03a5f-6578-49e5-8751-3bc3c36fce9e',true,false,'internal',now(),now()+interval '1 day',
  'b1b72f07-fe0b-4e37-9ff3-08d570a0ee49','FS-UX-009 eligible resume',1
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
values('99600000-0000-4000-8000-000000000001','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  '38ed6a6f-e3e1-48da-ae95-d82031954564','b1b72f07-fe0b-4e37-9ff3-08d570a0ee49','active');
insert into public.commercial_entitlements(
  id,tenant_id,customer_account_id,capability_code,resource_scope_type,resource_scope_id,
  source,source_reference_id,offer_code,offer_version,status,effective_from
) values('99600000-0000-4000-8000-000000000002','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  '38ed6a6f-e3e1-48da-ae95-d82031954564','furnishing.project.access','workspace',
  'ffc03a5f-6578-49e5-8751-3bc3c36fce9e','offer_activation','fsux9-eligible-resume',
  'FS-DESIGN',1,'active',now());

insert into public.furnishing_products(
  id,workspace_id,name,description,product_type,category,status,scope,tags,created_by,updated_by,
  source_type,revision
) values('99600000-0000-4000-8000-000000000010','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  'FS-UX-009 Eligible Bed','Fresh controlled eligibility proof','bed','Beds & Frames','approved',
  'workspace',array['fs-ux-009-controlled'],'b89c4f4a-8a80-45a4-839c-30deab45fd3a',
  'b89c4f4a-8a80-45a4-839c-30deab45fd3a','manual',1);
insert into public.furnishing_product_versions(
  id,product_id,workspace_id,version,lifecycle_status,product_snapshot,change_reason,correlation_id,
  idempotency_key,created_by,approved_by,approved_at
) values('99600000-0000-4000-8000-000000000011','99600000-0000-4000-8000-000000000010',
  'ffc03a5f-6578-49e5-8751-3bc3c36fce9e',1,'approved',
  jsonb_build_object('name','FS-UX-009 Eligible Bed','status','approved'),
  'Controlled eligibility proof','99600000-0000-4000-8000-000000000090','fsux9-eligible-product-v1',
  'b89c4f4a-8a80-45a4-839c-30deab45fd3a','b89c4f4a-8a80-45a4-839c-30deab45fd3a',now());
insert into public.furnishing_product_offers(
  id,product_id,retailer_id,product_url,listed_price_minor,shipping_price_minor,currency,
  availability,last_verified_at,status,workspace_id,source_type
) values('99600000-0000-4000-8000-000000000012','99600000-0000-4000-8000-000000000010',
  '43d03eb4-1993-4fb4-8e78-0dd804953678','https://example.invalid/fsux9-eligible-bed',120000,0,
  'USD','in_stock',now(),'active','ffc03a5f-6578-49e5-8751-3bc3c36fce9e','manual');
insert into public.furnishing_catalog_approvals(
  id,workspace_id,target_type,target_id,status,target_snapshot,snapshot_hash,reason,correlation_id,
  idempotency_key,approved_by
) values('99600000-0000-4000-8000-000000000013','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  'offer','99600000-0000-4000-8000-000000000012','approved','{}','fsux9-eligible-offer',
  'Controlled eligibility proof','99600000-0000-4000-8000-000000000090',
  'fsux9-eligible-offer','b89c4f4a-8a80-45a4-839c-30deab45fd3a');
insert into public.furnishing_product_offer_assignments(
  id,workspace_id,product_id,offer_id,role,rank,approval_id,assigned_by
) values('99600000-0000-4000-8000-000000000014','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  '99600000-0000-4000-8000-000000000010','99600000-0000-4000-8000-000000000012',
  'preferred',1,'99600000-0000-4000-8000-000000000013','b89c4f4a-8a80-45a4-839c-30deab45fd3a');
update public.furnishing_products set preferred_offer_id='99600000-0000-4000-8000-000000000012'
where id='99600000-0000-4000-8000-000000000010';

insert into public.furnishing_quantity_rules(id,workspace_id,name,rule_type,multiplier,minimum,maximum,rounding)
values('99600000-0000-4000-8000-000000000020','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  'FSUX9 eligible one per bedroom','fixed',1,1,1,'nearest');
insert into public.furnishing_room_requirements(
  id,workspace_id,scope,key,name,category_id,default_room_type,requirement_type,lifecycle_status,created_by
) values('99600000-0000-4000-8000-000000000021','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  'workspace','fsux9-eligible-bed','Eligible bed','3b77bae4-96ab-4999-a0cc-a9518d236446','bedroom',
  'furnishing','approved','b89c4f4a-8a80-45a4-839c-30deab45fd3a');
insert into public.furnishing_room_packages(
  id,workspace_id,name,room_type,tier,description,lifecycle_status,current_version_id,created_by,scope
) values('99600000-0000-4000-8000-000000000022','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  'FSUX9 Eligible Bedroom','bedroom','essential','Fresh controlled eligibility proof','approved',null,
  'b89c4f4a-8a80-45a4-839c-30deab45fd3a','workspace');
insert into public.furnishing_room_package_versions(
  id,room_package_id,version_number,lifecycle_status,estimated_budget_minor,currency,created_by,approved_by,approved_at
) values('99600000-0000-4000-8000-000000000023','99600000-0000-4000-8000-000000000022',1,
  'approved',120000,'USD','b89c4f4a-8a80-45a4-839c-30deab45fd3a',
  'b89c4f4a-8a80-45a4-839c-30deab45fd3a',now());
update public.furnishing_room_packages set current_version_id='99600000-0000-4000-8000-000000000023'
where id='99600000-0000-4000-8000-000000000022';
insert into public.furnishing_room_package_items(
  id,room_package_version_id,requirement_key,category,recommended_product_id,quantity_rule_id,
  required,priority,substitution_policy,sort_order,room_requirement_id
) values('99600000-0000-4000-8000-000000000024','99600000-0000-4000-8000-000000000023',
  'fsux9-eligible-bed','Beds & Frames','99600000-0000-4000-8000-000000000010',
  '99600000-0000-4000-8000-000000000020',true,'essential','allowed',0,
  '99600000-0000-4000-8000-000000000021');

insert into public.furnishing_packages(
  id,name,description,property_type,style,budget_tier,starting_budget,workspace_id,tier,
  lifecycle_status,governance_scope,created_by
) values('99600000-0000-4000-8000-000000000030','FSUX9 Eligible Property Package',
  'Fresh controlled package eligibility proof','single_family','controlled','essential',1200,
  'ffc03a5f-6578-49e5-8751-3bc3c36fce9e','essential','approved','workspace',
  'b89c4f4a-8a80-45a4-839c-30deab45fd3a');
insert into public.furnishing_package_versions(
  id,furnishing_package_id,version_number,lifecycle_status,target_property_type,
  estimated_budget_low_minor,estimated_budget_high_minor,currency,approved_at,created_by,approved_by
) values('99600000-0000-4000-8000-000000000031','99600000-0000-4000-8000-000000000030',1,
  'approved','single_family',120000,120000,'USD',now(),'b89c4f4a-8a80-45a4-839c-30deab45fd3a',
  'b89c4f4a-8a80-45a4-839c-30deab45fd3a');
update public.furnishing_packages set current_version_id='99600000-0000-4000-8000-000000000031'
where id='99600000-0000-4000-8000-000000000030';
insert into public.furnishing_package_room_composition(
  id,furnishing_package_version_id,room_package_version_id,room_type,quantity_rule_id,sort_order
) values('99600000-0000-4000-8000-000000000032','99600000-0000-4000-8000-000000000031',
  '99600000-0000-4000-8000-000000000023','bedroom','99600000-0000-4000-8000-000000000020',0);
insert into public.furnishing_package_validation_runs(
  id,workspace_id,package_kind,package_version_id,status,issues,composition_hash,validated_by,correlation_id
) values('99600000-0000-4000-8000-000000000033','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  'property','99600000-0000-4000-8000-000000000031','valid','[]','fsux9-eligible-package',
  'b89c4f4a-8a80-45a4-839c-30deab45fd3a','99600000-0000-4000-8000-000000000090');
insert into public.furnishing_package_governance_approvals(
  id,workspace_id,package_kind,package_version_id,validation_run_id,composition_snapshot,
  composition_hash,reason,correlation_id,idempotency_key,approved_by
) values('99600000-0000-4000-8000-000000000034','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  'property','99600000-0000-4000-8000-000000000031','99600000-0000-4000-8000-000000000033',
  '{}','fsux9-eligible-package','Fresh controlled eligibility proof',
  '99600000-0000-4000-8000-000000000090','fsux9-eligible-package',
  'b89c4f4a-8a80-45a4-839c-30deab45fd3a');

insert into public.furnishing_projects(
  id,workspace_id,property_id,name,lifecycle_status,project_type,target_budget_minor,
  furnishing_package_version_id,design_profile_version_id,budget_priority,plan_status,
  design_workspace_status,optimistic_version,created_by
) values('99600000-0000-4000-8000-000000000040','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  '5493cd81-d120-4930-bf52-5ac24b3cd308','C8-D Isolated Furnishing Lifecycle - FS-UX-009 eligibility','planning',
  'full_property',2500000,'99600000-0000-4000-8000-000000000031',
  'a86bb9f6-30fb-4d66-95db-edbe190369c5','balanced','not_generated','draft',1,
  'b1b72f07-fe0b-4e37-9ff3-08d570a0ee49');
insert into public.furnishing_rooms(id,project_id,room_type,name,ordinal,status,sort_order)
values('99600000-0000-4000-8000-000000000041','99600000-0000-4000-8000-000000000040',
  'bedroom','Bedroom 1',1,'not_started',0);
insert into public.furnishing_controlled_fixture_designations(
  id,project_id,workspace_id,controlled_customer_account_id,controlled_property_id,tenant_id,
  controlled_run_id,candidate_commit,correlation_id,purpose,created_by,created_at,expires_at
) values('99600000-0000-4000-8000-000000000042','99600000-0000-4000-8000-000000000040',
  'ffc03a5f-6578-49e5-8751-3bc3c36fce9e','38ed6a6f-e3e1-48da-ae95-d82031954564',
  '5493cd81-d120-4930-bf52-5ac24b3cd308','ffc03a5f-6578-49e5-8751-3bc3c36fce9e',
  '99600000-0000-4000-8000-000000000043','local-fs008g-finalization',
  '99600000-0000-4000-8000-000000000090','Fresh eligible plan-generation resume',
  'b1b72f07-fe0b-4e37-9ff3-08d570a0ee49',now()-interval '1 minute',now()+interval '1 day');

commit;
