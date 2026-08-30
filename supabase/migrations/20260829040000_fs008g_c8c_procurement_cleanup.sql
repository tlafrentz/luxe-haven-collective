-- FS-008G-C8-C: snapshot-only procurement, safe projections and governed cleanup.
begin;

alter table public.fs008d_project_catalog_snapshots add column if not exists archived_at timestamptz;
alter table public.fs008d_snapshot_items add column if not exists archived_at timestamptz;
alter table public.furnishing_procurement_baselines add column if not exists archived_at timestamptz;
alter table public.furnishing_procurement_lines add column if not exists archived_at timestamptz;
alter table public.furnishing_purchase_batches add column if not exists archived_at timestamptz;
alter table public.furnishing_purchase_batch_lines add column if not exists archived_at timestamptz;
alter table public.furnishing_procurement_orders add column if not exists archived_at timestamptz;
alter table public.furnishing_procurement_receipts add column if not exists archived_at timestamptz;
alter table public.furnishing_procurement_exceptions add column if not exists archived_at timestamptz;
alter table public.furnishing_project_procurement_budgets add column if not exists archived_at timestamptz;
create unique index if not exists furnishing_procurement_line_one_batch on public.furnishing_purchase_batch_lines(line_id) where archived_at is null;

create table public.furnishing_procurement_discrepancy_history(
 id uuid primary key default gen_random_uuid(), exception_id uuid not null references public.furnishing_procurement_exceptions(id),
 baseline_id uuid not null references public.furnishing_procurement_baselines(id), from_status text not null,to_status text not null,
 reason text not null, snapshot jsonb not null, actor_id uuid not null references public.profiles(id),correlation_id uuid not null,
 idempotency_key text not null unique,occurred_at timestamptz not null default now()
);
create table public.furnishing_procurement_adjustments(
 id uuid primary key default gen_random_uuid(),baseline_id uuid not null references public.furnishing_procurement_baselines(id),
 amount_minor bigint not null,reason text not null,expected_version bigint not null,actor_id uuid not null references public.profiles(id),
 correlation_id uuid not null,idempotency_key text not null unique,created_at timestamptz not null default now()
);
alter table public.furnishing_procurement_adjustments add column if not exists archived_at timestamptz;
create table public.furnishing_cleanup_runs(
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.owners(id),project_id uuid not null references public.furnishing_projects(id),
 actor_id uuid not null references public.profiles(id),reason text not null,correlation_id uuid not null,idempotency_key text not null unique,
 reconciliation jsonb not null,created_at timestamptz not null default now()
);
create table public.furnishing_controlled_fixture_designations(
 id uuid primary key default gen_random_uuid(),project_id uuid references public.furnishing_projects(id),workspace_id uuid not null references public.owners(id),
 controlled_customer_account_id uuid references public.customer_accounts(id),controlled_property_id uuid references public.properties(id),
 tenant_id uuid not null references public.owners(id),controlled_run_id uuid not null,candidate_commit text not null check(length(candidate_commit) between 7 and 64),
 correlation_id uuid not null,purpose text not null check(length(trim(purpose))>=3),created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
 expires_at timestamptz not null check(expires_at>created_at),revoked_at timestamptz,cleaned_at timestamptz,unique(controlled_run_id,correlation_id)
);
create unique index furnishing_controlled_fixture_project_once on public.furnishing_controlled_fixture_designations(project_id) where project_id is not null;

