-- FS-008G source-first lifecycle RPC repairs. Earlier migrations remain immutable.
begin;

create table public.furnishing_package_approval_commands(
  id uuid primary key default gen_random_uuid(), package_version_id uuid not null references public.furnishing_package_versions(id),
  workspace_id uuid not null references public.owners(id), actor_id uuid not null references public.profiles(id),
  expected_version integer not null, reason text not null, correlation_id uuid not null,
  idempotency_key text not null unique, payload_hash text not null, result_state text not null,
  created_at timestamptz not null default now()
);
alter table public.furnishing_package_approval_commands enable row level security;
revoke all on public.furnishing_package_approval_commands from public,anon,authenticated;

create or replace function public.approve_furnishing_package_version(p_package_version_id uuid,p_expected_version integer,p_reason text,p_correlation_id text,p_idempotency_key text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid(); v_version public.furnishing_package_versions%rowtype; v_package public.furnishing_packages%rowtype; v_prior public.furnishing_package_approval_commands%rowtype; v_count integer; v_hash text;
begin
 if v_actor is null or not public.is_admin() then raise exception 'UNAUTHORIZED' using errcode='42501'; end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'REASON_REQUIRED'; end if;
 v_hash:=pg_catalog.encode(extensions.digest(pg_catalog.concat_ws(':',p_package_version_id,p_expected_version,trim(p_reason),p_correlation_id,p_idempotency_key),'sha256'),'hex');
 select command_row.* into v_prior from public.furnishing_package_approval_commands command_row where command_row.idempotency_key=p_idempotency_key for update;
 if found then if v_prior.payload_hash<>v_hash then raise exception 'PACKAGE_APPROVAL_REPLAY_CONFLICT'; end if; return jsonb_build_object('status','replayed','id',v_prior.package_version_id,'state',v_prior.result_state); end if;
 select version_row.* into v_version from public.furnishing_package_versions version_row where version_row.id=p_package_version_id for update;
 if not found then raise exception 'PACKAGE_VERSION_NOT_FOUND'; end if;
 select package_row.* into v_package from public.furnishing_packages package_row where package_row.id=v_version.furnishing_package_id for update;
 if v_package.workspace_id is null then raise exception 'PACKAGE_TENANT_REQUIRED'; end if;
 if not exists(select 1 from public.furnishing_command_contexts context_row where context_row.actor_id=v_actor and context_row.workspace_id=v_package.workspace_id and context_row.target_type='package_version' and context_row.target_id=v_version.id::text and context_row.command_type='package.version.approve' and context_row.correlation_id::text=p_correlation_id and context_row.idempotency_key=p_idempotency_key and context_row.retired_at is null and context_row.expires_at>now()) then raise exception 'PACKAGE_APPROVAL_CONTEXT_INVALID' using errcode='42501'; end if;
 if v_version.lifecycle_status='approved' then raise exception 'PACKAGE_APPROVAL_REPLAY_CONTEXT_REQUIRED'; end if;
 if v_version.version_number<>p_expected_version then raise exception 'PACKAGE_VERSION_STALE'; end if;
 if v_version.lifecycle_status<>'in_review' then raise exception 'PACKAGE_VERSION_NOT_REVIEWABLE'; end if;
 select count(*) into v_count from public.furnishing_package_room_composition composition_row where composition_row.furnishing_package_version_id=v_version.id;
 if v_count=0 then raise exception 'PACKAGE_READINESS_INCOMPLETE'; end if;
 update public.furnishing_package_versions version_row set lifecycle_status='approved',approved_at=now() where version_row.id=v_version.id;
 update public.furnishing_packages package_row set lifecycle_status='approved',current_version_id=v_version.id where package_row.id=v_package.id;
 insert into public.furnishing_package_approval_commands(package_version_id,workspace_id,actor_id,expected_version,reason,correlation_id,idempotency_key,payload_hash,result_state) values(v_version.id,v_package.workspace_id,v_actor,p_expected_version,trim(p_reason),p_correlation_id::uuid,p_idempotency_key,v_hash,'approved');
 return jsonb_build_object('status','approved','id',v_version.id,'state','approved');
end $$;

create or replace function public.create_or_replay_procurement_batch(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid(); v_baseline_id uuid; v_retailer_id uuid; v_expected bigint; v_correlation uuid; v_key text:=left(trim(p_input->>'idempotency_key'),200); v_base public.furnishing_procurement_baselines%rowtype; v_budget public.furnishing_project_procurement_budgets%rowtype; v_batch public.furnishing_purchase_batches%rowtype; v_destination public.properties%rowtype; v_subtotal bigint; v_currency text; v_line_count integer;
begin
 if v_actor is null or not public.is_admin() then raise exception 'PROCUREMENT_ADMIN_REQUIRED' using errcode='42501'; end if;
 begin v_baseline_id:=(p_input->>'baseline_id')::uuid;v_retailer_id:=(p_input->>'retailer_id')::uuid;v_expected:=(p_input->>'expected_version')::bigint;v_correlation:=(p_input->>'correlation_id')::uuid;exception when others then raise exception 'PROCUREMENT_BATCH_COMMAND_INVALID';end;
 select baseline_row.* into v_base from public.furnishing_procurement_baselines baseline_row where baseline_row.id=v_baseline_id for update;
 if not found then raise exception 'PROCUREMENT_BASELINE_NOT_FOUND'; end if;
 select batch_row.* into v_batch from public.furnishing_purchase_batches batch_row where batch_row.baseline_id=v_base.id and batch_row.idempotency_key=v_key for update;
 if found then if v_batch.retailer_id=v_retailer_id then return jsonb_build_object('status','replayed','id',v_batch.id,'version',v_batch.version);end if;raise exception 'PROCUREMENT_BATCH_REPLAY_CONFLICT';end if;
 if v_base.version<>v_expected then raise exception 'PROCUREMENT_VERSION_STALE';end if;
 if v_base.status not in('draft','authorized','active') then raise exception 'PROCUREMENT_BASELINE_STATE_INVALID';end if;
 if not exists(select 1 from public.furnishing_retailers retailer_row where retailer_row.id=v_retailer_id and retailer_row.status='active') then raise exception 'PROCUREMENT_RETAILER_INVALID';end if;
 select budget_row.* into v_budget from public.furnishing_project_procurement_budgets budget_row where budget_row.baseline_id=v_base.id and budget_row.status in('submitted','approved','active') order by budget_row.version desc limit 1 for update;
 if not found then raise exception 'FS006_BUDGET_REQUIRED';end if;
 select property_row.* into v_destination from public.properties property_row where property_row.id=v_base.property_id;
 select coalesce(sum(line_row.estimated_line_cost_minor),0),min(line_row.currency),count(*) into v_subtotal,v_currency,v_line_count from public.furnishing_procurement_lines line_row join public.furnishing_product_offers offer_row on offer_row.id=line_row.selected_offer_id where line_row.baseline_id=v_base.id and line_row.status in('planned','ready') and offer_row.retailer_id=v_retailer_id and offer_row.status='active' and offer_row.availability<>'out_of_stock';
 if v_line_count=0 then raise exception 'FS006_NO_ELIGIBLE_LINES';end if;
 insert into public.furnishing_purchase_batches(baseline_id,budget_id,retailer_id,delivery_destination,status,subtotal_minor,total_minor,currency,readiness_snapshot,idempotency_key,created_by,submitted_by) values(v_base.id,v_budget.id,v_retailer_id,jsonb_build_object('address',v_destination.address_line_1,'city',v_destination.city,'state',v_destination.state,'postal_code',v_destination.postal_code,'country',v_destination.country),'submitted',v_subtotal,v_subtotal,v_currency,jsonb_build_object('lineCount',v_line_count,'evaluatedAt',now()),v_key,v_actor,v_actor) returning * into v_batch;
 insert into public.furnishing_purchase_batch_lines(batch_id,line_id,quantity,confirmed_unit_price_minor,offer_confirmation) select v_batch.id,line_row.id,line_row.procurement_quantity,offer_row.listed_price_minor,jsonb_build_object('offerId',offer_row.id,'productId',offer_row.product_id,'listedPriceMinor',offer_row.listed_price_minor,'availability',offer_row.availability,'verifiedAt',offer_row.last_verified_at) from public.furnishing_procurement_lines line_row join public.furnishing_product_offers offer_row on offer_row.id=line_row.selected_offer_id where line_row.baseline_id=v_base.id and line_row.status in('planned','ready') and offer_row.retailer_id=v_retailer_id and offer_row.status='active' and offer_row.availability<>'out_of_stock';
 update public.furnishing_procurement_baselines baseline_row set status='under_review',version=baseline_row.version+1 where baseline_row.id=v_base.id;
 insert into public.furnishing_procurement_events(baseline_id,workspace_id,property_id,project_id,actor_id,correlation_id,event_type,previous_version,resulting_version,policy_version,related_type,related_id,payload) values(v_base.id,v_base.workspace_id,v_base.property_id,v_base.project_id,v_actor,v_correlation,'purchase_batch_submitted',v_base.version,v_base.version+1,'fs008e-v1','purchase_batch',v_batch.id,jsonb_build_object('retailerId',v_retailer_id,'lineCount',v_line_count,'totalMinor',v_subtotal));
 return jsonb_build_object('status','created','id',v_batch.id,'version',1,'baseline_version',v_base.version+1);
end $$;

create or replace function public.record_external_retailer_order(p_input jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid();v_batch_id uuid;v_expected bigint;v_correlation uuid;v_external_id text:=left(trim(p_input->>'external_order_id'),200);v_key text:=left(trim(p_input->>'idempotency_key'),200);v_placed date;v_batch public.furnishing_purchase_batches%rowtype;v_base public.furnishing_procurement_baselines%rowtype;v_retailer public.furnishing_retailers%rowtype;v_order public.furnishing_procurement_orders%rowtype;
begin
 if v_actor is null or not public.is_admin() then raise exception 'PROCUREMENT_ADMIN_REQUIRED' using errcode='42501';end if;
 begin v_batch_id:=(p_input->>'batch_id')::uuid;v_expected:=(p_input->>'expected_version')::bigint;v_correlation:=(p_input->>'correlation_id')::uuid;v_placed:=coalesce(nullif(p_input->>'order_date','')::date,current_date);exception when others then raise exception 'EXTERNAL_ORDER_COMMAND_INVALID';end;
 if length(v_external_id)=0 or length(v_key)<8 then raise exception 'EXTERNAL_ORDER_COMMAND_INVALID';end if;
 select batch_row.* into v_batch from public.furnishing_purchase_batches batch_row where batch_row.id=v_batch_id for update;if not found then raise exception 'PROCUREMENT_BATCH_NOT_FOUND';end if;
 select baseline_row.* into v_base from public.furnishing_procurement_baselines baseline_row where baseline_row.id=v_batch.baseline_id for update;
 select retailer_row.* into v_retailer from public.furnishing_retailers retailer_row where retailer_row.id=v_batch.retailer_id;
 select order_row.* into v_order from public.furnishing_procurement_orders order_row where order_row.batch_id=v_batch.id for update;
 if found then if v_order.external_order_id=v_external_id and v_order.evidence->>'idempotencyKey'=v_key then return jsonb_build_object('status','replayed','id',v_order.id,'version',v_order.version);end if;raise exception 'EXTERNAL_ORDER_REPLAY_CONFLICT';end if;
 if v_batch.version<>v_expected then raise exception 'PROCUREMENT_VERSION_STALE';end if;if v_batch.status<>'authorized' then raise exception 'PROCUREMENT_BATCH_NOT_AUTHORIZED';end if;
 insert into public.furnishing_procurement_orders(project_id,baseline_id,batch_id,workspace_id,retailer_id,po_number,vendor,order_type,external_order_id,status,total,order_date,placed_at,authorized_total_minor,actual_total_minor,currency,evidence) values(v_base.project_id,v_base.id,v_batch.id,v_base.workspace_id,v_batch.retailer_id,'EXT-'||replace(gen_random_uuid()::text,'-',''),v_retailer.name,'external',v_external_id,'ordered',v_batch.total_minor/100.0,v_placed,now(),v_batch.total_minor,v_batch.total_minor,v_batch.currency,jsonb_build_object('idempotencyKey',v_key,'recordedAt',now())) returning * into v_order;
 insert into public.furnishing_procurement_order_lines(order_id,procurement_line_id,snapshot,ordered_quantity,unit_price_minor,line_total_minor,currency) select v_order.id,batch_line.line_id,batch_line.offer_confirmation,batch_line.quantity,batch_line.confirmed_unit_price_minor,round(batch_line.confirmed_unit_price_minor*batch_line.quantity),line_row.currency from public.furnishing_purchase_batch_lines batch_line join public.furnishing_procurement_lines line_row on line_row.id=batch_line.line_id where batch_line.batch_id=v_batch.id;
 update public.furnishing_purchase_batches batch_row set status='ordered',version=batch_row.version+1 where batch_row.id=v_batch.id;
 update public.furnishing_procurement_lines line_row set status='ordered',committed_quantity=batch_line.quantity,revision=line_row.revision+1 from public.furnishing_purchase_batch_lines batch_line where batch_line.batch_id=v_batch.id and line_row.id=batch_line.line_id;
 update public.furnishing_procurement_baselines baseline_row set status='active',version=baseline_row.version+1 where baseline_row.id=v_base.id;
 insert into public.furnishing_procurement_events(baseline_id,workspace_id,property_id,project_id,actor_id,correlation_id,event_type,previous_version,resulting_version,policy_version,related_type,related_id,payload) values(v_base.id,v_base.workspace_id,v_base.property_id,v_base.project_id,v_actor,v_correlation,'external_retailer_order_recorded',v_base.version,v_base.version+1,'fs008e-v1','order',v_order.id,jsonb_build_object('batchId',v_batch.id,'externalOrderId',v_external_id,'totalMinor',v_batch.total_minor));
 return jsonb_build_object('status','recorded','id',v_order.id,'version',1);
end $$;

-- Rebind analyzer-sensitive FS-008G functions with explicit extension resolution.
alter function public.apply_fs008g_c6_catalog_import(jsonb) set search_path=public,extensions,pg_temp;
alter function public.issue_fs008g_furnishing_command_context(jsonb) set search_path=public,extensions,pg_temp;

revoke all on function public.approve_furnishing_package_version(uuid,integer,text,text,text),public.create_or_replay_procurement_batch(jsonb),public.record_external_retailer_order(jsonb) from public,anon;
grant execute on function public.approve_furnishing_package_version(uuid,integer,text,text,text),public.create_or_replay_procurement_batch(jsonb),public.record_external_retailer_order(jsonb) to authenticated;
commit;
