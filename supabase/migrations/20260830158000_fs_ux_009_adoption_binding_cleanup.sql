-- FS-UX-009: bind adoption commands to their source product and clean controlled adoptions safely.
begin;

alter table public.furnishing_command_contexts
  drop constraint if exists furnishing_command_contexts_target_type_check;
alter table public.furnishing_command_contexts
  add constraint furnishing_command_contexts_target_type_check check (
    target_type in (
      'workspace','platform_product','import','product','offer','requirement',
      'package','package_version','room_package','room_package_version',
      'room_package_item','plan','selection','project','snapshot','baseline',
      'budget','batch','order','line','discrepancy','cleanup'
    )
  );

alter table public.furnishing_product_adoptions
  add column if not exists request_fingerprint text;

create or replace function public.adopt_furnishing_platform_product(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  actor uuid:=auth.uid();
  workspace uuid;
  source_id uuid;
  correlation uuid;
  command_key text;
  overrides jsonb;
  fingerprint text;
  source public.furnishing_products%rowtype;
  destination public.furnishing_products%rowtype;
  adoption public.furnishing_product_adoptions%rowtype;
  snapshot jsonb;
  digest text;
  source_offer record;
  new_offer uuid;
begin
  if actor is null or not public.is_admin() then
    raise exception 'FURNISHING_CATALOG_ADMIN_REQUIRED' using errcode='42501';
  end if;
  begin
    workspace:=(p_input->>'workspace_id')::uuid;
    source_id:=(p_input->>'source_product_id')::uuid;
    correlation:=(p_input->>'correlation_id')::uuid;
  exception when others then
    raise exception 'CATALOG_ADOPTION_COMMAND_INVALID';
  end;
  command_key:=left(trim(p_input->>'idempotency_key'),200);
  overrides:=coalesce(p_input->'workspace_overrides','{}'::jsonb);
  if length(command_key)<8
    or jsonb_typeof(overrides)<>'object'
    or overrides-'name'-'description'-'category_id'-'tags'-'style_tags'<>'{}'::jsonb
  then
    raise exception 'CATALOG_ADOPTION_COMMAND_INVALID';
  end if;
  fingerprint:=encode(digest(jsonb_build_object(
    'operation','catalog.product.adopt',
    'workspaceId',workspace,
    'sourceProductId',source_id,
    'workspaceOverrides',overrides,
    'correlationId',correlation
  )::text,'sha256'),'hex');

  perform public.authorize_controlled_furnishing_catalog_mutation(workspace);
  perform pg_advisory_xact_lock(hashtextextended(
    'furnishing-product-adoption-key:'||command_key,0
  ));
  select * into adoption
  from public.furnishing_product_adoptions
  where idempotency_key=command_key
  for update;
  if found then
    if adoption.workspace_id<>workspace
      or adoption.source_product_id<>source_id
      or adoption.workspace_overrides<>overrides
      or adoption.correlation_id<>correlation
      or (adoption.request_fingerprint is not null and adoption.request_fingerprint<>fingerprint)
    then
      raise exception 'CATALOG_ADOPTION_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object(
      'status','replayed',
      'workspaceProductId',adoption.workspace_product_id,
      'adoptionId',adoption.id,
      'requestFingerprint',coalesce(adoption.request_fingerprint,fingerprint)
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'furnishing-product-adoption:'||workspace::text||':'||source_id::text,0
  ));
  select * into source
  from public.furnishing_products
  where id=source_id and scope='platform' and workspace_id is null
  for share;
  if not found or source.status='archived' then
    raise exception 'CATALOG_ADOPTION_SOURCE_INVALID';
  end if;
  select p.* into destination
  from public.furnishing_products p
  where p.workspace_id=workspace
    and p.scope='workspace'
    and p.family_product_id=source.id
    and p.status not in('discontinued','archived')
  limit 1
  for update;
  if found then
    select * into adoption
    from public.furnishing_product_adoptions a
    where a.workspace_id=workspace
      and a.source_product_id=source_id
      and a.workspace_product_id=destination.id
    for update;
    if not found then raise exception 'CATALOG_ADOPTION_LINEAGE_MISSING'; end if;
    return jsonb_build_object(
      'status','existing',
      'workspaceProductId',destination.id,
      'adoptionId',adoption.id,
      'requestFingerprint',coalesce(adoption.request_fingerprint,fingerprint)
    );
  end if;

  snapshot:=to_jsonb(source);
  digest:=encode(digest(snapshot::text,'sha256'),'hex');
  insert into public.furnishing_products(
    workspace_id,name,description,product_type,category,subcategory,brand,
    manufacturer_part_number,status,scope,tags,created_by,updated_by,category_id,
    color,material,finish,dimensions,weight,assembly_required,indoor_outdoor,
    hospitality_attributes,style_tags,durability_type,replenishment_type,
    purchase_unit,units_per_purchase,usable_unit,family_product_id,source_type,
    source_import_id,source_sheet,source_row,imported_at
  ) values(
    workspace,coalesce(nullif(trim(overrides->>'name'),''),source.name),
    coalesce(overrides->>'description',source.description),source.product_type,
    source.category,source.subcategory,source.brand,source.manufacturer_part_number,
    'draft','workspace',case when overrides ? 'tags' then
      array(select jsonb_array_elements_text(overrides->'tags')) else source.tags end,
    actor,actor,coalesce((overrides->>'category_id')::uuid,source.category_id),
    source.color,source.material,source.finish,source.dimensions,source.weight,
    source.assembly_required,source.indoor_outdoor,source.hospitality_attributes,
    case when overrides ? 'style_tags' then
      array(select jsonb_array_elements_text(overrides->'style_tags')) else source.style_tags end,
    source.durability_type,source.replenishment_type,source.purchase_unit,
    source.units_per_purchase,source.usable_unit,source.id,'platform_adoption',
    source.source_import_id,source.source_sheet,source.source_row,source.imported_at
  ) returning * into destination;
  insert into public.furnishing_product_room_compatibility(product_id,room_type_id)
    select destination.id,room_type_id
    from public.furnishing_product_room_compatibility where product_id=source.id
    on conflict do nothing;
  insert into public.furnishing_product_specifications(
    product_id,specification_key,value_text,value_number,unit
  ) select destination.id,specification_key,value_text,value_number,unit
    from public.furnishing_product_specifications where product_id=source.id
    on conflict do nothing;
  for source_offer in
    select * from public.furnishing_product_offers
    where product_id=source.id and status<>'archived'
  loop
    insert into public.furnishing_product_offers(
      workspace_id,product_id,retailer_id,retailer_product_id,sku,product_url,
      listed_price_minor,shipping_price_minor,currency,availability,affiliate_url,
      last_verified_at,status,notes,source_type,source_import_id,source_sheet,
      source_row,imported_at
    ) values(
      workspace,destination.id,source_offer.retailer_id,
      source_offer.retailer_product_id,source_offer.sku,source_offer.product_url,
      source_offer.listed_price_minor,source_offer.shipping_price_minor,
      source_offer.currency,source_offer.availability,source_offer.affiliate_url,
      source_offer.last_verified_at,source_offer.status,source_offer.notes,
      'platform_adoption',source_offer.source_import_id,source_offer.source_sheet,
      source_offer.source_row,source_offer.imported_at
    ) returning id into new_offer;
  end loop;
  perform public.claim_furnishing_workspace_product_identity(
    destination.id,source.id,to_jsonb(destination)
  );
  insert into public.furnishing_product_adoptions(
    workspace_id,source_product_id,workspace_product_id,source_revision,
    source_digest,adopted_fields,workspace_overrides,idempotency_key,
    correlation_id,adopted_by,request_fingerprint
  ) values(
    workspace,source.id,destination.id,source.revision,digest,snapshot,overrides,
    command_key,correlation,actor,fingerprint
  ) returning * into adoption;
  insert into public.furnishing_catalog_activity(
    workspace_id,product_id,event_type,actor_id,metadata
  ) values(
    workspace,destination.id,'catalog_platform_product_adopted',actor,
    jsonb_build_object(
      'sourceProductId',source.id,'sourceRevision',source.revision,
      'sourceDigest',digest,'adoptionId',adoption.id,'correlationId',correlation,
      'requestFingerprint',fingerprint,'externalEffects',false
    )
  );
  return jsonb_build_object(
    'status','adopted','workspaceProductId',destination.id,
    'adoptionId',adoption.id,'sourceDigest',digest,
    'requestFingerprint',fingerprint
  );
