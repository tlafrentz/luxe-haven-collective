-- FS-008G-C7: deterministic offer normalization and preview/apply parity.
begin;

create table if not exists public.furnishing_retailer_hostname_allowlist(
  hostname text primary key,
  retailer_id uuid not null references public.furnishing_retailers(id),
  provenance text not null check(provenance in('retailer_domain','allowlisted_alias')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check(hostname=lower(hostname) and hostname !~ '^www\\.')
);
revoke all on public.furnishing_retailer_hostname_allowlist from public,anon,authenticated;
grant select on public.furnishing_retailer_hostname_allowlist to service_role;

insert into public.furnishing_retailer_hostname_allowlist(hostname,retailer_id,provenance)
select lower(regexp_replace(domain,'^www\\.','')),id,'retailer_domain'
from public.furnishing_retailers
where status='active' and nullif(domain,'') is not null
on conflict(hostname) do update set retailer_id=excluded.retailer_id,provenance=excluded.provenance,active=true;

insert into public.furnishing_retailer_hostname_allowlist(hostname,retailer_id,provenance)
select 'amzn.to',id,'allowlisted_alias' from public.furnishing_retailers where name='Amazon' and status='active'
on conflict(hostname) do update set retailer_id=excluded.retailer_id,provenance=excluded.provenance,active=true;

-- Preserve the C6 review evidence. It is terminalized, never rewritten or reused.
update public.furnishing_catalog_imports
set status='failed',error_code='FS008G_C7_REVALIDATION_REQUIRED',
    safe_diagnostics=safe_diagnostics||jsonb_build_object('terminalizedBy','FS-008G-C7','historicalReviewPreserved',true),
    completed_at=coalesce(completed_at,now())
where id='05303dd2-6a83-4e75-b8cc-efad41d79578' and status='review_required';

insert into public.furnishing_catalog_activity(workspace_id,import_id,event_type,actor_id,metadata)
select workspace_id,id,'catalog_inventory_import_failed',created_by,
       jsonb_build_object('code','FS008G_C7_REVALIDATION_REQUIRED','historicalReviewPreserved',true)
from public.furnishing_catalog_imports
where id='05303dd2-6a83-4e75-b8cc-efad41d79578'
  and error_code='FS008G_C7_REVALIDATION_REQUIRED'
  and not exists(select 1 from public.furnishing_catalog_activity a where a.import_id='05303dd2-6a83-4e75-b8cc-efad41d79578' and a.metadata->>'code'='FS008G_C7_REVALIDATION_REQUIRED');

create or replace function public.apply_fs008g_c7_catalog_import(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  run public.furnishing_catalog_imports%rowtype;
  item public.furnishing_catalog_import_items%rowtype;
  actor uuid := (p_input->>'actorId')::uuid;
  target_import uuid := (p_input->>'importId')::uuid;
  target_workspace uuid := (p_input->>'workspaceId')::uuid;
  expected_version integer := (p_input->>'expectedVersion')::integer;
  supplied_correlation text := p_input->>'correlationId';
  supplied_key text := p_input->>'idempotencyKey';
  fingerprint text; product_id uuid; offer_id uuid;
  norm jsonb; norm_status text; norm_hostname text; norm_provenance text;
  v_created integer:=0; v_matched integer:=0; v_skipped integer:=0;
begin
  if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'FS008G_C7_ADMIN_REQUIRED'; end if;
  if supplied_correlation !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or length(coalesce(supplied_key,''))<16 then raise exception 'FS008G_C7_MUTATION_WINDOW_INVALID'; end if;
  select * into run from public.furnishing_catalog_imports where id=target_import for update;
  if not found then raise exception 'FS008G_C7_IMPORT_NOT_FOUND'; end if;
  if run.workspace_id is distinct from target_workspace then raise exception 'FS008G_C7_TARGET_MISMATCH'; end if;
  fingerprint:=encode(digest(concat_ws(':','C7',run.id,run.workspace_id,run.source_sha256,run.correlation_id,run.total_rows),'sha256'),'hex');
  if run.status='complete' then
    if run.apply_idempotency_key=supplied_key and run.apply_fingerprint=fingerprint and run.correlation_id=supplied_correlation then
      return jsonb_build_object('status','replayed','id',run.id,'version',run.optimistic_version,'created',run.created_count,'matched',run.matched_count,'skipped',run.skipped_count,'failed',0);
    end if;
    raise exception 'FS008G_C7_REPLAY_CONFLICT';
  end if;
  if run.status<>'review_required' then raise exception 'FS008G_C7_REVIEW_REQUIRED'; end if;
  if run.optimistic_version<>expected_version then raise exception 'FS008G_C7_VERSION_CONFLICT'; end if;
  if run.correlation_id<>supplied_correlation then raise exception 'FS008G_C7_CORRELATION_MISMATCH'; end if;
  if run.source_sha256<>'ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823' or run.source_filename<>'Catalog Review (1).xlsx' or run.total_rows<>110 or (select count(*) from public.furnishing_catalog_import_items where import_id=run.id)<>110 then raise exception 'FS008G_C7_AUTHORITATIVE_IMPORT_MISMATCH'; end if;

  for item in select * from public.furnishing_catalog_import_items where import_id=run.id order by source_sheet,source_row for update loop
    product_id:=null; offer_id:=null; norm:=item.raw_source->'offerNormalization'; norm_status:=norm->>'status';
    if item.review_action in('review','skip') then v_skipped:=v_skipped+1; continue; end if;
    if item.review_action not in('create','match') then raise exception 'FS008G_C7_UNRESOLVED_REVIEW_ITEM'; end if;
    if norm->>'version'<>'FS-008G-C7' or norm_status not in('resolved','not_applicable') then raise exception 'OFFER_TARGET_INVALID'; end if;
    if norm_status='resolved' then
      norm_hostname:=norm->>'hostname'; norm_provenance:=norm->>'provenance';
      if item.proposed_product_url is null or item.proposed_retailer_id is null
         or norm->>'productUrl'<>item.proposed_product_url or (norm->>'retailerId')::uuid<>item.proposed_retailer_id
         or not exists(select 1 from public.furnishing_retailer_hostname_allowlist a where a.hostname=norm_hostname and a.retailer_id=item.proposed_retailer_id and a.provenance=norm_provenance and a.active)
      then raise exception 'OFFER_TARGET_INVALID'; end if;
    elsif item.proposed_product_url is not null or item.proposed_retailer_id is not null then raise exception 'OFFER_TARGET_INVALID'; end if;

    product_id:=item.matched_product_id;
    if item.review_action='match' then
      if product_id is null or not exists(select 1 from public.furnishing_products where id=product_id) then raise exception 'FS008G_C7_MATCH_TARGET_INVALID'; end if;
      v_matched:=v_matched+1;
    else
      if product_id is not null then raise exception 'FS008G_C7_CREATE_TARGET_INVALID'; end if;
      insert into public.furnishing_products(scope,workspace_id,name,description,product_type,category,category_id,status,created_by,source_type,source_import_id,source_sheet,source_row,imported_at)
      values('platform',null,item.proposed_name,null,'catalog_item','Imported',item.proposed_category_id,'draft',actor,'xlsx',run.id,item.source_sheet,item.source_row,now()) returning id into product_id;
      v_created:=v_created+1;
      if item.proposed_room_type_id is not null then insert into public.furnishing_product_room_compatibility(product_id,room_type_id) values(product_id,item.proposed_room_type_id); end if;
    end if;
    if norm_status='resolved' then
      insert into public.furnishing_product_offers(product_id,retailer_id,product_url,listed_price_minor,availability,status,source_type,source_import_id,source_sheet,source_row,imported_at)
      values(product_id,item.proposed_retailer_id,item.proposed_product_url,item.proposed_price_minor,'unknown','active','xlsx',run.id,item.source_sheet,item.source_row,now()) returning id into offer_id;
    end if;
    update public.furnishing_catalog_import_items set imported_product_id=product_id,imported_offer_id=offer_id where id=item.id;
  end loop;
  update public.furnishing_catalog_imports set status='complete',created_count=v_created,matched_count=v_matched,skipped_count=v_skipped,failed_count=0,completed_at=now(),apply_idempotency_key=supplied_key,apply_fingerprint=fingerprint,optimistic_version=optimistic_version+1 where id=run.id returning * into run;
  insert into public.furnishing_catalog_activity(workspace_id,import_id,event_type,actor_id,metadata) values(run.workspace_id,run.id,'catalog_inventory_import_completed',actor,jsonb_build_object('correlationId',run.correlation_id,'idempotencyKey',supplied_key,'fingerprint',fingerprint,'normalization','FS-008G-C7','version',run.optimistic_version,'created',v_created,'matched',v_matched,'skipped',v_skipped,'failed',0));
  return jsonb_build_object('status','complete','id',run.id,'version',run.optimistic_version,'created',v_created,'matched',v_matched,'skipped',v_skipped,'failed',0);
end $$;

revoke all on function public.apply_fs008g_c7_catalog_import(jsonb) from public,anon,authenticated;
grant execute on function public.apply_fs008g_c7_catalog_import(jsonb) to service_role;
commit;
