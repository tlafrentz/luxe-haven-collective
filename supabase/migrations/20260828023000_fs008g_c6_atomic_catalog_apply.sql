-- FS-008G-C6: one authoritative transaction for applying a reviewed 110-row catalog.
begin;

alter table public.furnishing_catalog_imports
  add column if not exists optimistic_version integer not null default 0,
  add column if not exists apply_idempotency_key text,
  add column if not exists apply_fingerprint text;

create unique index if not exists furnishing_catalog_import_apply_key_unique
  on public.furnishing_catalog_imports(apply_idempotency_key)
  where apply_idempotency_key is not null;

create or replace function public.apply_fs008g_c6_catalog_import(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  run public.furnishing_catalog_imports%rowtype;
  item public.furnishing_catalog_import_items%rowtype;
  actor uuid := (p_input->>'actorId')::uuid;
  target_import uuid := (p_input->>'importId')::uuid;
  target_workspace uuid := (p_input->>'workspaceId')::uuid;
  expected_version integer := (p_input->>'expectedVersion')::integer;
  supplied_correlation text := p_input->>'correlationId';
  supplied_key text := p_input->>'idempotencyKey';
  fingerprint text;
  product_id uuid;
  offer_id uuid;
  v_created integer := 0;
  v_matched integer := 0;
  v_skipped integer := 0;
begin
  if not exists(select 1 from public.profiles where id=actor and role='admin') then
    raise exception 'FS008G_C6_ADMIN_REQUIRED';
  end if;
  if supplied_correlation !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or length(coalesce(supplied_key,'')) < 16 then
    raise exception 'FS008G_C6_MUTATION_WINDOW_INVALID';
  end if;

  select * into run from public.furnishing_catalog_imports where id=target_import for update;
  if not found then raise exception 'FS008G_C6_IMPORT_NOT_FOUND'; end if;
  if run.workspace_id is distinct from target_workspace then raise exception 'FS008G_C6_TARGET_MISMATCH'; end if;
  fingerprint := encode(digest(concat_ws(':',run.id,run.workspace_id,run.source_sha256,run.correlation_id,run.total_rows),'sha256'),'hex');

  if run.status='complete' then
    if run.apply_idempotency_key=supplied_key and run.apply_fingerprint=fingerprint and run.correlation_id=supplied_correlation then
      return jsonb_build_object('status','replayed','id',run.id,'version',run.optimistic_version,'created',run.created_count,'matched',run.matched_count,'skipped',run.skipped_count,'failed',0);
    end if;
    raise exception 'FS008G_C6_REPLAY_CONFLICT';
  end if;
  if run.status<>'review_required' then raise exception 'FS008G_C6_REVIEW_REQUIRED'; end if;
  if run.optimistic_version<>expected_version then raise exception 'FS008G_C6_VERSION_CONFLICT'; end if;
  if run.correlation_id<>supplied_correlation then raise exception 'FS008G_C6_CORRELATION_MISMATCH'; end if;
  if run.source_sha256<>'ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823'
     or run.source_filename<>'Catalog Review (1).xlsx' or run.total_rows<>110
     or (select count(*) from public.furnishing_catalog_import_items where import_id=run.id)<>110 then
    raise exception 'FS008G_C6_AUTHORITATIVE_IMPORT_MISMATCH';
  end if;

  for item in select * from public.furnishing_catalog_import_items where import_id=run.id order by source_sheet,source_row for update loop
    product_id := null; offer_id := null;
    if item.review_action='skip' then v_skipped := v_skipped+1; continue; end if;
    if item.review_action not in ('create','match') then raise exception 'FS008G_C6_UNRESOLVED_REVIEW_ITEM'; end if;
    product_id := item.matched_product_id;
    if item.review_action='match' then
      if product_id is null or not exists(select 1 from public.furnishing_products where id=product_id) then raise exception 'FS008G_C6_MATCH_TARGET_INVALID'; end if;
      v_matched := v_matched+1;
    else
      if product_id is not null then raise exception 'FS008G_C6_CREATE_TARGET_INVALID'; end if;
      insert into public.furnishing_products(scope,workspace_id,name,description,product_type,category,category_id,status,created_by,source_type,source_import_id,source_sheet,source_row,imported_at)
      values('platform',null,item.proposed_name,null,'catalog_item','Imported',item.proposed_category_id,'draft',actor,'xlsx',run.id,item.source_sheet,item.source_row,now()) returning id into product_id;
      v_created := v_created+1;
      if item.proposed_room_type_id is not null then
        insert into public.furnishing_product_room_compatibility(product_id,room_type_id) values(product_id,item.proposed_room_type_id);
      end if;
    end if;
    if item.proposed_product_url is not null or item.proposed_retailer_id is not null then
      if item.proposed_product_url is null or item.proposed_retailer_id is null then raise exception 'FS008G_C6_OFFER_TARGET_INVALID'; end if;
      insert into public.furnishing_product_offers(product_id,retailer_id,product_url,listed_price_minor,availability,status,source_type,source_import_id,source_sheet,source_row,imported_at)
      values(product_id,item.proposed_retailer_id,item.proposed_product_url,item.proposed_price_minor,'unknown','active','xlsx',run.id,item.source_sheet,item.source_row,now()) returning id into offer_id;
    end if;
    update public.furnishing_catalog_import_items set imported_product_id=product_id,imported_offer_id=offer_id where id=item.id;
  end loop;

  update public.furnishing_catalog_imports set status='complete',created_count=v_created,matched_count=v_matched,skipped_count=v_skipped,failed_count=0,completed_at=now(),apply_idempotency_key=supplied_key,apply_fingerprint=fingerprint,optimistic_version=optimistic_version+1 where id=run.id returning * into run;
  insert into public.furnishing_catalog_activity(workspace_id,import_id,event_type,actor_id,metadata)
    values(run.workspace_id,run.id,'catalog_inventory_import_completed',actor,jsonb_build_object('correlationId',run.correlation_id,'idempotencyKey',supplied_key,'fingerprint',fingerprint,'version',run.optimistic_version,'created',v_created,'matched',v_matched,'skipped',v_skipped,'failed',0));
  return jsonb_build_object('status','complete','id',run.id,'version',run.optimistic_version,'created',v_created,'matched',v_matched,'skipped',v_skipped,'failed',0);
end $$;

revoke all on function public.apply_fs008g_c6_catalog_import(jsonb) from public,anon,authenticated;
grant execute on function public.apply_fs008g_c6_catalog_import(jsonb) to service_role;
commit;