create or replace function public.designate_fs008g_controlled_project(p_input jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare workspace uuid;run_id uuid;correlation uuid;actor uuid;candidate text;purpose text;expiry timestamptz;d public.furnishing_controlled_fixture_designations%rowtype;
begin
 if auth.role()<>'service_role' then raise exception 'FS008G_FIXTURE_SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 begin workspace:=(p_input->>'workspace_id')::uuid;run_id:=(p_input->>'controlled_run_id')::uuid;correlation:=(p_input->>'correlation_id')::uuid;actor:=(p_input->>'created_by')::uuid;expiry:=(p_input->>'expires_at')::timestamptz;exception when others then raise exception 'FS008G_FIXTURE_DESIGNATION_INVALID';end;
 candidate:=trim(p_input->>'candidate_commit');purpose:=trim(p_input->>'purpose');if length(candidate)<7 or length(purpose)<3 or expiry<=now() or expiry>now()+interval '24 hours' then raise exception 'FS008G_FIXTURE_DESIGNATION_INVALID';end if;
 if not exists(select 1 from public.ps001d_verification_tenants v where v.tenant_id=workspace and v.designation='PS001D_VERIFICATION_ONLY_NON_CUSTOMER' and v.status='approved' and v.revoked_at is null and v.expires_at>now()) then raise exception 'FS008G_FIXTURE_TENANT_REQUIRED';end if;
 if exists(select 1 from public.customer_accounts where tenant_id=workspace) or exists(select 1 from public.integration_connections where workspace_id=workspace) then raise exception 'FS008G_FIXTURE_CUSTOMER_DEPENDENCY';end if;
 insert into public.furnishing_controlled_fixture_designations(workspace_id,tenant_id,controlled_run_id,candidate_commit,correlation_id,purpose,created_by,expires_at) values(workspace,workspace,run_id,candidate,correlation,purpose,actor,expiry) returning * into d;
 return jsonb_build_object('status','created','designationId',d.id,'controlledRunId',run_id);
end$$;

create or replace function public.bind_fs008g_controlled_project(p_input jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare designation_id uuid;v_project_id uuid;account_id uuid;property_id uuid;run_id uuid;correlation uuid;actor uuid;candidate text;d public.furnishing_controlled_fixture_designations%rowtype;p public.furnishing_projects%rowtype;
begin
 if auth.role()<>'service_role' then raise exception 'FS008G_FIXTURE_SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 begin designation_id:=(p_input->>'designation_id')::uuid;v_project_id:=(p_input->>'project_id')::uuid;account_id:=(p_input->>'customer_account_id')::uuid;property_id:=(p_input->>'property_id')::uuid;run_id:=(p_input->>'controlled_run_id')::uuid;correlation:=(p_input->>'correlation_id')::uuid;actor:=(p_input->>'created_by')::uuid;exception when others then raise exception 'FS008G_FIXTURE_BINDING_INVALID';end;
 candidate:=trim(p_input->>'candidate_commit');
 select * into d from public.furnishing_controlled_fixture_designations where id=designation_id for update;
 if not found or d.project_id is not null or d.revoked_at is not null or d.cleaned_at is not null or d.expires_at<=now() or d.controlled_run_id<>run_id or d.correlation_id<>correlation or d.created_by<>actor or d.candidate_commit<>candidate then raise exception 'FS008G_FIXTURE_BINDING_INVALID';end if;
 select * into p from public.furnishing_projects where id=v_project_id and workspace_id=d.workspace_id for update;
 if not found or p.created_by<>actor or p.created_at<d.created_at or p.property_id<>property_id or p.name not like 'C8-D Isolated Furnishing Lifecycle%' then raise exception 'FS008G_FIXTURE_PROJECT_INVALID';end if;
 if not exists(select 1 from public.properties x where x.id=property_id and x.owner_id=d.workspace_id and x.created_at>=d.created_at and x.name like 'FS008G C8 Isolated Property%') then raise exception 'FS008G_FIXTURE_PROPERTY_INVALID';end if;
 if not exists(select 1 from public.customer_accounts x join public.customer_account_memberships m on m.customer_account_id=x.id and m.tenant_id=x.tenant_id where x.id=account_id and x.tenant_id=d.workspace_id and x.created_at>=d.created_at and m.profile_id=actor and m.status='active') then raise exception 'FS008G_FIXTURE_CUSTOMER_ACCOUNT_INVALID';end if;
 if exists(select 1 from public.customer_accounts where tenant_id=d.workspace_id and id<>account_id) or exists(select 1 from public.integration_connections where workspace_id=d.workspace_id) then raise exception 'FS008G_FIXTURE_CUSTOMER_DEPENDENCY';end if;
 update public.furnishing_controlled_fixture_designations set project_id=v_project_id,controlled_customer_account_id=account_id,controlled_property_id=property_id where id=d.id returning * into d;
 return jsonb_build_object('status','bound','designationId',d.id,'projectId',d.project_id);
end$$;

create or replace function public.provision_fs008g_c8_controlled_tenant(p_workspace_id uuid,p_admin_id uuid,p_owner_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.owners%rowtype;a public.profiles%rowtype;o public.profiles%rowtype;
begin
 if auth.role()<>'service_role' then raise exception 'FS008G_FIXTURE_SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 select * into w from public.owners where id=p_workspace_id for update;select * into a from public.profiles where id=p_admin_id;select * into o from public.profiles where id=p_owner_id;
 if not found or w.profile_id<>p_owner_id or w.company_name not like 'FS008G C8 %' or a.role<>'admin' or o.role<>'owner' or a.email not like 'fs008g-c8-admin-%@example.invalid' or o.email not like 'fs008g-c8-owner-%@example.invalid' then raise exception 'FS008G_FIXTURE_IDENTITY_INVALID';end if;
 if exists(select 1 from public.customer_accounts where tenant_id=p_workspace_id) or exists(select 1 from public.integration_connections where workspace_id=p_workspace_id) then raise exception 'FS008G_FIXTURE_SCOPE_INVALID';end if;
 insert into public.ps001d_verification_tenants(tenant_id,designation,status,approved_by,expires_at,relationship_attestation) values(p_workspace_id,'PS001D_VERIFICATION_ONLY_NON_CUSTOMER','approved',p_admin_id,now()+interval '24 hours','{"automation":false,"catalog":false,"customer":false,"payment":false,"provider":false,"publication":false}'::jsonb) on conflict(tenant_id) do nothing;
 return jsonb_build_object('status','provisioned','workspaceId',p_workspace_id);
end$$;
create or replace function public.cleanup_fs008g_c8_controlled_tenant(p_workspace_id uuid,p_admin_id uuid,p_owner_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.role()<>'service_role' then raise exception 'FS008G_FIXTURE_SERVICE_ROLE_REQUIRED' using errcode='42501';end if;
 if not exists(select 1 from public.owners w join public.profiles o on o.id=w.profile_id join public.profiles a on a.id=p_admin_id where w.id=p_workspace_id and w.profile_id=p_owner_id and w.company_name like 'FS008G C8 %' and o.email like 'fs008g-c8-owner-%@example.invalid' and a.email like 'fs008g-c8-admin-%@example.invalid') then raise exception 'FS008G_FIXTURE_IDENTITY_INVALID';end if;
 delete from public.ps001d_verification_tenants where tenant_id=p_workspace_id;
 return jsonb_build_object('status','cleaned','workspaceId',p_workspace_id);
end$$;

create or replace function public.assert_fs008g_procurement_mutation_enabled() returns void language plpgsql stable security definer set search_path=public,pg_temp as $$declare r record;begin
 if current_setting('app.fs008g_cleanup',true)='on' then return;end if;
 select * into r from public.furnishing_activation_releases where milestone='FS-008A';
 if not found or r.global_state<>'internal' or r.global_kill_switch or not r.configuration_valid then raise exception 'FURNISHING_ACTIVATION_DISABLED' using errcode='42501';end if;
end$$;
create or replace function public.guard_fs008g_procurement_mutation() returns trigger language plpgsql set search_path=public,pg_temp as $$begin perform public.assert_fs008g_procurement_mutation_enabled();return null;end$$;
do $$declare t text;begin foreach t in array array['furnishing_procurement_baselines','furnishing_procurement_lines','furnishing_purchase_batches','furnishing_purchase_batch_lines','furnishing_procurement_orders','furnishing_procurement_order_lines','furnishing_procurement_receipts','furnishing_procurement_receipt_lines','furnishing_procurement_exceptions','furnishing_project_procurement_budgets','furnishing_procurement_adjustments'] loop execute format('drop trigger if exists fs008g_kill_switch_guard on public.%I',t);execute format('create trigger fs008g_kill_switch_guard before insert or update or delete on public.%I for each statement execute function public.guard_fs008g_procurement_mutation()',t);end loop;end$$;

create or replace function public.create_or_replay_procurement_baseline(p_input jsonb) returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a uuid:=auth.uid();sid uuid;expected bigint;correlation uuid;command_key text:=left(trim(p_input->>'idempotency_key'),200);s public.fs008d_project_catalog_snapshots%rowtype;p public.furnishing_projects%rowtype;b public.furnishing_procurement_baselines%rowtype;line_count integer;currency_code text;subtotal bigint;shipping bigint;
begin
 if a is null or not public.is_admin() then raise exception 'PROCUREMENT_ADMIN_REQUIRED' using errcode='42501';end if;perform public.assert_fs008g_procurement_mutation_enabled();
 if p_input->>'source_kind'<>'catalog_snapshot' then raise exception 'PROCUREMENT_SNAPSHOT_SOURCE_REQUIRED';end if;
 begin sid:=(p_input->>'source_id')::uuid;expected:=(p_input->>'expected_source_version')::bigint;correlation:=(p_input->>'correlation_id')::uuid;exception when others then raise exception 'PROCUREMENT_BASELINE_COMMAND_INVALID';end;
 if length(command_key)<8 then raise exception 'PROCUREMENT_BASELINE_COMMAND_INVALID';end if;
 select x.* into s from public.fs008d_project_catalog_snapshots x where x.id=sid and x.archived_at is null for update;if not found then raise exception 'PROCUREMENT_AUTHORITATIVE_SNAPSHOT_REQUIRED';end if;
 select x.* into p from public.furnishing_projects x where x.id=s.project_id for update;if not found or s.tenant_id is distinct from p.workspace_id or s.approved_plan_id is distinct from p.current_plan_version_id then raise exception 'PROCUREMENT_SOURCE_SCOPE_INVALID';end if;
 if s.plan_revision<>expected then raise exception 'PROCUREMENT_SOURCE_VERSION_STALE';end if;
 if coalesce(s.content_hash,'')='' or not exists(select 1 from public.fs008d_snapshot_items i where i.snapshot_id=s.id and i.archived_at is null) then raise exception 'PROCUREMENT_SNAPSHOT_NOT_NORMALIZED';end if;
 if exists(select 1 from public.fs008d_snapshot_items i left join public.furnishing_product_offers o on o.id=i.retailer_offer_id where i.snapshot_id=s.id and(i.archived_at is not null or i.tenant_id is distinct from p.workspace_id or i.project_id is distinct from p.id or o.product_id is distinct from i.product_id or i.observed_price_minor is null or i.extended_product_cost_minor<>i.observed_price_minor*i.quantity)) then raise exception 'PROCUREMENT_SNAPSHOT_NOT_NORMALIZED';end if;
 perform pg_advisory_xact_lock(hashtextextended(p.id::text,0));select x.* into b from public.furnishing_procurement_baselines x where x.project_id=p.id and x.archived_at is null for update;
 if found then if b.source_kind<>'catalog_snapshot' or b.source_catalog_snapshot_id<>s.id or b.source_plan_id is not null or b.source_plan_version<>expected or b.source_hash<>s.content_hash or b.idempotency_key<>command_key then raise exception 'PROCUREMENT_BASELINE_REPLAY_CONFLICT';end if;return jsonb_build_object('status','replayed','id',b.id,'version',b.version,'source_hash',b.source_hash);end if;
 select min(i.currency),sum(i.extended_product_cost_minor),sum(i.delivery_minor) into currency_code,subtotal,shipping from public.fs008d_snapshot_items i where i.snapshot_id=s.id and i.archived_at is null;
 insert into public.furnishing_procurement_baselines(workspace_id,property_id,project_id,source_kind,source_catalog_snapshot_id,source_plan_version,source_snapshot,source_hash,currency,status,estimated_subtotal_minor,estimated_shipping_minor,estimated_tax_minor,estimated_total_minor,idempotency_key,created_by) values(p.workspace_id,p.property_id,p.id,'catalog_snapshot',s.id,expected,jsonb_build_object('schemaVersion','fs008g-c8c-v1','snapshotId',s.id,'contentHash',s.content_hash),s.content_hash,currency_code,'draft',subtotal,shipping,0,subtotal+shipping,command_key,a) returning * into b;
 insert into public.furnishing_procurement_lines(baseline_id,source_line_kind,source_snapshot_item_id,room_id,product_id,selected_offer_id,category,description,planned_quantity,procurement_quantity,existing_inventory_quantity,estimated_unit_cost_minor,estimated_line_cost_minor,currency,status,source_snapshot) select b.id,'snapshot_item',i.id,i.room_id,i.product_id,i.retailer_offer_id,pd.category,pd.name,i.quantity,i.quantity,0,i.observed_price_minor,i.extended_product_cost_minor,i.currency,'planned',jsonb_build_object('stableItemId',i.stable_item_id,'contentHash',i.content_hash,'deliveryMinor',i.delivery_minor,'sourceLineage',i.source_lineage) from public.fs008d_snapshot_items i join public.furnishing_products pd on pd.id=i.product_id where i.snapshot_id=s.id and i.archived_at is null;get diagnostics line_count=row_count;if line_count=0 then raise exception 'PROCUREMENT_SOURCE_HAS_NO_LINES';end if;
 insert into public.furnishing_procurement_events(baseline_id,workspace_id,property_id,project_id,actor_id,correlation_id,event_type,resulting_version,policy_version,related_type,related_id,payload) values(b.id,p.workspace_id,p.property_id,p.id,a,correlation,'procurement_baseline_generated',1,'fs008g-c8c-v1','catalog_snapshot',s.id,jsonb_build_object('sourceHash',s.content_hash,'lineCount',line_count,'externalEffects',false));return jsonb_build_object('status','created','id',b.id,'version',1,'source_hash',s.content_hash);
end$$;

create or replace function public.resolve_furnishing_procurement_discrepancy(p_input jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a uuid:=auth.uid();target uuid;correlation uuid;command_key text:=left(trim(p_input->>'idempotency_key'),200);why text:=left(trim(p_input->>'reason'),500);x public.furnishing_procurement_exceptions%rowtype;prior public.furnishing_procurement_discrepancy_history%rowtype;
begin if a is null or not public.is_admin() then raise exception 'PROCUREMENT_ADMIN_REQUIRED' using errcode='42501';end if;perform public.assert_fs008g_procurement_mutation_enabled();begin target:=(p_input->>'exception_id')::uuid;correlation:=(p_input->>'correlation_id')::uuid;exception when others then raise exception 'DISCREPANCY_COMMAND_INVALID';end;if length(why)<3 or length(command_key)<8 then raise exception 'DISCREPANCY_REASON_REQUIRED';end if;
 select h.* into prior from public.furnishing_procurement_discrepancy_history h where h.idempotency_key=command_key;if found then if prior.exception_id<>target or prior.reason<>why then raise exception 'DISCREPANCY_REPLAY_CONFLICT';end if;return jsonb_build_object('status','replayed','id',prior.id);end if;
 select e.* into x from public.furnishing_procurement_exceptions e where e.id=target for update;if not found then raise exception 'DISCREPANCY_NOT_FOUND';end if;if x.status='resolved' then raise exception 'DISCREPANCY_ALREADY_RESOLVED';end if;
 update public.furnishing_procurement_exceptions set status='resolved',resolution=jsonb_build_object('resolvedAt',now(),'reason',why,'actorId',a) where id=x.id;
 insert into public.furnishing_procurement_discrepancy_history(exception_id,baseline_id,from_status,to_status,reason,snapshot,actor_id,correlation_id,idempotency_key) values(x.id,x.baseline_id,x.status,'resolved',why,to_jsonb(x),a,correlation,command_key) returning * into prior;return jsonb_build_object('status','resolved','id',prior.id);end$$;

create or replace function public.adjust_furnishing_procurement_budget(p_input jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a uuid:=auth.uid();target uuid;expected bigint;amount bigint;correlation uuid;why text:=left(trim(p_input->>'reason'),500);command_key text:=left(trim(p_input->>'idempotency_key'),200);b public.furnishing_procurement_baselines%rowtype;x public.furnishing_procurement_adjustments%rowtype;
begin if a is null or not public.is_admin() then raise exception 'PROCUREMENT_ADMIN_REQUIRED' using errcode='42501';end if;perform public.assert_fs008g_procurement_mutation_enabled();begin target:=(p_input->>'baseline_id')::uuid;expected:=(p_input->>'expected_version')::bigint;amount:=(p_input->>'amount_minor')::bigint;correlation:=(p_input->>'correlation_id')::uuid;exception when others then raise exception 'PROCUREMENT_ADJUSTMENT_COMMAND_INVALID';end;if length(why)<3 or length(command_key)<8 then raise exception 'PROCUREMENT_ADJUSTMENT_REASON_REQUIRED';end if;
 select y.* into x from public.furnishing_procurement_adjustments y where y.idempotency_key=command_key;if found then if x.baseline_id<>target or x.expected_version<>expected or x.amount_minor<>amount or x.reason<>why then raise exception 'PROCUREMENT_ADJUSTMENT_REPLAY_CONFLICT';end if;return jsonb_build_object('status','replayed','id',x.id);end if;
 select y.* into b from public.furnishing_procurement_baselines y where y.id=target for update;if not found then raise exception 'PROCUREMENT_BASELINE_NOT_FOUND';end if;if b.version<>expected then raise exception 'PROCUREMENT_VERSION_STALE';end if;
 insert into public.furnishing_procurement_adjustments(baseline_id,amount_minor,reason,expected_version,actor_id,correlation_id,idempotency_key) values(b.id,amount,why,expected,a,correlation,command_key) returning * into x;update public.furnishing_procurement_baselines set estimated_total_minor=estimated_total_minor+amount,version=version+1 where id=b.id;return jsonb_build_object('status','adjusted','id',x.id,'baseline_version',expected+1);end$$;

create or replace function public.get_furnishing_customer_procurement(p_project_id uuid) returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$declare p public.furnishing_projects%rowtype;b public.furnishing_procurement_baselines%rowtype;result jsonb;begin
 select x.* into p from public.furnishing_projects x where x.id=p_project_id;if not found or not public.fs008g_owner_selection_eligible(p.workspace_id) then raise exception 'PROCUREMENT_CUSTOMER_ACCESS_DENIED' using errcode='42501';end if;select x.* into b from public.furnishing_procurement_baselines x where x.project_id=p.id and x.archived_at is null order by x.version desc limit 1;
 if not found then return jsonb_build_object('projectName',p.name,'status','not_started','ordered',0,'received',0,'accepted',0,'currency','USD','approvedBudgetMinor',null);end if;
 select jsonb_build_object('projectName',p.name,'status',b.status,'ordered',coalesce(sum(l.committed_quantity),0),'received',coalesce(sum(l.received_quantity),0),'accepted',coalesce(sum(l.accepted_quantity),0),'currency',b.currency,'approvedBudgetMinor',(select base_amount_minor+contingency_minor from public.furnishing_project_procurement_budgets budget where budget.baseline_id=b.id and budget.status in('approved','active') order by version desc limit 1)) into result from public.furnishing_procurement_lines l where l.baseline_id=b.id and l.archived_at is null;return result;end$$;

create or replace function public.prevent_fs008d_snapshot_mutation() returns trigger language plpgsql set search_path=public as $$begin if current_setting('app.fs008g_cleanup',true)='on' and old.archived_at is null and new.archived_at is not null then return new;end if;raise exception 'FS008D_SNAPSHOT_IMMUTABLE';end$$;
create or replace function public.prevent_fs008d_snapshot_item_mutation() returns trigger language plpgsql set search_path=public as $$begin if current_setting('app.fs008g_cleanup',true)='on' and old.archived_at is null and new.archived_at is not null then return new;end if;raise exception 'FS008D_SNAPSHOT_ITEM_IMMUTABLE';end$$;

create or replace function public.assert_fs008g_cleanup_dependencies(p_designation_id uuid,p_lock boolean default false)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.furnishing_controlled_fixture_designations%rowtype;
begin
 select * into d from public.furnishing_controlled_fixture_designations where id=p_designation_id;
 if not found or d.project_id is null then raise exception 'CLEANUP_DESIGNATION_INVALID';end if;
 if p_lock then
   perform 1 from public.furnishing_plans where project_id=d.project_id for update;
   perform 1 from public.furnishing_budgets where project_id=d.project_id for update;
   perform 1 from public.furnishing_procurement_items where project_id=d.project_id for update;
   perform 1 from public.fs008d_project_catalog_snapshots where project_id=d.project_id for update;
   perform 1 from public.fs008d_snapshot_items where project_id=d.project_id for update;
   perform 1 from public.furnishing_procurement_baselines where project_id=d.project_id for update;
   perform 1 from public.furnishing_project_procurement_budgets where project_id=d.project_id for update;
   perform 1 from public.furnishing_procurement_orders where project_id=d.project_id for update;
   perform 1 from public.furnishing_installation_projects where project_id=d.project_id for update;
   perform 1 from public.notifications where workspace_id=d.workspace_id and (subject_id=d.project_id::text or action_url like '%'||d.project_id::text||'%') for update;
   perform 1 from public.commerce_payments where workspace_id=d.workspace_id for update;
 end if;
 if exists(select 1 from public.customer_accounts where tenant_id=d.workspace_id and id is distinct from d.controlled_customer_account_id)
   or not exists(select 1 from public.customer_accounts where id=d.controlled_customer_account_id and tenant_id=d.workspace_id)
   or exists(select 1 from public.integration_connections where workspace_id=d.workspace_id)
 then raise exception 'CLEANUP_CUSTOMER_OR_PROVIDER_DEPENDENCY';end if;
 if exists(select 1 from public.notifications where workspace_id=d.workspace_id and (subject_id=d.project_id::text or action_url like '%'||d.project_id::text||'%')) then raise exception 'CLEANUP_NOTIFICATION_DEPENDENCY';end if;
 if exists(select 1 from public.commerce_payments where workspace_id=d.workspace_id) then raise exception 'CLEANUP_PAYMENT_DEPENDENCY';end if;
 if exists(select 1 from public.furnishing_procurement_orders where project_id=d.project_id and (external_order_id is not null or status in('ordered','partially_fulfilled','shipped','delivered','returned','refunded'))) then raise exception 'CLEANUP_RETAILER_ORDER_DEPENDENCY';end if;
 if exists(select 1 from public.furnishing_installation_projects where project_id=d.project_id)
   or exists(select 1 from public.furnishing_installation_tasks where project_id=d.project_id and status not in('pending','cancelled','not_required'))
 then raise exception 'CLEANUP_INSTALLATION_DEPENDENCY';end if;
 if exists(select 1 from public.furnishing_procurement_items where project_id=d.project_id and status<>'not_ordered')
   or exists(select 1 from public.furnishing_procurement_exceptions e join public.furnishing_procurement_baselines b on b.id=e.baseline_id where b.project_id=d.project_id and e.status<>'resolved')
 then raise exception 'CLEANUP_NON_CONTROLLED_PROCUREMENT_DEPENDENCY';end if;
 if exists(select 1 from public.furnishing_plans where project_id=d.project_id and created_at<d.created_at)
   or exists(select 1 from public.furnishing_budgets where project_id=d.project_id and created_at<d.created_at)
   or exists(select 1 from public.fs008d_project_catalog_snapshots where project_id=d.project_id and created_at<d.created_at)
 then raise exception 'CLEANUP_NON_CONTROLLED_LIFECYCLE_DEPENDENCY';end if;
end$$;

create or replace function public.prevent_archived_furnishing_project_dependency()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare target uuid;
begin
 target:=case tg_table_name
   when 'furnishing_plans' then new.project_id
   when 'furnishing_budgets' then new.project_id
   when 'furnishing_procurement_items' then new.project_id
   when 'furnishing_procurement_baselines' then new.project_id
   when 'furnishing_project_procurement_budgets' then new.project_id
   when 'furnishing_procurement_orders' then new.project_id
   when 'furnishing_installation_projects' then new.project_id
   when 'fs008d_project_catalog_snapshots' then new.project_id
   else null end;
 if target is not null and exists(select 1 from public.furnishing_projects where id=target and lifecycle_status='archived') then raise exception 'FURNISHING_PROJECT_ARCHIVED_DEPENDENCY_DENIED';end if;
 return new;
end$$;
do $$declare t text;begin foreach t in array array['furnishing_plans','furnishing_budgets','furnishing_procurement_items','furnishing_procurement_baselines','furnishing_project_procurement_budgets','furnishing_procurement_orders','furnishing_installation_projects','fs008d_project_catalog_snapshots'] loop execute format('drop trigger if exists prevent_archived_furnishing_project_dependency on public.%I',t);execute format('create trigger prevent_archived_furnishing_project_dependency before insert or update on public.%I for each row execute function public.prevent_archived_furnishing_project_dependency()',t);end loop;end$$;

create or replace function public.lock_fs008g_controlled_fixture_dependency()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare workspace uuid;d public.furnishing_controlled_fixture_designations%rowtype;p public.furnishing_projects%rowtype;
begin
 if tg_table_name='customer_accounts' then workspace:=new.tenant_id;
 elsif tg_table_name='integration_connections' then workspace:=new.workspace_id;
 elsif tg_table_name='notifications' then workspace:=new.workspace_id;
 elsif tg_table_name='commerce_payments' then workspace:=new.workspace_id;
 else raise exception 'FS008G_CONTROLLED_FIXTURE_DEPENDENCY_TABLE_INVALID';end if;
 if workspace is null then return new;end if;
 select * into d from public.furnishing_controlled_fixture_designations where workspace_id=workspace and project_id is not null order by created_at desc limit 1;
 if not found then return new;end if;
 select * into p from public.furnishing_projects where id=d.project_id for key share;
 if not found or p.lifecycle_status='archived' or d.cleaned_at is not null or d.revoked_at is not null then raise exception 'FS008G_CONTROLLED_FIXTURE_DEPENDENCY_CLOSED';end if;
 return new;
end$$;
do $$declare t text;begin foreach t in array array['customer_accounts','integration_connections','notifications','commerce_payments'] loop execute format('drop trigger if exists lock_fs008g_controlled_fixture_dependency on public.%I',t);execute format('create trigger lock_fs008g_controlled_fixture_dependency before insert or update on public.%I for each row execute function public.lock_fs008g_controlled_fixture_dependency()',t);end loop;end$$;

create or replace function public.cleanup_fs008g_synthetic_project(p_input jsonb) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a uuid;designation_id uuid;v_project_id uuid;v_workspace_id uuid;correlation uuid;candidate text;controlled_run uuid;command_key text:=left(trim(p_input->>'idempotency_key'),200);why text:=left(trim(p_input->>'reason'),500);before_counts jsonb;recon jsonb;run public.furnishing_cleanup_runs%rowtype;d public.furnishing_controlled_fixture_designations%rowtype;
begin if auth.role()<>'service_role' then raise exception 'FS008G_FIXTURE_SERVICE_ROLE_REQUIRED' using errcode='42501';end if;begin designation_id:=(p_input->>'designation_id')::uuid;v_project_id:=(p_input->>'project_id')::uuid;v_workspace_id:=(p_input->>'workspace_id')::uuid;controlled_run:=(p_input->>'controlled_run_id')::uuid;correlation:=(p_input->>'correlation_id')::uuid;a:=(p_input->>'actor_id')::uuid;exception when others then raise exception 'CLEANUP_COMMAND_INVALID';end;candidate:=trim(p_input->>'candidate_commit');if length(why)<3 or length(command_key)<8 or length(candidate)<7 then raise exception 'CLEANUP_REASON_REQUIRED';end if;
	 select x.* into run from public.furnishing_cleanup_runs x where x.idempotency_key=command_key;if found then select * into d from public.furnishing_controlled_fixture_designations where id=designation_id;if not found or run.project_id<>v_project_id or run.workspace_id<>v_workspace_id or run.actor_id<>a or run.correlation_id<>correlation or d.project_id<>v_project_id or d.controlled_run_id<>controlled_run or d.candidate_commit<>candidate or d.correlation_id<>correlation or d.created_by<>a or d.cleaned_at is null then raise exception 'CLEANUP_REPLAY_CONFLICT';end if;return jsonb_build_object('status','already_cleaned','id',run.id,'designationId',d.id,'reconciliation',run.reconciliation);end if;
 select * into d from public.furnishing_controlled_fixture_designations where id=designation_id for update;if not found or d.revoked_at is not null or d.cleaned_at is not null or d.expires_at<=now() or d.project_id<>v_project_id or d.workspace_id<>v_workspace_id or d.tenant_id<>v_workspace_id or d.controlled_run_id<>controlled_run or d.candidate_commit<>candidate or d.correlation_id<>correlation or d.created_by<>a then raise exception 'CLEANUP_DESIGNATION_INVALID';end if;
	 perform public.assert_fs008g_cleanup_dependencies(d.id,false);
	 perform 1 from public.furnishing_projects p where p.id=v_project_id and p.workspace_id=v_workspace_id and p.created_by=a and p.created_at>=d.created_at and p.name like 'C8-D Isolated Furnishing Lifecycle%' for update;if not found then raise exception 'CLEANUP_PROJECT_NOT_CONTROLLED';end if;
	 select * into d from public.furnishing_controlled_fixture_designations where id=designation_id for update;if d.revoked_at is not null or d.cleaned_at is not null or d.expires_at<=now() then raise exception 'CLEANUP_DESIGNATION_INVALID';end if;
	 perform public.assert_fs008g_cleanup_dependencies(d.id,true);
	 select jsonb_build_object(
	  'snapshots',(select count(*) from public.fs008d_project_catalog_snapshots where project_id=v_project_id and archived_at is null),
	  'snapshotItems',(select count(*) from public.fs008d_snapshot_items where project_id=v_project_id and archived_at is null),
	  'baselines',(select count(*) from public.furnishing_procurement_baselines where project_id=v_project_id and archived_at is null),
	  'lines',(select count(*) from public.furnishing_procurement_lines l join public.furnishing_procurement_baselines b on b.id=l.baseline_id where b.project_id=v_project_id and l.archived_at is null),
	  'batches',(select count(*) from public.furnishing_purchase_batches x join public.furnishing_procurement_baselines b on b.id=x.baseline_id where b.project_id=v_project_id and x.archived_at is null),
	  'batchLines',(select count(*) from public.furnishing_purchase_batch_lines x join public.furnishing_purchase_batches pb on pb.id=x.batch_id join public.furnishing_procurement_baselines b on b.id=pb.baseline_id where b.project_id=v_project_id and x.archived_at is null),
	  'orders',(select count(*) from public.furnishing_procurement_orders where project_id=v_project_id and archived_at is null),
	  'receipts',(select count(*) from public.furnishing_procurement_receipts r join public.furnishing_procurement_baselines b on b.id=r.baseline_id where b.project_id=v_project_id and r.archived_at is null),
	  'exceptions',(select count(*) from public.furnishing_procurement_exceptions e join public.furnishing_procurement_baselines b on b.id=e.baseline_id where b.project_id=v_project_id and e.archived_at is null),
	  'budgets',(select count(*) from public.furnishing_project_procurement_budgets where project_id=v_project_id and archived_at is null),
	  'adjustments',(select count(*) from public.furnishing_procurement_adjustments x join public.furnishing_procurement_baselines b on b.id=x.baseline_id where b.project_id=v_project_id and x.archived_at is null),
	  'plans',(select count(*) from public.furnishing_plans where project_id=v_project_id and status<>'superseded'),
	  'projects',(select count(*) from public.furnishing_projects where id=v_project_id and lifecycle_status<>'archived')
	 ) into before_counts;
 perform set_config('app.fs008g_cleanup','on',true);
 update public.furnishing_procurement_orders set status=case when status in('cancelled','refunded','delivered') then status else 'cancelled' end,archived_at=now() where furnishing_procurement_orders.project_id=v_project_id and archived_at is null;update public.furnishing_purchase_batch_lines set archived_at=now() where batch_id in(select x.id from public.furnishing_purchase_batches x join public.furnishing_procurement_baselines b on b.id=x.baseline_id where b.project_id=v_project_id);update public.furnishing_purchase_batches set status=case when status='ordered' then 'cancelled' else status end,archived_at=now() where baseline_id in(select id from public.furnishing_procurement_baselines where furnishing_procurement_baselines.project_id=v_project_id);update public.furnishing_procurement_receipts set archived_at=now() where baseline_id in(select id from public.furnishing_procurement_baselines where furnishing_procurement_baselines.project_id=v_project_id);update public.furnishing_procurement_exceptions set archived_at=now() where baseline_id in(select id from public.furnishing_procurement_baselines where furnishing_procurement_baselines.project_id=v_project_id);update public.furnishing_project_procurement_budgets set archived_at=now() where project_id=v_project_id;update public.furnishing_procurement_adjustments set archived_at=now() where baseline_id in(select id from public.furnishing_procurement_baselines where furnishing_procurement_baselines.project_id=v_project_id);update public.furnishing_procurement_lines set archived_at=now() where baseline_id in(select id from public.furnishing_procurement_baselines where furnishing_procurement_baselines.project_id=v_project_id);update public.furnishing_procurement_baselines set status='closed',archived_at=now() where furnishing_procurement_baselines.project_id=v_project_id;update public.fs008d_snapshot_items set archived_at=now() where fs008d_snapshot_items.project_id=v_project_id;update public.fs008d_project_catalog_snapshots set archived_at=now() where fs008d_project_catalog_snapshots.project_id=v_project_id;update public.furnishing_plans set status='superseded' where furnishing_plans.project_id=v_project_id and status<>'superseded';update public.furnishing_projects set lifecycle_status='archived',plan_status='approved' where id=v_project_id;
	 select jsonb_build_object('archivedCounts',before_counts,'activeSnapshots',(select count(*) from public.fs008d_project_catalog_snapshots where fs008d_project_catalog_snapshots.project_id=v_project_id and archived_at is null),'activeBaselines',(select count(*) from public.furnishing_procurement_baselines where furnishing_procurement_baselines.project_id=v_project_id and archived_at is null),'activeLines',(select count(*) from public.furnishing_procurement_lines l join public.furnishing_procurement_baselines b on b.id=l.baseline_id where b.project_id=v_project_id and l.archived_at is null),'activeBatches',(select count(*) from public.furnishing_purchase_batches x join public.furnishing_procurement_baselines b on b.id=x.baseline_id where b.project_id=v_project_id and x.archived_at is null),'activeOrders',(select count(*) from public.furnishing_procurement_orders where furnishing_procurement_orders.project_id=v_project_id and archived_at is null),'openDiscrepancies',(select count(*) from public.furnishing_procurement_exceptions e join public.furnishing_procurement_baselines b on b.id=e.baseline_id where b.project_id=v_project_id and e.status<>'resolved'),'retainedAuditEvents',(select count(*) from public.furnishing_procurement_events e where e.project_id=v_project_id),'retainedCatalogResources',(select count(*) from public.furnishing_products p where p.workspace_id=v_workspace_id and p.status='approved')) into recon;
	 if (recon->>'activeSnapshots')::int+(recon->>'activeBaselines')::int+(recon->>'activeLines')::int+(recon->>'activeBatches')::int+(recon->>'activeOrders')::int+(recon->>'openDiscrepancies')::int<>0 then raise exception 'CLEANUP_RECONCILIATION_FAILED';end if;insert into public.furnishing_cleanup_runs(workspace_id,project_id,actor_id,reason,correlation_id,idempotency_key,reconciliation) values(v_workspace_id,v_project_id,a,why,correlation,command_key,recon) returning * into run;update public.furnishing_controlled_fixture_designations set cleaned_at=now(),revoked_at=now() where id=d.id;return jsonb_build_object('status','clean','id',run.id,'designationId',d.id,'reconciliation',recon);end$$;

alter table public.furnishing_procurement_discrepancy_history enable row level security;alter table public.furnishing_procurement_adjustments enable row level security;alter table public.furnishing_cleanup_runs enable row level security;alter table public.furnishing_controlled_fixture_designations enable row level security;
create policy "Admins read discrepancy history" on public.furnishing_procurement_discrepancy_history for select to authenticated using(public.is_admin());create policy "Admins read adjustments" on public.furnishing_procurement_adjustments for select to authenticated using(public.is_admin());create policy "Admins read cleanup evidence" on public.furnishing_cleanup_runs for select to authenticated using(public.is_admin());
create policy "Admins read controlled fixture designations" on public.furnishing_controlled_fixture_designations for select to authenticated using(public.is_admin() and public.active_workspace_role(workspace_id) is not null);
revoke all on public.furnishing_procurement_discrepancy_history,public.furnishing_procurement_adjustments,public.furnishing_cleanup_runs,public.furnishing_controlled_fixture_designations from public,anon,authenticated;
grant select on public.furnishing_procurement_discrepancy_history,public.furnishing_procurement_adjustments,public.furnishing_cleanup_runs,public.furnishing_controlled_fixture_designations to authenticated;
revoke all on function public.resolve_furnishing_procurement_discrepancy(jsonb),public.adjust_furnishing_procurement_budget(jsonb),public.get_furnishing_customer_procurement(uuid),public.cleanup_fs008g_synthetic_project(jsonb),public.designate_fs008g_controlled_project(jsonb),public.bind_fs008g_controlled_project(jsonb),public.assert_fs008g_cleanup_dependencies(uuid,boolean) from public,anon,authenticated;grant execute on function public.resolve_furnishing_procurement_discrepancy(jsonb),public.adjust_furnishing_procurement_budget(jsonb) to authenticated;grant execute on function public.get_furnishing_customer_procurement(uuid) to authenticated;grant execute on function public.cleanup_fs008g_synthetic_project(jsonb),public.designate_fs008g_controlled_project(jsonb),public.bind_fs008g_controlled_project(jsonb) to service_role;
revoke all on function public.provision_fs008g_c8_controlled_tenant(uuid,uuid,uuid),public.cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.provision_fs008g_c8_controlled_tenant(uuid,uuid,uuid),public.cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid) to service_role;
do $$declare t record;begin
 for t in select schemaname,tablename from pg_tables where schemaname='public' and (tablename like 'furnishing\_%' escape '\' or tablename in('fs008d_project_catalog_snapshots','fs008d_snapshot_items')) loop
  execute format('grant select,insert,update,delete on table %I.%I to service_role',t.schemaname,t.tablename);
 end loop;
end$$;
commit;
