-- FS-UX-009: let PostgreSQL derive procurement_quantity for snapshot lines.
begin;

create or replace function public.create_or_replay_procurement_baseline(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  a uuid:=auth.uid();
  sid uuid;
  expected bigint;
  correlation uuid;
  command_key text:=left(trim(p_input->>'idempotency_key'),200);
  s public.fs008d_project_catalog_snapshots%rowtype;
  p public.furnishing_projects%rowtype;
  b public.furnishing_procurement_baselines%rowtype;
  line_count integer;
  currency_code text;
  subtotal bigint;
  shipping bigint;
  quantities jsonb;
begin
  if a is null or not public.is_admin() then
    raise exception 'PROCUREMENT_ADMIN_REQUIRED' using errcode='42501';
  end if;
  perform public.assert_fs008g_procurement_mutation_enabled();
  if p_input->>'source_kind'<>'catalog_snapshot' then
    raise exception 'PROCUREMENT_SNAPSHOT_SOURCE_REQUIRED';
  end if;
  begin
    sid:=(p_input->>'source_id')::uuid;
    expected:=(p_input->>'expected_source_version')::bigint;
    correlation:=(p_input->>'correlation_id')::uuid;
  exception when others then
    raise exception 'PROCUREMENT_BASELINE_COMMAND_INVALID';
  end;
  if length(command_key)<8 then raise exception 'PROCUREMENT_BASELINE_COMMAND_INVALID';end if;

  select snapshot.* into s
  from public.fs008d_project_catalog_snapshots snapshot
  where snapshot.id=sid and snapshot.archived_at is null
  for update;
  if not found then raise exception 'PROCUREMENT_AUTHORITATIVE_SNAPSHOT_REQUIRED';end if;

  select project.* into p
  from public.furnishing_projects project
  where project.id=s.project_id
  for update;
  if not found or s.tenant_id is distinct from p.workspace_id
    or s.approved_plan_id is distinct from p.current_plan_version_id
  then raise exception 'PROCUREMENT_SOURCE_SCOPE_INVALID';end if;
  if coalesce(s.content_hash,'')='' or not exists(
    select 1 from public.fs008d_snapshot_items item
    where item.snapshot_id=s.id and item.archived_at is null
  ) then raise exception 'PROCUREMENT_SNAPSHOT_NOT_NORMALIZED';end if;
  if exists(
    select 1
    from public.fs008d_snapshot_items item
    left join public.furnishing_product_offers offer on offer.id=item.retailer_offer_id
    where item.snapshot_id=s.id and(
      item.archived_at is not null
      or item.tenant_id is distinct from p.workspace_id
      or item.project_id is distinct from p.id
      or offer.product_id is distinct from item.product_id
      or item.observed_price_minor is null
      or item.extended_product_cost_minor<>item.observed_price_minor*item.quantity
    )
  ) then raise exception 'PROCUREMENT_SNAPSHOT_NOT_NORMALIZED';end if;

  perform pg_advisory_xact_lock(hashtextextended(p.id::text,0));
  select baseline.* into b
  from public.furnishing_procurement_baselines baseline
  where baseline.project_id=p.id and baseline.archived_at is null
  for update;
  if found then
    if b.source_kind<>'catalog_snapshot' or b.source_catalog_snapshot_id<>s.id
      or b.source_plan_id is not null or b.source_plan_version<>expected
      or b.source_hash<>s.content_hash or b.idempotency_key<>command_key
    then raise exception 'PROCUREMENT_BASELINE_REPLAY_CONFLICT';end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'lineId',line.id,'procurementQuantity',line.procurement_quantity
    ) order by line.id),'[]'::jsonb) into quantities
    from public.furnishing_procurement_lines line
    where line.baseline_id=b.id and line.archived_at is null;
    return jsonb_build_object('status','replayed','id',b.id,'version',b.version,
      'source_hash',b.source_hash,'lines',quantities);
  end if;
  if s.plan_revision<>expected then raise exception 'PROCUREMENT_SOURCE_VERSION_STALE';end if;

  select min(item.currency),sum(item.extended_product_cost_minor),sum(item.delivery_minor)
  into currency_code,subtotal,shipping
  from public.fs008d_snapshot_items item
  where item.snapshot_id=s.id and item.archived_at is null;

  insert into public.furnishing_procurement_baselines(
    workspace_id,property_id,project_id,source_kind,source_catalog_snapshot_id,
    source_plan_version,source_snapshot,source_hash,currency,status,
    estimated_subtotal_minor,estimated_shipping_minor,estimated_tax_minor,
    estimated_total_minor,idempotency_key,created_by
  ) values(
    p.workspace_id,p.property_id,p.id,'catalog_snapshot',s.id,expected,
    jsonb_build_object('schemaVersion','fs008g-c8c-v1','snapshotId',s.id,
      'contentHash',s.content_hash),s.content_hash,currency_code,'draft',subtotal,
    shipping,0,subtotal+shipping,command_key,a
  ) returning * into b;

  insert into public.furnishing_procurement_lines(
    baseline_id,source_line_kind,source_snapshot_item_id,room_id,product_id,
    selected_offer_id,category,description,planned_quantity,
    existing_inventory_quantity,estimated_unit_cost_minor,
    estimated_line_cost_minor,currency,status,source_snapshot
  )
  select b.id,'snapshot_item',item.id,item.room_id,item.product_id,
    item.retailer_offer_id,product.category,product.name,item.quantity,0,
    item.observed_price_minor,item.extended_product_cost_minor,item.currency,'planned',
    jsonb_build_object('stableItemId',item.stable_item_id,
      'contentHash',item.content_hash,'deliveryMinor',item.delivery_minor,
      'sourceLineage',item.source_lineage)
  from public.fs008d_snapshot_items item
  join public.furnishing_products product on product.id=item.product_id
  where item.snapshot_id=s.id and item.archived_at is null;
  get diagnostics line_count=row_count;
  if line_count=0 then raise exception 'PROCUREMENT_SOURCE_HAS_NO_LINES';end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'lineId',line.id,'procurementQuantity',line.procurement_quantity
  ) order by line.id),'[]'::jsonb) into quantities
  from public.furnishing_procurement_lines line
  where line.baseline_id=b.id and line.archived_at is null;

  insert into public.furnishing_procurement_events(
    baseline_id,workspace_id,property_id,project_id,actor_id,correlation_id,
    event_type,resulting_version,policy_version,related_type,related_id,payload
  ) values(
    b.id,p.workspace_id,p.property_id,p.id,a,correlation,
    'procurement_baseline_generated',1,'fs008g-c8c-v1','catalog_snapshot',s.id,
    jsonb_build_object('sourceHash',s.content_hash,'lineCount',line_count,
      'externalEffects',false)
  );
  return jsonb_build_object('status','created','id',b.id,'version',1,
    'source_hash',s.content_hash,'lines',quantities);
end $$;

commit;
