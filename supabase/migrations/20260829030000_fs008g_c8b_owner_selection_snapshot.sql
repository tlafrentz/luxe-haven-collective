-- FS-008G-C8-B: owner selection and server-derived immutable snapshot.
begin;

alter table public.fs008d_project_catalog_snapshots
  add column if not exists approved_plan_id uuid references public.furnishing_plans(id) on delete restrict,
  add column if not exists plan_revision bigint,
  add column if not exists package_composition_hash text,
  add column if not exists source_idempotency_key text;
create unique index if not exists fs008d_one_snapshot_per_approved_plan
  on public.fs008d_project_catalog_snapshots(approved_plan_id) where approved_plan_id is not null;
create unique index if not exists fs008d_snapshot_source_idempotency
  on public.fs008d_project_catalog_snapshots(source_idempotency_key) where source_idempotency_key is not null;

create table public.furnishing_selection_delivery_allocations(
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id),
  project_id uuid not null references public.furnishing_projects(id) on delete cascade,
  selection_id uuid not null references public.furnishing_product_selections(id) on delete cascade,
  property_id uuid not null references public.properties(id), quantity numeric(12,4) not null check(quantity>0),
  delivery_minor bigint not null check(delivery_minor>=0), currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
  revision bigint not null default 1 check(revision>0), created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(selection_id,property_id)
);
create table public.furnishing_owner_plan_commands(
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id),
  project_id uuid not null references public.furnishing_projects(id), plan_id uuid not null references public.furnishing_plans(id),
  actor_id uuid not null references public.profiles(id), command_type text not null check(command_type in('generate','selection_saved','validate','submit','approve','revise','snapshot')),
  expected_revision bigint not null, resulting_revision bigint not null, payload_hash text not null,
  before_state jsonb not null, after_state jsonb not null, correlation_id uuid not null,
  idempotency_key text not null unique, occurred_at timestamptz not null default now()
);
create unique index if not exists furnishing_plan_validation_once_per_revision
  on public.furnishing_plan_validation_runs(furnishing_plan_id,revision);

create or replace function public.protect_submitted_furnishing_selection() returns trigger language plpgsql set search_path=public as $$begin if exists(select 1 from public.furnishing_plans p where p.id=old.furnishing_plan_id and p.status<>'draft') then raise exception 'FURNISHING_SELECTION_IMMUTABLE';end if;return new;end$$;
drop trigger if exists protect_submitted_furnishing_selection on public.furnishing_product_selections;
create trigger protect_submitted_furnishing_selection before update or delete on public.furnishing_product_selections for each row execute function public.protect_submitted_furnishing_selection();

