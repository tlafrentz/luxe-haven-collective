-- Complete the FS-UX-006 controlled transaction as the minimum snapshot-native
-- prerequisite for the disposable FS-UX-009 installation browser continuation.
do $$
declare
  baseline public.furnishing_procurement_baselines;
  line public.furnishing_procurement_lines;
  readiness public.fsux6_readiness_snapshots;
  snapshot_id uuid;
  snapshot_item_id uuid;
begin
  select value.* into baseline
  from public.furnishing_procurement_baselines value
  order by value.created_at desc limit 1 for update;
  select value.* into readiness
  from public.fsux6_readiness_snapshots value
  where value.baseline_id=baseline.id
  order by value.created_at desc limit 1;
  update public.fsux6_procurement_versions
  set state='approved'
  where id=readiness.readiness_version_id;
  update public.furnishing_procurement_baselines
  set current_readiness_version_id=readiness.readiness_version_id,
      readiness_status='approved'
  where id=baseline.id;

  select value.* into line
  from public.furnishing_procurement_lines value
  where value.baseline_id=baseline.id
    and value.readiness_version_id=readiness.readiness_version_id
  order by value.id limit 1 for update;

  insert into public.fs008d_project_catalog_snapshots(
    project_id,tenant_id,package_version_id,snapshot,content_hash,correlation_id
  ) values(
    baseline.project_id,baseline.workspace_id,gen_random_uuid(),'{}',
    'fsux9-installation-browser-native','fsux9-installation-browser-native'
  ) returning id into snapshot_id;
  insert into public.fs008d_snapshot_items(
    snapshot_id,tenant_id,project_id,stable_item_id,room_id,product_id,
    retailer_offer_id,quantity,observed_price_minor,extended_product_cost_minor,
    delivery_minor,currency,required,selection_state,source_lineage,content_hash
  ) values(
    snapshot_id,baseline.workspace_id,baseline.project_id,
    'fsux9-installation-browser-native',line.room_id,line.product_id,
    line.selected_offer_id,line.planned_quantity,line.estimated_unit_cost_minor,
    line.estimated_line_cost_minor,0,line.currency,true,'preferred','{}',
    'fsux9-installation-browser-native-item'
  ) returning id into snapshot_item_id;

  update public.furnishing_procurement_baselines
  set source_kind='catalog_snapshot',source_plan_id=null,
      source_catalog_snapshot_id=snapshot_id,fsux5_handoff_id=null,
      source_design_snapshot_id=null,source_budget_id=null
  where id=baseline.id;
  update public.furnishing_procurement_lines
  set source_line_kind='snapshot_item',source_plan_line_id=null,
      source_snapshot_item_id=snapshot_item_id
  where id=line.id;
end$$;
commit;
