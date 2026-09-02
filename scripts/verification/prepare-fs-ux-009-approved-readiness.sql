\set ON_ERROR_STOP on
begin;

insert into public.fsux5_design_versions(
  id,project_id,version_number,state,optimistic_version,snapshot_digest,created_by,approved_at
) values(
  '99700000-0000-4000-8000-000000000070','99700000-0000-4000-8000-000000000040',
  1,'approved',1,'fsux9-procurement-resume-design','b1b72f07-fe0b-4e37-9ff3-08d570a0ee49',now()
);
insert into public.furnishing_budgets(
  id,project_id,target_amount_minor,currency,status,design_version_id,version_number,
  lifecycle_status,product_subtotal_minor,estimated_total_minor,calculation,
  optimistic_version,approved_at
) select
  '99700000-0000-4000-8000-000000000071','99700000-0000-4000-8000-000000000040',
  baseline.estimated_total_minor,baseline.currency,'approved',
  '99700000-0000-4000-8000-000000000070',1,'approved',
  baseline.estimated_subtotal_minor,baseline.estimated_total_minor,
  jsonb_build_object('controlledPrerequisite',true),1,now()
from public.furnishing_procurement_baselines baseline
where baseline.project_id='99700000-0000-4000-8000-000000000040' and baseline.archived_at is null;
insert into public.fsux5_approval_snapshots(
  id,project_id,design_version_id,budget_id,property_id,snapshot,snapshot_digest,
  approved_by,correlation_id
) select
  '99700000-0000-4000-8000-000000000072',project.id,
  '99700000-0000-4000-8000-000000000070','99700000-0000-4000-8000-000000000071',
  project.property_id,jsonb_build_object('controlledPrerequisite',true),
  'fsux9-procurement-resume-approval','b1b72f07-fe0b-4e37-9ff3-08d570a0ee49',
  '99700000-0000-4000-8000-000000000090'
from public.furnishing_projects project
where project.id='99700000-0000-4000-8000-000000000040';

insert into public.fsux6_procurement_versions(
  id,baseline_id,version_number,state,source_design_digest,source_budget_digest,
  optimistic_version,product_subtotal_minor,estimated_total_minor,
  approved_budget_minor,currency,created_by,submitted_by,submitted_at,approved_by,approved_at
) select
  '99700000-0000-4000-8000-000000000080',baseline.id,1,'approved',
  'fsux9-procurement-resume-design','fsux9-procurement-resume-budget',1,
  baseline.estimated_subtotal_minor,baseline.estimated_total_minor,
  baseline.estimated_total_minor,baseline.currency,
  'b89c4f4a-8a80-45a4-839c-30deab45fd3a','b89c4f4a-8a80-45a4-839c-30deab45fd3a',now(),
  (select id from public.profiles where email like 'fsux9-procurement-reviewer-%@example.invalid' order by created_at desc limit 1),now()
from public.furnishing_procurement_baselines baseline
where baseline.project_id='99700000-0000-4000-8000-000000000040' and baseline.archived_at is null;

update public.furnishing_procurement_lines
set readiness_version_id='99700000-0000-4000-8000-000000000080',
  product_version_id='99600000-0000-4000-8000-000000000011',
  retailer_id='43d03eb4-1993-4fb4-8e78-0dd804953678',
  retailer_sku='FSUX9-CONTROLLED',variant='Controlled',priority='essential',
  fulfillment_required=true,availability_state='available',price_freshness='current',
  resolution_state='ready',status='authorized'
where baseline_id=(select id from public.furnishing_procurement_baselines
  where project_id='99700000-0000-4000-8000-000000000040' and archived_at is null);

insert into public.fsux6_readiness_snapshots(
  id,baseline_id,readiness_version_id,source_design_snapshot_id,source_budget_id,
  snapshot,snapshot_digest,policy_version,approved_by,correlation_id,idempotency_key
) select
  '99700000-0000-4000-8000-000000000081',baseline.id,
  '99700000-0000-4000-8000-000000000080','99700000-0000-4000-8000-000000000072',
  '99700000-0000-4000-8000-000000000071',
  jsonb_build_object('baselineId',baseline.id,'noOrderPlaced',true,'externalEffects',false),
  'fsux9-procurement-resume-readiness','fs-ux-006-v1',
  (select id from public.profiles where email like 'fsux9-procurement-reviewer-%@example.invalid' order by created_at desc limit 1),
  '99700000-0000-4000-8000-000000000090','fsux9-procurement-resume-readiness'
from public.furnishing_procurement_baselines baseline
where baseline.project_id='99700000-0000-4000-8000-000000000040' and baseline.archived_at is null;
update public.furnishing_procurement_baselines
set current_readiness_version_id='99700000-0000-4000-8000-000000000080',
  readiness_status='approved',status='authorized'
where project_id='99700000-0000-4000-8000-000000000040' and archived_at is null;

commit;