create or replace function public.fs008g_owner_selection_eligible(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select public.fs008g_internal_catalog_visible(p_workspace_id)
 and exists(select 1 from public.furnishing_activation_releases r join public.furnishing_activation_capabilities c on c.release_id=r.id where r.milestone='FS-008A' and c.capability in('design_workspace','budgeting') and c.enabled group by r.id having count(distinct c.capability)=2)
 and exists(select 1 from public.customer_account_memberships m join public.commercial_entitlements e on e.customer_account_id=m.customer_account_id and e.tenant_id=m.tenant_id where m.profile_id=auth.uid() and m.tenant_id=p_workspace_id and m.status='active' and e.status='active' and e.offer_code='FS-DESIGN' and e.capability_code='furnishing.project.access' and e.effective_from<=now() and (e.effective_until is null or e.effective_until>now()))
 and not exists(select 1 from public.customer_account_memberships m join public.commercial_entitlements e on e.customer_account_id=m.customer_account_id and e.tenant_id=m.tenant_id where m.profile_id=auth.uid() and m.tenant_id=p_workspace_id and m.status='active' and e.status='active' and e.offer_code in('FS-CONSULT','FS-FULL'))
$$;

create or replace function public.discover_furnishing_owner_packages(p_workspace_id uuid)
returns table(package_version_id uuid,name text,description text,tier text,property_type text,version_number integer,estimated_budget_low_minor bigint,estimated_budget_high_minor bigint)
language sql stable security definer set search_path=public,pg_temp as $$
 select version_row.id,package_row.name,package_row.description,package_row.tier,package_row.property_type,version_row.version_number,version_row.estimated_budget_low_minor,version_row.estimated_budget_high_minor
 from public.furnishing_package_versions version_row
 join public.furnishing_packages package_row on package_row.id=version_row.furnishing_package_id
 join public.furnishing_package_governance_approvals approval on approval.package_kind='property' and approval.package_version_id=version_row.id and approval.workspace_id=p_workspace_id
 where public.fs008g_owner_selection_eligible(p_workspace_id) and package_row.workspace_id=p_workspace_id
   and package_row.lifecycle_status='approved' and version_row.lifecycle_status='approved'
 order by package_row.name,version_row.version_number desc
$$;

create or replace function public.save_furnishing_selection_delivery(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a uuid:=auth.uid();selection_id uuid;expected bigint;requested numeric;delivery bigint;correlation uuid;command_key text;selection public.furnishing_product_selections%rowtype;plan public.furnishing_plans%rowtype;project public.furnishing_projects%rowtype;property_id uuid;rule public.furnishing_quantity_rules%rowtype;allocation public.furnishing_selection_delivery_allocations%rowtype;fingerprint text;prior public.furnishing_owner_plan_commands%rowtype;
begin
 if a is null then raise exception 'OWNER_SELECTION_UNAUTHORIZED' using errcode='42501';end if;
 begin selection_id:=(p_input->>'selection_id')::uuid;expected:=(p_input->>'expected_revision')::bigint;requested:=(p_input->>'quantity')::numeric;delivery:=(p_input->>'delivery_minor')::bigint;correlation:=(p_input->>'correlation_id')::uuid;exception when others then raise exception 'OWNER_SELECTION_COMMAND_INVALID';end;
 command_key:=left(trim(p_input->>'idempotency_key'),200);if length(command_key)<8 or requested<0 or delivery<0 then raise exception 'OWNER_SELECTION_COMMAND_INVALID';end if;
 select s.* into selection from public.furnishing_product_selections s where s.id=selection_id for update;if not found then raise exception 'OWNER_SELECTION_NOT_FOUND';end if;
 select x.* into plan from public.furnishing_plans x where x.id=selection.furnishing_plan_id for update;select p.* into project from public.furnishing_projects p where p.id=plan.project_id;property_id:=project.property_id;
 if plan.status<>'draft' or plan.revision<>expected or not public.fs008g_owner_selection_eligible(project.workspace_id) then raise exception 'OWNER_SELECTION_STALE_OR_INELIGIBLE';end if;
 select q.* into rule from public.furnishing_quantity_rules q where q.id=selection.quantity_rule_id;
 if rule.rule_type='fixed' and rule.multiplier=1 and requested<>1 then raise exception 'OWNER_SELECTION_FIXED_ONE';end if;
 if requested<coalesce(rule.minimum,0) or (rule.maximum is not null and requested>rule.maximum) then raise exception 'OWNER_SELECTION_QUANTITY_BOUNDS';end if;
 fingerprint:=encode(digest(concat_ws(':',selection_id,expected,requested,delivery,correlation),'sha256'),'hex');
 select c.* into prior from public.furnishing_owner_plan_commands c where c.idempotency_key=command_key for update;
 if found then if prior.payload_hash<>fingerprint then raise exception 'OWNER_SELECTION_REPLAY_CONFLICT';end if;return prior.after_state||jsonb_build_object('status','replayed');end if;
 update public.furnishing_product_selections set quantity_override=requested,purchase_quantity=greatest(0,requested-existing_quantity),estimated_total_minor=case when estimated_unit_price_minor is null then null else estimated_unit_price_minor*greatest(0,requested-existing_quantity) end,revision=revision+1,updated_at=now() where id=selection.id;
 insert into public.furnishing_selection_delivery_allocations(workspace_id,project_id,selection_id,property_id,quantity,delivery_minor,currency,created_by) values(project.workspace_id,project.id,selection.id,property_id,greatest(0,requested-selection.existing_quantity),delivery,selection.currency,a) on conflict(selection_id,property_id) do update set quantity=excluded.quantity,delivery_minor=excluded.delivery_minor,revision=furnishing_selection_delivery_allocations.revision+1,updated_at=now() returning * into allocation;
 update public.furnishing_plans set revision=revision+1,estimated_shipping_minor=(select coalesce(sum(d.delivery_minor),0) from public.furnishing_selection_delivery_allocations d where d.project_id=project.id),estimated_total_minor=(select coalesce(sum(s.estimated_total_minor),0) from public.furnishing_product_selections s where s.furnishing_plan_id=plan.id)+(select coalesce(sum(d.delivery_minor),0) from public.furnishing_selection_delivery_allocations d where d.project_id=project.id),updated_at=now() where id=plan.id;
 insert into public.furnishing_owner_plan_commands(workspace_id,project_id,plan_id,actor_id,command_type,expected_revision,resulting_revision,payload_hash,before_state,after_state,correlation_id,idempotency_key) values(project.workspace_id,project.id,plan.id,a,'selection_saved',expected,expected+1,fingerprint,jsonb_build_object('planRevision',expected,'selectionRevision',selection.revision),jsonb_build_object('planRevision',expected+1,'selectionRevision',selection.revision+1,'budgetDerived',true),correlation,command_key) returning * into prior;
 return prior.after_state||jsonb_build_object('status','saved');
end $$;

create or replace function public.create_furnishing_project_catalog_snapshot(p_project_id uuid,p_correlation_id text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a uuid:=auth.uid();p public.furnishing_projects%rowtype;plan public.furnishing_plans%rowtype;package_version public.furnishing_package_versions%rowtype;existing public.fs008d_project_catalog_snapshots%rowtype;selection record;snapshot jsonb;items jsonb;hash text;package_hash text;s public.fs008d_project_catalog_snapshots%rowtype;line_hash text;
begin
 if a is null then raise exception 'SNAPSHOT_UNAUTHORIZED' using errcode='42501';end if;
 select x.* into p from public.furnishing_projects x where x.id=p_project_id for update;if not found then raise exception 'PROJECT_NOT_FOUND';end if;
 if not public.fs008g_owner_selection_eligible(p.workspace_id) and not public.is_admin() then raise exception 'SNAPSHOT_PROJECT_INELIGIBLE' using errcode='42501';end if;
 select x.* into plan from public.furnishing_plans x where x.id=p.current_plan_version_id and x.project_id=p.id and x.status='approved' for update;if not found then raise exception 'SNAPSHOT_APPROVED_PLAN_REQUIRED';end if;
 select x.* into package_version from public.furnishing_package_versions x join public.furnishing_package_governance_approvals g on g.package_kind='property' and g.package_version_id=x.id and g.workspace_id=p.workspace_id where x.id=p.furnishing_package_version_id and x.lifecycle_status='approved';if not found then raise exception 'SNAPSHOT_APPROVED_PACKAGE_REQUIRED';end if;
 select g.composition_hash into package_hash from public.furnishing_package_governance_approvals g where g.package_kind='property' and g.package_version_id=package_version.id and g.workspace_id=p.workspace_id;
 if exists(select 1 from public.furnishing_product_selections x left join public.furnishing_rooms r on r.id=x.room_id left join public.furnishing_products product on product.id=x.product_id left join public.furnishing_product_offers offer on offer.id=x.selected_offer_id and offer.product_id=product.id left join public.furnishing_product_offer_assignments assignment on assignment.workspace_id=p.workspace_id and assignment.product_id=product.id and assignment.offer_id=offer.id and assignment.revoked_at is null left join public.furnishing_selection_delivery_allocations delivery on delivery.selection_id=x.id and delivery.project_id=p.id where x.furnishing_plan_id=plan.id and x.purchase_quantity>0 and(r.project_id is distinct from p.id or product.workspace_id is distinct from p.workspace_id or product.status<>'approved' or offer.status<>'active' or assignment.id is null or x.estimated_unit_price_minor is distinct from offer.listed_price_minor or delivery.id is null or delivery.quantity is distinct from x.purchase_quantity)) then raise exception 'SNAPSHOT_SELECTION_NOT_NORMALIZED';end if;
 select coalesce(jsonb_agg(jsonb_build_object('stableItemId',x.id,'roomId',x.room_id,'packageItemId',x.package_item_id,'productId',x.product_id,'offerId',x.selected_offer_id,'quantity',x.purchase_quantity,'priceMinor',offer.listed_price_minor,'deliveryMinor',delivery.delivery_minor,'currency',offer.currency,'required',x.required,'selectionState',case when assignment.role='preferred' then 'preferred' else 'alternate' end,'selectionRevision',x.revision) order by r.sort_order,x.sort_order,x.id),'[]'::jsonb) into items from public.furnishing_product_selections x join public.furnishing_rooms r on r.id=x.room_id join public.furnishing_product_offers offer on offer.id=x.selected_offer_id join public.furnishing_product_offer_assignments assignment on assignment.workspace_id=p.workspace_id and assignment.product_id=x.product_id and assignment.offer_id=offer.id and assignment.revoked_at is null join public.furnishing_selection_delivery_allocations delivery on delivery.selection_id=x.id and delivery.project_id=p.id where x.furnishing_plan_id=plan.id and x.purchase_quantity>0;
 if jsonb_array_length(items)=0 then raise exception 'SNAPSHOT_SELECTION_REQUIRED';end if;
 snapshot:=jsonb_build_object('schemaVersion','fs008g-c8b-v1','projectId',p.id,'planId',plan.id,'planVersion',plan.version_number,'planRevision',plan.revision,'packageVersionId',package_version.id,'packageVersion',package_version.version_number,'packageCompositionHash',package_hash,'currency',plan.currency,'subtotalMinor',plan.estimated_subtotal_minor,'deliveryMinor',plan.estimated_shipping_minor,'totalMinor',plan.estimated_total_minor,'items',items);
 hash:=encode(digest(snapshot::text,'sha256'),'hex');
 select x.* into existing from public.fs008d_project_catalog_snapshots x where x.project_id=p.id order by x.created_at limit 1 for update;
 if found then if existing.approved_plan_id=plan.id and existing.content_hash=hash then return jsonb_build_object('status','replayed','id',existing.id,'content_hash',existing.content_hash);end if;raise exception 'SNAPSHOT_REPLAY_CONFLICT';end if;
 insert into public.fs008d_project_catalog_snapshots(project_id,tenant_id,package_version_id,approved_plan_id,plan_revision,package_composition_hash,snapshot,content_hash,correlation_id,source_idempotency_key) values(p.id,p.workspace_id,package_version.id,plan.id,plan.revision,package_hash,snapshot,hash,left(p_correlation_id,120),left(p_idempotency_key,200)) returning * into s;
 for selection in select value item from jsonb_array_elements(items) loop line_hash:=encode(digest(selection.item::text,'sha256'),'hex');insert into public.fs008d_snapshot_items(snapshot_id,tenant_id,project_id,stable_item_id,room_id,package_item_id,product_id,retailer_offer_id,quantity,observed_price_minor,extended_product_cost_minor,delivery_minor,currency,required,selection_state,source_lineage,content_hash) values(s.id,p.workspace_id,p.id,selection.item->>'stableItemId',(selection.item->>'roomId')::uuid,nullif(selection.item->>'packageItemId','')::uuid,(selection.item->>'productId')::uuid,(selection.item->>'offerId')::uuid,(selection.item->>'quantity')::numeric,(selection.item->>'priceMinor')::bigint,(selection.item->>'priceMinor')::bigint*(selection.item->>'quantity')::numeric,(selection.item->>'deliveryMinor')::bigint,selection.item->>'currency',(selection.item->>'required')::boolean,selection.item->>'selectionState',jsonb_build_object('approvedPlanId',plan.id,'planRevision',plan.revision,'packageVersionId',package_version.id,'selectionRevision',(selection.item->>'selectionRevision')::bigint),line_hash);end loop;
 insert into public.furnishing_owner_plan_commands(workspace_id,project_id,plan_id,actor_id,command_type,expected_revision,resulting_revision,payload_hash,before_state,after_state,correlation_id,idempotency_key) values(p.workspace_id,p.id,plan.id,a,'snapshot',plan.revision,plan.revision,hash,jsonb_build_object('status','approved'),jsonb_build_object('snapshotId',s.id,'contentHash',hash),p_correlation_id::uuid,left(p_idempotency_key,200));
 return jsonb_build_object('status','created','id',s.id,'content_hash',hash);
end $$;

create or replace function public.transition_furnishing_owner_plan(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a uuid:=auth.uid();plan_id uuid;expected bigint;transition text;correlation uuid;command_key text;plan public.furnishing_plans%rowtype;project public.furnishing_projects%rowtype;prior public.furnishing_owner_plan_commands%rowtype;fingerprint text;next_status text;
begin
 if a is null then raise exception 'OWNER_PLAN_UNAUTHORIZED' using errcode='42501';end if;
 begin plan_id:=(p_input->>'plan_id')::uuid;expected:=(p_input->>'expected_revision')::bigint;correlation:=(p_input->>'correlation_id')::uuid;exception when others then raise exception 'OWNER_PLAN_COMMAND_INVALID';end;
 transition:=p_input->>'transition';command_key:=left(trim(p_input->>'idempotency_key'),200);if transition not in('submit','approve') or length(command_key)<8 then raise exception 'OWNER_PLAN_COMMAND_INVALID';end if;
 select x.* into plan from public.furnishing_plans x where x.id=plan_id for update;if not found then raise exception 'OWNER_PLAN_NOT_FOUND';end if;select p.* into project from public.furnishing_projects p where p.id=plan.project_id for update;
 fingerprint:=encode(digest(concat_ws(':',plan_id,expected,transition,correlation),'sha256'),'hex');select c.* into prior from public.furnishing_owner_plan_commands c where c.idempotency_key=command_key for update;
 if found then if prior.payload_hash<>fingerprint then raise exception 'OWNER_PLAN_REPLAY_CONFLICT';end if;return prior.after_state||jsonb_build_object('status','replayed');end if;
 if plan.revision<>expected then raise exception 'OWNER_PLAN_STALE';end if;
 if transition='submit' then
   if plan.status<>'draft' or not public.fs008g_owner_selection_eligible(project.workspace_id) then raise exception 'OWNER_PLAN_NOT_SUBMITTABLE';end if;
   if exists(select 1 from public.furnishing_product_selections s left join public.furnishing_selection_delivery_allocations d on d.selection_id=s.id and d.project_id=project.id where s.furnishing_plan_id=plan.id and(s.required and s.product_id is null or s.purchase_quantity>0 and d.id is null)) then raise exception 'OWNER_PLAN_VALIDATION_FAILED';end if;next_status:='awaiting_approval';
 else
   if not public.is_admin() then raise exception 'OWNER_PLAN_ADMIN_APPROVAL_REQUIRED' using errcode='42501';end if;if plan.status<>'awaiting_approval' then raise exception 'OWNER_PLAN_NOT_REVIEWABLE';end if;next_status:='approved';
 end if;
 update public.furnishing_plans set status=next_status,revision=revision+1,approved_by=case when transition='approve' then a else approved_by end,approved_at=case when transition='approve' then now() else approved_at end,updated_at=now() where id=plan.id;
 update public.furnishing_projects set plan_status=next_status,lifecycle_status=case when transition='approve' then 'approved' else 'awaiting_approval' end where id=project.id;
 insert into public.furnishing_owner_plan_commands(workspace_id,project_id,plan_id,actor_id,command_type,expected_revision,resulting_revision,payload_hash,before_state,after_state,correlation_id,idempotency_key) values(project.workspace_id,project.id,plan.id,a,transition,expected,expected+1,fingerprint,jsonb_build_object('status',plan.status,'revision',expected),jsonb_build_object('status',next_status,'revision',expected+1),correlation,command_key) returning * into prior;
 return prior.after_state;end$$;

drop function if exists public.create_furnishing_project_catalog_snapshot(uuid,uuid,jsonb,text,text,text);

create or replace function public.prevent_fs008d_snapshot_mutation() returns trigger language plpgsql set search_path=public as $$begin raise exception 'FS008D_SNAPSHOT_IMMUTABLE';end$$;
drop trigger if exists fs008d_snapshot_immutable on public.fs008d_project_catalog_snapshots;
create trigger fs008d_snapshot_immutable before update or delete on public.fs008d_project_catalog_snapshots for each row execute function public.prevent_fs008d_snapshot_mutation();

create or replace function public.get_furnishing_owner_plan(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare p public.furnishing_projects%rowtype;result jsonb;
begin select x.* into p from public.furnishing_projects x where x.id=p_project_id;if not found or not public.fs008g_owner_selection_eligible(p.workspace_id) then raise exception 'OWNER_PROJECT_ACCESS_DENIED' using errcode='42501';end if;
 select jsonb_build_object('name',p.name,'status',plan.status,'currency',plan.currency,'subtotalMinor',plan.estimated_subtotal_minor,'deliveryMinor',plan.estimated_shipping_minor,'totalMinor',plan.estimated_total_minor,'selections',coalesce(jsonb_agg(jsonb_build_object('roomName',room.name,'productName',product.name,'retailerName',retailer.name,'quantity',selection.purchase_quantity,'unitPriceMinor',selection.estimated_unit_price_minor,'deliveryMinor',delivery.delivery_minor,'status',selection.selection_status) order by room.sort_order,selection.sort_order) filter(where selection.id is not null),'[]'::jsonb)) into result from public.furnishing_plans plan left join public.furnishing_product_selections selection on selection.furnishing_plan_id=plan.id left join public.furnishing_rooms room on room.id=selection.room_id left join public.furnishing_products product on product.id=selection.product_id left join public.furnishing_product_offers offer on offer.id=selection.selected_offer_id left join public.furnishing_retailers retailer on retailer.id=offer.retailer_id left join public.furnishing_selection_delivery_allocations delivery on delivery.selection_id=selection.id where plan.id=p.current_plan_version_id group by plan.id;
 return result;end$$;

alter table public.furnishing_selection_delivery_allocations enable row level security;
alter table public.furnishing_owner_plan_commands enable row level security;
create policy "Eligible owners read delivery allocations" on public.furnishing_selection_delivery_allocations for select to authenticated using(public.fs008g_owner_selection_eligible(workspace_id));
create policy "Admins read owner plan audit" on public.furnishing_owner_plan_commands for select to authenticated using(public.is_admin());
revoke all on public.furnishing_selection_delivery_allocations,public.furnishing_owner_plan_commands from public,anon;
revoke insert,update,delete on public.furnishing_selection_delivery_allocations,public.furnishing_owner_plan_commands from authenticated;
revoke all on function public.discover_furnishing_owner_packages(uuid),public.save_furnishing_selection_delivery(jsonb),public.transition_furnishing_owner_plan(jsonb),public.create_furnishing_project_catalog_snapshot(uuid,text,text),public.get_furnishing_owner_plan(uuid) from public,anon;
grant execute on function public.discover_furnishing_owner_packages(uuid),public.save_furnishing_selection_delivery(jsonb),public.transition_furnishing_owner_plan(jsonb),public.create_furnishing_project_catalog_snapshot(uuid,text,text),public.get_furnishing_owner_plan(uuid) to authenticated;

commit;
