-- FS-008G-C8-D: workspace-native controlled catalog import.
-- Historical platform products/offers and completed imports are not rewritten.
begin;

alter table public.furnishing_command_contexts
  drop constraint if exists furnishing_command_contexts_target_type_check;
alter table public.furnishing_command_contexts
  add constraint furnishing_command_contexts_target_type_check check (
    target_type in ('workspace','import','product','offer','requirement','package','package_version','room_package','room_package_version','room_package_item','plan','selection','project','snapshot','baseline','budget','batch','order','line','discrepancy','cleanup')
  );

create or replace function public.submit_controlled_furnishing_requirement(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare actor uuid:=auth.uid(); workspace uuid; target uuid; command_key text;
begin
  if actor is null or not public.is_admin() then raise exception 'FURNISHING_CATALOG_ADMIN_REQUIRED' using errcode='42501'; end if;
  begin workspace:=(p_input->>'workspace_id')::uuid; target:=(p_input->>'target_id')::uuid; exception when others then raise exception 'REQUIREMENT_REVIEW_COMMAND_INVALID'; end;
  command_key:=trim(p_input->>'idempotency_key');
  if length(command_key)<8 then raise exception 'REQUIREMENT_REVIEW_COMMAND_INVALID'; end if;
  perform public.authorize_controlled_furnishing_catalog_mutation(workspace);
  update public.furnishing_room_requirements set lifecycle_status='in_review',updated_at=now()
    where id=target and workspace_id=workspace and scope='workspace' and lifecycle_status='draft';
  if not found and not exists(select 1 from public.furnishing_room_requirements where id=target and workspace_id=workspace and scope='workspace' and lifecycle_status='in_review')
    then raise exception 'CATALOG_APPROVAL_TARGET_SCOPE_INVALID'; end if;
  return jsonb_build_object('status','in_review','id',target,'idempotencyKey',command_key);
end $$;

create or replace function public.sync_controlled_requirement_approval()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.target_type='requirement' then
    update public.furnishing_room_requirements
      set lifecycle_status=case when new.status='approved' then 'approved' else 'in_review' end,updated_at=now()
      where id=new.target_id and workspace_id=new.workspace_id and scope='workspace';
  end if;
  return new;
end $$;
drop trigger if exists sync_controlled_requirement_approval on public.furnishing_catalog_approvals;
create trigger sync_controlled_requirement_approval after insert on public.furnishing_catalog_approvals
for each row execute function public.sync_controlled_requirement_approval();
revoke all on function public.submit_controlled_furnishing_requirement(jsonb) from public,anon;
grant execute on function public.submit_controlled_furnishing_requirement(jsonb) to authenticated;

alter table public.furnishing_product_offers
  add column if not exists workspace_id uuid references public.owners(id);
create or replace function public.enforce_furnishing_offer_workspace_lineage() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.workspace_id is not null and not exists(select 1 from public.furnishing_products product where product.id=new.product_id and product.scope='workspace' and product.workspace_id=new.workspace_id) then raise exception 'OFFER_WORKSPACE_LINEAGE_INVALID';end if;
 return new;
end$$;
drop trigger if exists furnishing_offer_workspace_lineage on public.furnishing_product_offers;
create trigger furnishing_offer_workspace_lineage before insert or update of workspace_id,product_id on public.furnishing_product_offers for each row execute function public.enforce_furnishing_offer_workspace_lineage();

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
  release public.furnishing_activation_releases%rowtype;
  controlled_workspace public.furnishing_activation_workspaces%rowtype;
  v_created integer:=0; v_matched integer:=0; v_skipped integer:=0;
begin
  if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'FS008G_C7_ADMIN_REQUIRED'; end if;
  if supplied_correlation !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or length(coalesce(supplied_key,''))<16 then raise exception 'FS008G_C7_MUTATION_WINDOW_INVALID'; end if;
  select * into run from public.furnishing_catalog_imports where id=target_import for update;
  if not found then raise exception 'FS008G_C7_IMPORT_NOT_FOUND'; end if;
  if run.workspace_id is null or run.workspace_id is distinct from target_workspace then raise exception 'FS008G_C7_TARGET_MISMATCH'; end if;
  if not exists(select 1 from public.ps001d_verification_tenants controlled where controlled.tenant_id=run.workspace_id and controlled.designation='PS001D_VERIFICATION_ONLY_NON_CUSTOMER' and controlled.status='approved' and controlled.revoked_at is null and controlled.expires_at>now()) then raise exception 'FURNISHING_CATALOG_TARGET_FORBIDDEN';end if;
  select r.* into release from public.furnishing_activation_releases r where r.milestone='FS-008A';
  if not found or release.global_state<>'internal' or release.global_kill_switch or not release.configuration_valid then raise exception 'FURNISHING_ACTIVATION_DISABLED';end if;
  select w.* into controlled_workspace from public.furnishing_activation_workspaces w where w.release_id=release.id and w.workspace_id=run.workspace_id;
  if not found or not controlled_workspace.enabled or controlled_workspace.kill_switch or controlled_workspace.cohort<>'internal' or controlled_workspace.revoked_at is not null or(controlled_workspace.expires_at is not null and controlled_workspace.expires_at<=now()) then raise exception 'FURNISHING_ACTIVATION_DISABLED';end if;
  if not exists(select 1 from public.furnishing_activation_capabilities c where c.release_id=release.id and c.capability='catalog_viewing' and c.enabled) then raise exception 'FURNISHING_ACTIVATION_DISABLED';end if;
  fingerprint:=encode(digest(concat_ws(':','C8D-workspace',run.id,run.workspace_id,run.source_sha256,run.correlation_id,run.total_rows),'sha256'),'hex');
  if run.status='complete' then
    if run.apply_idempotency_key=supplied_key and run.correlation_id=supplied_correlation then
      if run.apply_fingerprint=fingerprint or exists(select 1 from public.furnishing_products p where p.source_import_id=run.id and p.scope='platform' and p.workspace_id is null) then
        return jsonb_build_object('status','replayed','id',run.id,'version',run.optimistic_version,'created',run.created_count,'matched',run.matched_count,'skipped',run.skipped_count,'failed',0);
      end if;
    end if;
    raise exception 'FS008G_C7_REPLAY_CONFLICT';
  end if;
  if run.status<>'review_required' then raise exception 'FS008G_C7_REVIEW_REQUIRED'; end if;
  if run.optimistic_version<>expected_version then raise exception 'FS008G_C7_VERSION_CONFLICT'; end if;
  if run.correlation_id<>supplied_correlation then raise exception 'FS008G_C7_CORRELATION_MISMATCH'; end if;
  if run.source_sha256<>'ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823' or run.source_filename<>'Catalog Review (1).xlsx' or run.total_rows<>110 or (select count(*) from public.furnishing_catalog_import_items where import_id=run.id)<>110 then raise exception 'FS008G_C7_AUTHORITATIVE_IMPORT_MISMATCH'; end if;

  for item in select * from public.furnishing_catalog_import_items where import_id=run.id order by source_sheet,source_row for update loop
    product_id:=null;offer_id:=null;norm:=item.raw_source->'offerNormalization';norm_status:=norm->>'status';
    if item.review_action in('review','skip') then v_skipped:=v_skipped+1;continue;end if;
    if item.review_action not in('create','match') then raise exception 'FS008G_C7_UNRESOLVED_REVIEW_ITEM';end if;
    if norm->>'version'<>'FS-008G-C7' or norm_status not in('resolved','not_applicable') then raise exception 'OFFER_TARGET_INVALID';end if;
    if norm_status='resolved' then
      norm_hostname:=norm->>'hostname';norm_provenance:=norm->>'provenance';
      if item.proposed_product_url is null or item.proposed_retailer_id is null or norm->>'productUrl'<>item.proposed_product_url or (norm->>'retailerId')::uuid<>item.proposed_retailer_id or not exists(select 1 from public.furnishing_retailer_hostname_allowlist a where a.hostname=norm_hostname and a.retailer_id=item.proposed_retailer_id and a.provenance=norm_provenance and a.active) then raise exception 'OFFER_TARGET_INVALID';end if;
    elsif item.proposed_product_url is not null or item.proposed_retailer_id is not null then raise exception 'OFFER_TARGET_INVALID';end if;

    product_id:=item.matched_product_id;
    if item.review_action='match' then
      if product_id is null or not exists(select 1 from public.furnishing_products p where p.id=product_id and p.scope='workspace' and p.workspace_id=run.workspace_id) then raise exception 'FS008G_C8D_MATCH_SCOPE_INVALID';end if;
      v_matched:=v_matched+1;
    else
      if product_id is not null then raise exception 'FS008G_C7_CREATE_TARGET_INVALID';end if;
      insert into public.furnishing_products(scope,workspace_id,name,description,product_type,category,category_id,status,created_by,source_type,source_import_id,source_sheet,source_row,imported_at)
      values('workspace',run.workspace_id,item.proposed_name,null,'catalog_item','Imported',item.proposed_category_id,'draft',actor,'xlsx',run.id,item.source_sheet,item.source_row,now()) returning id into product_id;
      v_created:=v_created+1;
      if item.proposed_room_type_id is not null then insert into public.furnishing_product_room_compatibility(product_id,room_type_id) values(product_id,item.proposed_room_type_id);end if;
    end if;
    if norm_status='resolved' then
      insert into public.furnishing_product_offers(workspace_id,product_id,retailer_id,product_url,listed_price_minor,availability,status,source_type,source_import_id,source_sheet,source_row,imported_at)
      values(run.workspace_id,product_id,item.proposed_retailer_id,item.proposed_product_url,item.proposed_price_minor,'unknown','active','xlsx',run.id,item.source_sheet,item.source_row,now()) returning id into offer_id;
    end if;
    update public.furnishing_catalog_import_items set imported_product_id=product_id,imported_offer_id=offer_id where id=item.id;
  end loop;
  update public.furnishing_catalog_imports set status='complete',created_count=v_created,matched_count=v_matched,skipped_count=v_skipped,failed_count=0,completed_at=now(),apply_idempotency_key=supplied_key,apply_fingerprint=fingerprint,optimistic_version=optimistic_version+1 where id=run.id returning * into run;
  insert into public.furnishing_catalog_activity(workspace_id,import_id,event_type,actor_id,metadata) values(run.workspace_id,run.id,'catalog_inventory_import_completed',actor,jsonb_build_object('correlationId',run.correlation_id,'idempotencyKey',supplied_key,'fingerprint',fingerprint,'normalization','FS-008G-C8D','scope','workspace','version',run.optimistic_version,'created',v_created,'matched',v_matched,'skipped',v_skipped,'failed',0,'externalEffects',false));
  return jsonb_build_object('status','complete','id',run.id,'version',run.optimistic_version,'created',v_created,'matched',v_matched,'skipped',v_skipped,'failed',0,'scope','workspace','workspaceId',run.workspace_id);
end $$;

revoke all on function public.apply_fs008g_c7_catalog_import(jsonb) from public,anon,authenticated;
grant execute on function public.apply_fs008g_c7_catalog_import(jsonb) to service_role;
grant select,insert,update,delete on public.furnishing_product_offers to service_role;
commit;
