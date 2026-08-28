-- FS-008G-C3: atomic, correlation-bound catalog parse commits.
begin;
alter table public.furnishing_catalog_imports add column if not exists source_sha256 text, add column if not exists correlation_id text, add column if not exists idempotency_key text, add column if not exists safe_diagnostics jsonb not null default '{}';
create unique index if not exists furnishing_catalog_import_idempotency_unique on public.furnishing_catalog_imports(idempotency_key) where idempotency_key is not null;

create or replace function public.commit_fs008g_c3_catalog_import(p_input jsonb,p_items jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; actor uuid:=(p_input->>'actorId')::uuid; n integer:=jsonb_array_length(p_items);
begin
 if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'FS008G_C3_ADMIN_REQUIRED'; end if;
 if p_input->>'sourceSha256'<>'ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823' or p_input->>'sourceFilename'<>'Catalog Review (1).xlsx' or n<>110 then raise exception 'FS008G_C3_INPUT_MISMATCH'; end if;
 select * into r from public.furnishing_catalog_imports where idempotency_key=p_input->>'idempotencyKey' for update;
 if found then if r.source_sha256=p_input->>'sourceSha256' and r.correlation_id=p_input->>'correlationId' and r.workspace_id=(p_input->>'workspaceId')::uuid and r.status='review_required' and r.total_rows=110 then return jsonb_build_object('status','replayed','id',r.id,'rows',110); end if; raise exception 'FS008G_C3_REPLAY_CONFLICT'; end if;
 if exists(select 1 from jsonb_to_recordset(p_items) x(source_sheet text,source_row integer) where x.source_sheet<>'Catalog Review' or x.source_row<=4) or (select count(distinct x.source_row) from jsonb_to_recordset(p_items) x(source_row integer))<>110 then raise exception 'FS008G_C3_ROW_SET_INVALID'; end if;
 insert into public.furnishing_catalog_imports(workspace_id,source_filename,source_sha256,correlation_id,idempotency_key,status,total_rows,created_by) values((p_input->>'workspaceId')::uuid,p_input->>'sourceFilename',p_input->>'sourceSha256',p_input->>'correlationId',p_input->>'idempotencyKey','review_required',110,actor) returning * into r;
 insert into public.furnishing_catalog_import_items(import_id,source_sheet,source_row,source_item,proposed_name,proposed_category_id,proposed_room_type_id,proposed_retailer_id,proposed_product_url,proposed_price_minor,duplicate_product_id,review_action,matched_product_id,validation_issues,raw_source)
 select r.id,x.source_sheet,x.source_row,x.source_item,x.proposed_name,x.proposed_category_id,x.proposed_room_type_id,x.proposed_retailer_id,x.proposed_product_url,x.proposed_price_minor,x.duplicate_product_id,x.review_action,x.matched_product_id,coalesce(x.validation_issues,'{}'),coalesce(x.raw_source,'{}') from jsonb_to_recordset(p_items) x(source_sheet text,source_row integer,source_item text,proposed_name text,proposed_category_id uuid,proposed_room_type_id text,proposed_retailer_id uuid,proposed_product_url text,proposed_price_minor bigint,duplicate_product_id uuid,review_action text,matched_product_id uuid,validation_issues text[],raw_source jsonb);
 insert into public.furnishing_catalog_activity(workspace_id,import_id,event_type,actor_id,metadata) values(r.workspace_id,r.id,'catalog_inventory_import_started',actor,jsonb_build_object('rows',110,'correlationId',r.correlation_id,'sourceSha256',r.source_sha256));
 return jsonb_build_object('status','created','id',r.id,'rows',110);
end $$;

create or replace function public.fail_fs008g_c3_catalog_import(p_input jsonb,p_failure_code text,p_safe_diagnostics jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r record; actor uuid:=(p_input->>'actorId')::uuid; code text:=left(regexp_replace(upper(p_failure_code),'[^A-Z0-9_]','','g'),80);
begin
 if not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'FS008G_C3_ADMIN_REQUIRED'; end if;
 select * into r from public.furnishing_catalog_imports where idempotency_key=p_input->>'idempotencyKey' for update;
 if found then if r.source_sha256=p_input->>'sourceSha256' and r.correlation_id=p_input->>'correlationId' and r.status='failed' and r.error_code=code then return jsonb_build_object('status','replayed','id',r.id); end if; raise exception 'FS008G_C3_REPLAY_CONFLICT'; end if;
 insert into public.furnishing_catalog_imports(workspace_id,source_filename,source_sha256,correlation_id,idempotency_key,status,total_rows,error_code,safe_diagnostics,created_by,completed_at) values((p_input->>'workspaceId')::uuid,left(p_input->>'sourceFilename',255),lower(p_input->>'sourceSha256'),left(p_input->>'correlationId',120),left(p_input->>'idempotencyKey',200),'failed',0,code,jsonb_strip_nulls(p_safe_diagnostics),actor,now()) returning * into r;
 insert into public.furnishing_catalog_activity(workspace_id,import_id,event_type,actor_id,metadata) values(r.workspace_id,r.id,'catalog_inventory_import_failed',actor,jsonb_build_object('code',code,'correlationId',r.correlation_id)); return jsonb_build_object('status','failed','id',r.id,'code',code);
end $$;
revoke all on function public.commit_fs008g_c3_catalog_import(jsonb,jsonb),public.fail_fs008g_c3_catalog_import(jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.commit_fs008g_c3_catalog_import(jsonb,jsonb),public.fail_fs008g_c3_catalog_import(jsonb,text,jsonb) to service_role;
commit;