end $$;

drop function if exists public.cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid);
create function public.cleanup_fs008g_c8_controlled_tenant(
  p_workspace_id uuid,
  p_wrong_workspace_id uuid,
  p_admin_id uuid,
  p_owner_id uuid,
  p_controlled_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  import_ids uuid[];
  platform_product_ids uuid[];
  adoption_ids uuid[];
  workspace_product_ids uuid[];
  offer_ids uuid[];
  removed_adoptions integer:=0;
  removed_workspace_products integer:=0;
  removed_platform_products integer:=0;
  removed_imports integer:=0;
  removed_contexts integer:=0;
  dependency text;
begin
  if auth.role()<>'service_role' then
    raise exception 'FS008G_FIXTURE_SERVICE_ROLE_REQUIRED' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'fsux9-controlled-run-cleanup:'||p_controlled_run_id::text,0
  ));
  perform 1 from public.owners
    where id in(p_workspace_id,p_wrong_workspace_id)
    order by id for update;
  if not exists(select 1 from public.owners where id=p_workspace_id)
    and not exists(select 1 from public.owners where id=p_wrong_workspace_id)
  then
    return jsonb_build_object(
      'status','already_cleaned','workspaceId',p_workspace_id,
      'adoptions',0,'workspaceProducts',0,'platformProducts',0,
      'imports',0,'commandContexts',0,'externalEffects',false
    );
  end if;
  if not exists(
    select 1
    from public.owners w
    join public.profiles o on o.id=w.profile_id
    join public.profiles a on a.id=p_admin_id
    where w.id=p_workspace_id
      and w.profile_id=p_owner_id
      and w.company_name like 'FS008G C8 %'
      and o.email like 'fs008g-c8-owner-%@example.invalid'
      and a.email like 'fs008g-c8-admin-%@example.invalid'
  ) then
    raise exception 'FS008G_FIXTURE_IDENTITY_INVALID';
  end if;
  if not exists(
    select 1 from public.owners w
    where w.id=p_wrong_workspace_id and w.profile_id=p_admin_id
      and w.company_name like 'FS008G C8 Nonmember %'
  ) then
    raise exception 'FS008G_FIXTURE_WRONG_WORKSPACE_INVALID';
  end if;
  if exists(select 1 from public.customer_accounts where tenant_id=p_workspace_id)
    or exists(select 1 from public.integration_connections where workspace_id=p_workspace_id)
    or exists(select 1 from public.notifications where workspace_id=p_workspace_id)
    or exists(select 1 from public.commerce_payments where workspace_id=p_workspace_id)
  then
    raise exception 'FS008G_CONTROLLED_RUN_EXTERNAL_DEPENDENCY';
  end if;
  if exists(
    select 1 from public.furnishing_controlled_fixture_designations d
    where d.workspace_id=p_workspace_id
      and (d.controlled_run_id<>p_controlled_run_id
        or d.created_by<>p_owner_id
        or length(d.candidate_commit)<7)
  ) then
    raise exception 'FS008G_CONTROLLED_RUN_DESIGNATION_MISMATCH';
  end if;

  perform 1 from public.furnishing_catalog_imports
    where workspace_id=p_workspace_id order by id for update;
  select coalesce(array_agg(i.id order by i.id),'{}'::uuid[])
    into import_ids
  from public.furnishing_catalog_imports i
  where i.workspace_id=p_workspace_id;
  if exists(
    select 1 from public.furnishing_catalog_imports i
    where i.id=any(import_ids)
      and (i.organization_id<>p_workspace_id
        or i.created_by<>p_admin_id
        or i.candidate_version<>'local'
        or i.source_type not in('csv','xlsx')
        or i.status not in('complete','complete_with_skips'))
  ) then
    raise exception 'FS008G_CONTROLLED_IMPORT_SCOPE_INVALID';
  end if;

  select coalesce(array_agg(p.id order by p.id),'{}'::uuid[])
    into platform_product_ids
  from public.furnishing_products p
  where p.source_import_id=any(import_ids)
    and p.scope='platform' and p.workspace_id is null;
  perform 1 from public.furnishing_products
    where id=any(platform_product_ids) order by id for update;
  if exists(
    select 1 from public.furnishing_products p
    where p.id=any(platform_product_ids)
      and (p.scope<>'platform' or p.workspace_id is not null
        or p.status<>'draft' or p.created_by<>p_admin_id
        or p.updated_by<>p_admin_id or p.source_type not in('csv','xlsx')
        or p.source_import_id is null or p.source_sheet is null
        or p.source_row is null or p.imported_at is null)
  ) then
    raise exception 'FS008G_CONTROLLED_PLATFORM_PRODUCT_INELIGIBLE';
  end if;
  if exists(
    select 1 from public.furnishing_catalog_import_items i
    where i.import_id=any(import_ids)
      and i.imported_product_id is not null
      and not (i.imported_product_id=any(platform_product_ids))
  ) then
    raise exception 'FS008G_CONTROLLED_IMPORT_PREEXISTING_PRODUCT_DEPENDENCY';
  end if;

  perform 1 from public.furnishing_product_adoptions
    where workspace_id=p_workspace_id
      or source_product_id=any(platform_product_ids)
    order by id for update;
  select coalesce(array_agg(a.id order by a.id),'{}'::uuid[]),
         coalesce(array_agg(a.workspace_product_id order by a.workspace_product_id),'{}'::uuid[])
    into adoption_ids,workspace_product_ids
  from public.furnishing_product_adoptions a
  where a.workspace_id=p_workspace_id
    and a.source_product_id=any(platform_product_ids);
  perform 1 from public.furnishing_products
    where id=any(workspace_product_ids) order by id for update;
  if exists(
    select 1 from public.furnishing_product_adoptions a
    where a.source_product_id=any(platform_product_ids)
      and (a.workspace_id<>p_workspace_id or a.adopted_by<>p_admin_id
        or not (a.id=any(adoption_ids)))
  ) then
    raise exception 'FS008G_CONTROLLED_PLATFORM_PRODUCT_NONCONTROLLED_ADOPTION';
  end if;

  if exists(
    select 1 from unnest(workspace_product_ids) as controlled_product(product_id)
    left join public.furnishing_products p on p.id=controlled_product.product_id
    left join public.furnishing_product_adoptions a
      on a.workspace_product_id=controlled_product.product_id and a.workspace_id=p_workspace_id
    left join public.furnishing_products s on s.id=a.source_product_id
    where p.id is null or p.workspace_id<>p_workspace_id or p.scope<>'workspace'
      or p.source_type<>'platform_adoption' or p.family_product_id<>a.source_product_id
      or p.created_by<>p_admin_id or a.adopted_by<>p_admin_id
      or s.id is null or not (s.id=any(platform_product_ids))
  ) then
    raise exception 'FS008G_ADOPTION_CLEANUP_SCOPE_INVALID';
  end if;
  if exists(
    select 1 from public.furnishing_products p
    where p.workspace_id=p_workspace_id and p.source_type='platform_adoption'
      and not (p.id=any(workspace_product_ids))
  ) then
    raise exception 'FS008G_ADOPTION_CLEANUP_LINEAGE_INVALID';
  end if;

  if exists(select 1 from public.furnishing_product_versions where product_id=any(platform_product_ids) and lifecycle_status='approved') then dependency:='furnishing_product_versions.approved';
  elsif exists(select 1 from public.furnishing_product_review_events where product_id=any(platform_product_ids)) then dependency:='furnishing_product_review_events';
  elsif exists(select 1 from public.fs008d_snapshot_items where product_id=any(platform_product_ids)) then dependency:='fs008d_snapshot_items';
  elsif exists(select 1 from public.fsux4_package_items where product_id=any(platform_product_ids)) then dependency:='fsux4_package_items';
  elsif exists(select 1 from public.fsux4_package_item_alternatives where product_id=any(platform_product_ids)) then dependency:='fsux4_package_item_alternatives';
  elsif exists(select 1 from public.fsux7_planned_lines where product_id=any(platform_product_ids)) then dependency:='fsux7_planned_lines';
  elsif exists(select 1 from public.furnishing_design_exceptions where product_id=any(platform_product_ids)) then dependency:='furnishing_design_exceptions';
  elsif exists(select 1 from public.furnishing_mood_board_items where product_id=any(platform_product_ids)) then dependency:='furnishing_mood_board_items';
  elsif exists(select 1 from public.furnishing_package_product_alternatives where product_id=any(platform_product_ids)) then dependency:='furnishing_package_product_alternatives';
  elsif exists(select 1 from public.furnishing_procurement_items where product_id=any(platform_product_ids)) then dependency:='furnishing_procurement_items';
  elsif exists(select 1 from public.furnishing_procurement_lines where product_id=any(platform_product_ids)) then dependency:='furnishing_procurement_lines';
  elsif exists(select 1 from public.furnishing_procurement_substitutions where original_product_id=any(platform_product_ids) or replacement_product_id=any(platform_product_ids)) then dependency:='furnishing_procurement_substitutions';
  elsif exists(select 1 from public.furnishing_product_selections where product_id=any(platform_product_ids)) then dependency:='furnishing_product_selections';
  elsif exists(select 1 from public.furnishing_room_package_items where recommended_product_id=any(platform_product_ids)) then dependency:='furnishing_room_package_items';
  elsif exists(select 1 from public.furnishing_product_offers where product_id=any(platform_product_ids)) then dependency:='furnishing_product_offers';
  elsif exists(select 1 from public.furnishing_product_media where product_id=any(platform_product_ids)) then dependency:='furnishing_product_media';
  elsif exists(select 1 from public.furnishing_product_style_assignments where product_id=any(platform_product_ids)) then dependency:='furnishing_product_style_assignments';
  elsif exists(select 1 from public.furnishing_products where family_product_id=any(platform_product_ids) and not (id=any(workspace_product_ids))) then dependency:='furnishing_products.family_product_id';
  elsif exists(select 1 from public.furnishing_products where replacement_product_id=any(platform_product_ids)) then dependency:='furnishing_products.replacement_product_id';
  elsif exists(select 1 from public.fs008d_snapshot_items where product_id=any(workspace_product_ids)) then dependency:='workspace.fs008d_snapshot_items';
  elsif exists(select 1 from public.fsux4_package_items where product_id=any(workspace_product_ids)) then dependency:='workspace.fsux4_package_items';
  elsif exists(select 1 from public.furnishing_product_selections where product_id=any(workspace_product_ids)) then dependency:='workspace.furnishing_product_selections';
  elsif exists(select 1 from public.furnishing_procurement_lines where product_id=any(workspace_product_ids)) then dependency:='workspace.furnishing_procurement_lines';
  end if;
  if dependency is not null then
    raise exception 'FS008G_ADOPTION_CLEANUP_RETAINED_DEPENDENCY:%',dependency;
  end if;

  select coalesce(array_agg(id order by id),'{}'::uuid[]) into offer_ids
  from public.furnishing_product_offers where product_id=any(workspace_product_ids);
  delete from public.furnishing_product_offer_assignments
    where product_id=any(workspace_product_ids) or offer_id=any(offer_ids);
  delete from public.furnishing_catalog_approvals
    where workspace_id=p_workspace_id;
  delete from public.furnishing_product_review_events where product_id=any(workspace_product_ids);
  delete from public.furnishing_product_versions where product_id=any(workspace_product_ids);
  delete from public.furnishing_product_identity_claims where product_id=any(workspace_product_ids);
  delete from public.furnishing_catalog_activity
    where workspace_id=p_workspace_id
      and (product_id=any(workspace_product_ids) or offer_id=any(offer_ids));
  delete from public.furnishing_product_adoptions where id=any(adoption_ids);
  get diagnostics removed_adoptions=row_count;
  delete from public.furnishing_products where id=any(workspace_product_ids);
  get diagnostics removed_workspace_products=row_count;

  delete from public.furnishing_catalog_activity where import_id=any(import_ids);
  delete from public.furnishing_import_stage_evidence where import_id=any(import_ids);
  delete from public.furnishing_catalog_import_items where import_id=any(import_ids);
  delete from public.furnishing_product_identity_claims where product_id=any(platform_product_ids);
  delete from public.furnishing_product_room_compatibility where product_id=any(platform_product_ids);
  delete from public.furnishing_product_specifications where product_id=any(platform_product_ids);
  delete from public.furnishing_products where id=any(platform_product_ids);
  get diagnostics removed_platform_products=row_count;
  delete from public.furnishing_catalog_imports where id=any(import_ids);
  get diagnostics removed_imports=row_count;
  delete from public.furnishing_command_contexts where workspace_id=p_workspace_id;
  get diagnostics removed_contexts=row_count;
  delete from public.fsux8_release_permissions where actor_id in(p_admin_id,p_owner_id);
  delete from public.furnishing_activation_workspaces where workspace_id=p_workspace_id;
  delete from public.furnishing_controlled_fixture_designations where workspace_id=p_workspace_id;
  delete from public.ps001d_verification_tenants where tenant_id=p_workspace_id;
  delete from public.workspace_memberships where workspace_id=p_workspace_id;
  delete from public.owners where id in(p_workspace_id,p_wrong_workspace_id);

  if exists(select 1 from public.furnishing_product_adoptions where workspace_id=p_workspace_id)
    or exists(select 1 from public.furnishing_products where id=any(workspace_product_ids))
    or exists(select 1 from public.furnishing_products where id=any(platform_product_ids))
    or exists(select 1 from public.furnishing_catalog_imports where id=any(import_ids))
    or exists(select 1 from public.furnishing_command_contexts where workspace_id=p_workspace_id)
    or exists(select 1 from public.furnishing_controlled_fixture_designations where workspace_id=p_workspace_id)
    or exists(select 1 from public.owners where id in(p_workspace_id,p_wrong_workspace_id))
  then
    raise exception 'FS008G_CONTROLLED_RUN_CLEANUP_RECONCILIATION_FAILED';
  end if;
  return jsonb_build_object(
    'status','cleaned','workspaceId',p_workspace_id,
    'controlledRunId',p_controlled_run_id,
    'adoptions',removed_adoptions,'workspaceProducts',removed_workspace_products,
    'platformProducts',removed_platform_products,'imports',removed_imports,
    'commandContexts',removed_contexts,
    'externalEffects',false
  );
end $$;

revoke all on function public.cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid,uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid,uuid,uuid)
  to service_role;

commit;
