-- FS-UX-004: governed, versioned property-wide Room Packages. Planning only.
begin;

alter table public.furnishing_packages drop constraint if exists furnishing_packages_lifecycle_status_check;
alter table public.furnishing_packages
  add constraint furnishing_packages_lifecycle_status_check
  check(lifecycle_status in('draft','in_review','changes_requested','approved','retired','deprecated','archived')) not valid,
  add column if not exists source_template_id uuid references public.furnishing_packages(id),
  add column if not exists source_template_version_id uuid references public.furnishing_package_versions(id),
  add column if not exists source_template_digest text,
  add column if not exists retired_at timestamptz,
  add column if not exists retired_by uuid references public.profiles(id),
  add column if not exists retirement_reason text,
  add column if not exists replacement_package_id uuid references public.furnishing_packages(id),
  add column if not exists created_by uuid references public.profiles(id);

alter table public.furnishing_package_versions drop constraint if exists furnishing_package_versions_lifecycle_status_check;
alter table public.furnishing_package_versions
  add constraint furnishing_package_versions_lifecycle_status_check
  check(lifecycle_status in('draft','in_review','changes_requested','approved','superseded','retired')) not valid,
  add column if not exists based_on_version_id uuid references public.furnishing_package_versions(id),
  add column if not exists profile jsonb not null default '{}',
  add column if not exists budget_basis text not null default 'products_only'
    check(budget_basis in('products_only','products_delivery','products_delivery_assembly','installed_cost')),
  add column if not exists budget_snapshot jsonb not null default '{}',
  add column if not exists capacity_snapshot jsonb not null default '{}',
  add column if not exists optimistic_version bigint not null default 1,
  add column if not exists created_by uuid references public.profiles(id),
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references public.profiles(id);

create table public.fsux4_package_rooms(
  id uuid primary key default gen_random_uuid(),package_version_id uuid not null references public.furnishing_package_versions(id) on delete cascade,
  copied_from_room_id uuid references public.fsux4_package_rooms(id),canonical_room_type text not null,display_name text not null,
  sort_order integer not null check(sort_order>=0),is_required boolean not null default true,is_optional boolean generated always as(not is_required) stored,
  intended_occupancy integer not null default 0 check(intended_occupancy>=0),sleeping_capacity integer not null default 0 check(sleeping_capacity>=0),
  description text,internal_notes text,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
  unique(package_version_id,sort_order)
);

create table public.fsux4_package_items(
  id uuid primary key default gen_random_uuid(),package_version_id uuid not null references public.furnishing_package_versions(id) on delete cascade,
  room_id uuid not null references public.fsux4_package_rooms(id) on delete cascade,copied_from_item_id uuid references public.fsux4_package_items(id),
  product_id uuid references public.furnishing_products(id),product_revision bigint,quantity integer not null check(quantity>0),
  priority text not null check(priority in('essential','recommended','optional')),fulfillment_required boolean not null default true,
  placement_guidance text,budget_treatment text not null default 'included' check(budget_treatment in('included','excluded','informational')),
  item_kind text not null default 'other' check(item_kind in('television','mount','bed','seating','dining_seating','towel_set','other')),
  tv_size_inches numeric,mount_min_inches numeric,mount_max_inches numeric,mount_not_required_reason text,
  unit_price_minor bigint check(unit_price_minor is null or unit_price_minor>=0),delivery_minor bigint not null default 0 check(delivery_minor>=0),
  assembly_minor bigint not null default 0 check(assembly_minor>=0),installation_minor bigint not null default 0 check(installation_minor>=0),
  currency text not null default 'USD' check(currency~'^[A-Z]{3}$'),price_verified_at timestamptz,sort_order integer not null check(sort_order>=0),
  unresolved_reason text,added_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
  unique(room_id,sort_order),check(product_id is not null or unresolved_reason is not null)
);

create table public.fsux4_package_item_alternatives(
  id uuid primary key default gen_random_uuid(),package_item_id uuid not null references public.fsux4_package_items(id) on delete cascade,
  product_id uuid not null references public.furnishing_products(id),product_revision bigint not null,rank integer not null check(rank>0),
  reason text not null,price_difference_minor bigint,material_style_difference text,capacity_size_difference text,
  approval_status text not null default 'approved' check(approval_status in('approved','pending','retired')),
  added_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),
  unique(package_item_id,product_id),unique(package_item_id,rank)
);

create table public.fsux4_package_validation_runs(
  id uuid primary key default gen_random_uuid(),package_id uuid not null references public.furnishing_packages(id),
  package_version_id uuid not null references public.furnishing_package_versions(id),version bigint not null,
  status text not null check(status in('ready','blocked')),blocking_count integer not null,warning_count integer not null,informational_count integer not null,
  issues jsonb not null,composition_hash text not null,budget_snapshot jsonb not null,capacity_snapshot jsonb not null,
  actor_id uuid not null references public.profiles(id),correlation_id text not null,created_at timestamptz not null default now()
);

create table public.fsux4_package_review_events(
  id uuid primary key default gen_random_uuid(),package_id uuid not null references public.furnishing_packages(id),package_version_id uuid not null references public.furnishing_package_versions(id),
  event_type text not null check(event_type in('submitted','changes_requested','approved','retired','revision_created','template_adopted')),
  reason text,affected_target jsonb not null default '{}',actor_id uuid not null references public.profiles(id),correlation_id text not null,
  idempotency_key text not null unique,evidence jsonb not null default '{}',created_at timestamptz not null default now()
);

create table public.fsux4_package_approval_snapshots(
  id uuid primary key default gen_random_uuid(),package_id uuid not null references public.furnishing_packages(id),package_version_id uuid not null references public.furnishing_package_versions(id),
  validation_run_id uuid not null references public.fsux4_package_validation_runs(id),snapshot jsonb not null,snapshot_hash text not null,
  approved_by uuid not null references public.profiles(id),correlation_id text not null,approved_at timestamptz not null default now(),
  unique(package_version_id),unique(snapshot_hash)
);

create table public.fsux4_package_adoptions(
  id uuid primary key default gen_random_uuid(),source_template_id uuid not null references public.furnishing_packages(id),
  source_version_id uuid not null references public.furnishing_package_versions(id),source_digest text not null,
  workspace_id uuid not null references public.owners(id),workspace_package_id uuid not null unique references public.furnishing_packages(id),
  inherited_profile jsonb not null,product_mapping jsonb not null default '{}',workspace_overrides jsonb not null default '{}',
  actor_id uuid not null references public.profiles(id),correlation_id text not null,idempotency_key text not null unique,created_at timestamptz not null default now(),
  unique(source_version_id,workspace_id)
);

create table public.fsux4_package_activity(
  id uuid primary key default gen_random_uuid(),workspace_id uuid references public.owners(id),package_id uuid not null references public.furnishing_packages(id),
  package_version_id uuid references public.furnishing_package_versions(id),room_id uuid references public.fsux4_package_rooms(id),item_id uuid references public.fsux4_package_items(id),
  event_type text not null,actor_id uuid not null references public.profiles(id),correlation_id text not null,idempotency_key text,
  evidence jsonb not null default '{}',created_at timestamptz not null default now()
);

create unique index fsux4_package_activity_idempotency on public.fsux4_package_activity(idempotency_key) where idempotency_key is not null;
create index fsux4_packages_library on public.furnishing_packages(governance_scope,workspace_id,lifecycle_status,updated_at desc) where governance_scope<>'legacy_ambiguous';
create index fsux4_package_versions_lookup on public.furnishing_package_versions(furnishing_package_id,version_number desc);
create index fsux4_package_rooms_version on public.fsux4_package_rooms(package_version_id,sort_order);
create index fsux4_package_items_version on public.fsux4_package_items(package_version_id,room_id,sort_order);
create index fsux4_package_validation_version on public.fsux4_package_validation_runs(package_version_id,created_at desc);

create or replace function public.fsux4_assert_actor(p_workspace uuid,p_platform boolean default false)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare a uuid:=auth.uid();begin
 if a is null or not public.is_admin() then raise exception 'ROOM_PACKAGE_ADMIN_REQUIRED' using errcode='42501';end if;
 if p_platform then return a;end if;
 if p_workspace is null or (public.active_workspace_role(p_workspace) is null and not public.is_admin()) then raise exception 'ROOM_PACKAGE_WORKSPACE_FORBIDDEN' using errcode='42501';end if;
 return a;
end$$;

create or replace function public.fsux4_package_snapshot(p_version uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
 select jsonb_build_object(
  'version',to_jsonb(v)-'lifecycle_status'-'optimistic_version'-'submitted_at'-'submitted_by'-'approved_at'-'approved_by'-'budget_snapshot'-'capacity_snapshot','rooms',coalesce((select jsonb_agg(to_jsonb(r) order by r.sort_order) from public.fsux4_package_rooms r where r.package_version_id=v.id),'[]'::jsonb),
  'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.room_id,i.sort_order) from public.fsux4_package_items i where i.package_version_id=v.id),'[]'::jsonb),
  'alternatives',coalesce((select jsonb_agg(to_jsonb(a) order by a.package_item_id,a.rank) from public.fsux4_package_item_alternatives a join public.fsux4_package_items i on i.id=a.package_item_id where i.package_version_id=v.id),'[]'::jsonb)
 ) from public.furnishing_package_versions v where v.id=p_version
$$;

create or replace function public.fsux4_create_package(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a uuid;workspace uuid;scope text;command_key text;correlation text;pid uuid;vid uuid;prior public.fsux4_package_activity%rowtype;profile jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ROOM_PACKAGE_ADMIN_REQUIRED' using errcode='42501';end if;
 begin workspace:=nullif(p_input->>'workspace_id','')::uuid;exception when others then raise exception 'ROOM_PACKAGE_CREATE_COMMAND_INVALID';end;
 scope:=p_input->>'scope';command_key:=left(trim(p_input->>'idempotency_key'),200);correlation:=left(trim(p_input->>'correlation_id'),200);profile:=coalesce(p_input->'profile','{}');
 if scope not in('platform','workspace') or (scope='platform' and workspace is not null) or (scope='workspace' and workspace is null) or nullif(trim(p_input->>'name'),'') is null or length(command_key)<8 or length(correlation)<8 then raise exception 'ROOM_PACKAGE_CREATE_COMMAND_INVALID';end if;
 a:=public.fsux4_assert_actor(workspace,scope='platform');select * into prior from public.fsux4_package_activity where idempotency_key=command_key;if found then return prior.evidence||jsonb_build_object('status','replayed');end if;
 insert into public.furnishing_packages(name,description,property_type,style,budget_tier,starting_budget,workspace_id,tier,lifecycle_status,governance_scope,created_by)
 values(trim(p_input->>'name'),coalesce(p_input->>'description',''),coalesce(nullif(p_input->>'property_type',''),'other'),coalesce(nullif(p_input->>'design_direction',''),'custom'),'standard',0,workspace,coalesce(nullif(p_input->>'quality_tier',''),'custom'),'draft',scope,a) returning id into pid;
 insert into public.furnishing_package_versions(furnishing_package_id,version_number,lifecycle_status,target_property_type,estimated_budget_low_minor,estimated_budget_high_minor,currency,bedroom_min,bedroom_max,bathroom_min,bathroom_max,guest_min,guest_max,profile,budget_basis,created_by)
 values(pid,1,'draft',p_input->>'property_type',nullif(p_input->>'target_min_minor','')::bigint,nullif(p_input->>'target_max_minor','')::bigint,coalesce(nullif(p_input->>'currency',''),'USD'),nullif(p_input->>'bedrooms','')::int,nullif(p_input->>'bedrooms','')::int,nullif(p_input->>'bathrooms','')::int,nullif(p_input->>'bathrooms','')::int,nullif(p_input->>'maximum_guests','')::int,nullif(p_input->>'maximum_guests','')::int,profile,coalesce(nullif(p_input->>'budget_basis',''),'products_only'),a) returning id into vid;
 update public.furnishing_packages set current_version_id=vid where id=pid;
 insert into public.fsux4_package_activity(workspace_id,package_id,package_version_id,event_type,actor_id,correlation_id,idempotency_key,evidence) values(workspace,pid,vid,'package_created',a,correlation,command_key,jsonb_build_object('status','draft','packageId',pid,'versionId',vid,'scope',scope,'externalEffects',false)) returning * into prior;
 return prior.evidence;
end$$;

create or replace function public.fsux4_mutate_package(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a uuid;pid uuid;vid uuid;expected bigint;operation text;command_key text;correlation text;p public.furnishing_packages%rowtype;v public.furnishing_package_versions%rowtype;prior public.fsux4_package_activity%rowtype;v_room_id uuid;v_item_id uuid;product public.furnishing_products%rowtype;next_order int;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ROOM_PACKAGE_ADMIN_REQUIRED' using errcode='42501';end if;
 begin pid:=(p_input->>'package_id')::uuid;vid:=(p_input->>'package_version_id')::uuid;expected:=(p_input->>'expected_version')::bigint;exception when others then raise exception 'ROOM_PACKAGE_MUTATION_COMMAND_INVALID';end;
 operation:=p_input->>'operation';command_key:=left(trim(p_input->>'idempotency_key'),200);correlation:=left(trim(p_input->>'correlation_id'),200);if operation not in('add_room','add_item','add_alternative','remove_room','reorder_room') or length(command_key)<8 or length(correlation)<8 then raise exception 'ROOM_PACKAGE_MUTATION_COMMAND_INVALID';end if;
 select * into prior from public.fsux4_package_activity where idempotency_key=command_key;if found then return prior.evidence||jsonb_build_object('status','replayed');end if;
 select * into p from public.furnishing_packages where id=pid and governance_scope<>'legacy_ambiguous' for update;if not found then raise exception 'ROOM_PACKAGE_NOT_FOUND_OR_FROZEN';end if;a:=public.fsux4_assert_actor(p.workspace_id,p.governance_scope='platform');
 perform pg_advisory_xact_lock(hashtextextended('fsux4-package:'||pid::text,0));select * into v from public.furnishing_package_versions where id=vid and furnishing_package_id=pid for update;if not found or v.lifecycle_status not in('draft','changes_requested') or v.optimistic_version<>expected then raise exception 'ROOM_PACKAGE_VERSION_STALE_OR_NOT_EDITABLE';end if;
 if operation='add_room' then
  select coalesce(max(sort_order),-1)+1 into next_order from public.fsux4_package_rooms where package_version_id=vid;
  insert into public.fsux4_package_rooms(package_version_id,canonical_room_type,display_name,sort_order,is_required,intended_occupancy,sleeping_capacity,description,created_by) values(vid,coalesce(nullif(p_input->>'canonical_room_type',''),'other'),coalesce(nullif(p_input->>'display_name',''),'Room'),next_order,coalesce((p_input->>'is_required')::boolean,true),coalesce((p_input->>'intended_occupancy')::int,0),coalesce((p_input->>'sleeping_capacity')::int,0),nullif(p_input->>'description',''),a) returning id into v_room_id;
 elsif operation='add_item' then
  v_room_id:=(p_input->>'room_id')::uuid;if not exists(select 1 from public.fsux4_package_rooms where id=v_room_id and package_version_id=vid) then raise exception 'ROOM_PACKAGE_ROOM_INVALID';end if;
  if p_input->>'priority' not in('essential','recommended','optional') then raise exception 'ROOM_PACKAGE_PRIORITY_INVALID';end if;if coalesce((p_input->>'quantity')::int,0)<=0 then raise exception 'ROOM_PACKAGE_QUANTITY_INVALID';end if;
  select * into product from public.furnishing_products where id=(p_input->>'product_id')::uuid;if not found then raise exception 'ROOM_PACKAGE_PRODUCT_NOT_FOUND';end if;
  if (p.governance_scope='workspace' and (product.scope<>'workspace' or product.workspace_id is distinct from p.workspace_id or product.status<>'approved')) or (p.governance_scope='platform' and product.scope<>'platform') then raise exception 'ROOM_PACKAGE_PRODUCT_INELIGIBLE_OR_ADOPTION_REQUIRED';end if;
  select coalesce(max(sort_order),-1)+1 into next_order from public.fsux4_package_items where room_id=v_room_id;
  insert into public.fsux4_package_items(package_version_id,room_id,product_id,product_revision,quantity,priority,fulfillment_required,placement_guidance,budget_treatment,item_kind,tv_size_inches,mount_min_inches,mount_max_inches,mount_not_required_reason,unit_price_minor,currency,price_verified_at,sort_order,added_by)
  values(vid,v_room_id,product.id,product.revision,(p_input->>'quantity')::int,p_input->>'priority',coalesce((p_input->>'fulfillment_required')::boolean,true),nullif(p_input->>'placement_guidance',''),coalesce(nullif(p_input->>'budget_treatment',''),'included'),coalesce(nullif(p_input->>'item_kind',''),'other'),nullif(p_input->>'tv_size_inches','')::numeric,nullif(p_input->>'mount_min_inches','')::numeric,nullif(p_input->>'mount_max_inches','')::numeric,nullif(p_input->>'mount_not_required_reason',''),nullif(p_input->>'unit_price_minor','')::bigint,coalesce(nullif(p_input->>'currency',''),'USD'),nullif(p_input->>'price_verified_at','')::timestamptz,next_order,a) returning id into v_item_id;
 elsif operation='add_alternative' then
  v_item_id:=(p_input->>'item_id')::uuid;if not exists(select 1 from public.fsux4_package_items where id=v_item_id and package_version_id=vid) then raise exception 'ROOM_PACKAGE_ITEM_INVALID';end if;
  select * into product from public.furnishing_products where id=(p_input->>'product_id')::uuid and scope='workspace' and workspace_id=p.workspace_id and status='approved';if not found then raise exception 'ROOM_PACKAGE_ALTERNATIVE_INELIGIBLE';end if;
  if exists(select 1 from public.fsux4_package_items where id=v_item_id and product_id=product.id) then raise exception 'ROOM_PACKAGE_ALTERNATIVE_SAME_IDENTITY';end if;
  select coalesce(max(rank),0)+1 into next_order from public.fsux4_package_item_alternatives where package_item_id=v_item_id;
  insert into public.fsux4_package_item_alternatives(package_item_id,product_id,product_revision,rank,reason,price_difference_minor,material_style_difference,capacity_size_difference,added_by) values(v_item_id,product.id,product.revision,next_order,coalesce(nullif(p_input->>'reason',''),'Approved package alternative'),nullif(p_input->>'price_difference_minor','')::bigint,nullif(p_input->>'material_style_difference',''),nullif(p_input->>'capacity_size_difference',''),a);
 elsif operation='remove_room' then v_room_id:=(p_input->>'room_id')::uuid;delete from public.fsux4_package_rooms where id=v_room_id and package_version_id=vid;if not found then raise exception 'ROOM_PACKAGE_ROOM_INVALID';end if;
 else v_room_id:=(p_input->>'room_id')::uuid;update public.fsux4_package_rooms set sort_order=-1 where package_version_id=vid and sort_order=(p_input->>'new_sort_order')::int;update public.fsux4_package_rooms set sort_order=(p_input->>'new_sort_order')::int where id=v_room_id and package_version_id=vid;update public.fsux4_package_rooms set sort_order=(p_input->>'old_sort_order')::int where package_version_id=vid and sort_order=-1;if not found then raise exception 'ROOM_PACKAGE_ROOM_INVALID';end if;end if;
 update public.furnishing_package_versions set optimistic_version=optimistic_version+1 where id=vid;
 insert into public.fsux4_package_activity(workspace_id,package_id,package_version_id,room_id,item_id,event_type,actor_id,correlation_id,idempotency_key,evidence) values(p.workspace_id,pid,vid,v_room_id,v_item_id,operation,a,correlation,command_key,jsonb_build_object('status','saved','operation',operation,'roomId',v_room_id,'itemId',v_item_id,'version',expected+1,'externalEffects',false)) returning * into prior;return prior.evidence;
end$$;

create or replace function public.fsux4_adopt_template(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a uuid;target_workspace uuid;source_id uuid;source_vid uuid;command_key text;correlation text;source public.furnishing_packages%rowtype;sv public.furnishing_package_versions%rowtype;prior public.fsux4_package_adoptions%rowtype;pid uuid;vid uuid;source_digest text;mappings jsonb;overrides jsonb;r record;new_room uuid;mapped_product uuid;source_item record;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ROOM_PACKAGE_ADMIN_REQUIRED' using errcode='42501';end if;
 begin target_workspace:=(p_input->>'workspace_id')::uuid;source_id:=(p_input->>'source_template_id')::uuid;source_vid:=(p_input->>'source_version_id')::uuid;exception when others then raise exception 'ROOM_PACKAGE_TEMPLATE_ADOPTION_COMMAND_INVALID';end;
 command_key:=left(trim(p_input->>'idempotency_key'),200);correlation:=left(trim(p_input->>'correlation_id'),200);mappings:=coalesce(p_input->'product_mapping','{}');overrides:=coalesce(p_input->'workspace_overrides','{}');if length(command_key)<8 or length(correlation)<8 then raise exception 'ROOM_PACKAGE_TEMPLATE_ADOPTION_COMMAND_INVALID';end if;
 a:=public.fsux4_assert_actor(target_workspace,false);select * into prior from public.fsux4_package_adoptions where idempotency_key=command_key;if found then if prior.workspace_id<>target_workspace or prior.source_version_id<>source_vid then raise exception 'ROOM_PACKAGE_TEMPLATE_ADOPTION_REPLAY_CONFLICT';end if;return jsonb_build_object('status','replayed','packageId',prior.workspace_package_id,'adoptionId',prior.id);end if;
 perform pg_advisory_xact_lock(hashtextextended('fsux4-template:'||source_vid::text||':'||target_workspace::text,0));
 select * into prior from public.fsux4_package_adoptions adoption where adoption.source_version_id=source_vid and adoption.workspace_id=target_workspace;if found then return jsonb_build_object('status','existing','packageId',prior.workspace_package_id,'adoptionId',prior.id);end if;
 select * into source from public.furnishing_packages where id=source_id and governance_scope='platform' and workspace_id is null and lifecycle_status='approved';if not found then raise exception 'ROOM_PACKAGE_TEMPLATE_NOT_ELIGIBLE';end if;
 select * into sv from public.furnishing_package_versions where id=source_vid and furnishing_package_id=source.id and lifecycle_status='approved';if not found then raise exception 'ROOM_PACKAGE_TEMPLATE_VERSION_NOT_ELIGIBLE';end if;
 source_digest:=encode(digest(public.fsux4_package_snapshot(sv.id)::text,'sha256'),'hex');
 insert into public.furnishing_packages(name,description,property_type,style,budget_tier,starting_budget,workspace_id,tier,lifecycle_status,governance_scope,source_template_id,source_template_version_id,source_template_digest,created_by)
 values(coalesce(nullif(overrides->>'name',''),source.name),coalesce(overrides->>'description',source.description),source.property_type,source.style,source.budget_tier,source.starting_budget,target_workspace,source.tier,'draft','workspace',source.id,sv.id,source_digest,a) returning id into pid;
 insert into public.furnishing_package_versions(furnishing_package_id,version_number,lifecycle_status,target_property_type,estimated_budget_low_minor,estimated_budget_high_minor,currency,bedroom_min,bedroom_max,bathroom_min,bathroom_max,guest_min,guest_max,applicability,based_on_version_id,profile,budget_basis,budget_snapshot,capacity_snapshot,created_by)
 values(pid,1,'draft',sv.target_property_type,sv.estimated_budget_low_minor,sv.estimated_budget_high_minor,sv.currency,sv.bedroom_min,sv.bedroom_max,sv.bathroom_min,sv.bathroom_max,sv.guest_min,sv.guest_max,sv.applicability,sv.id,sv.profile,sv.budget_basis,sv.budget_snapshot,sv.capacity_snapshot,a) returning id into vid;
 for r in select * from public.fsux4_package_rooms where package_version_id=sv.id order by sort_order loop
  insert into public.fsux4_package_rooms(package_version_id,copied_from_room_id,canonical_room_type,display_name,sort_order,is_required,intended_occupancy,sleeping_capacity,description,internal_notes,created_by) values(vid,r.id,r.canonical_room_type,r.display_name,r.sort_order,r.is_required,r.intended_occupancy,r.sleeping_capacity,r.description,r.internal_notes,a) returning id into new_room;
  for source_item in select * from public.fsux4_package_items where room_id=r.id order by sort_order loop
   mapped_product:=nullif(mappings->>source_item.product_id::text,'')::uuid;
   if mapped_product is not null and not exists(select 1 from public.furnishing_products where id=mapped_product and scope='workspace' and workspace_id=target_workspace and status='approved') then raise exception 'ROOM_PACKAGE_TEMPLATE_PRODUCT_MAPPING_INELIGIBLE';end if;
   insert into public.fsux4_package_items(package_version_id,room_id,copied_from_item_id,product_id,product_revision,quantity,priority,fulfillment_required,placement_guidance,budget_treatment,item_kind,tv_size_inches,mount_min_inches,mount_max_inches,mount_not_required_reason,unit_price_minor,delivery_minor,assembly_minor,installation_minor,currency,price_verified_at,sort_order,unresolved_reason,added_by)
   values(vid,new_room,source_item.id,mapped_product,case when mapped_product is null then null else (select revision from public.furnishing_products where id=mapped_product) end,source_item.quantity,source_item.priority,source_item.fulfillment_required,source_item.placement_guidance,source_item.budget_treatment,source_item.item_kind,source_item.tv_size_inches,source_item.mount_min_inches,source_item.mount_max_inches,source_item.mount_not_required_reason,source_item.unit_price_minor,source_item.delivery_minor,source_item.assembly_minor,source_item.installation_minor,source_item.currency,source_item.price_verified_at,source_item.sort_order,case when mapped_product is null then 'Workspace catalog adoption or approved alternative required' else null end,a);
  end loop;
 end loop;
 update public.furnishing_packages set current_version_id=vid where id=pid;
 insert into public.fsux4_package_adoptions(source_template_id,source_version_id,source_digest,workspace_id,workspace_package_id,inherited_profile,product_mapping,workspace_overrides,actor_id,correlation_id,idempotency_key) values(source.id,sv.id,source_digest,target_workspace,pid,sv.profile,mappings,overrides,a,correlation,command_key) returning * into prior;
 insert into public.fsux4_package_review_events(package_id,package_version_id,event_type,actor_id,correlation_id,idempotency_key,evidence) values(pid,vid,'template_adopted',a,correlation,command_key||':event',jsonb_build_object('status','draft','sourceTemplateId',source.id,'sourceVersionId',sv.id,'sourceDigest',source_digest,'unresolvedProducts',(select count(*) from public.fsux4_package_items where package_version_id=vid and product_id is null),'externalEffects',false));
 return jsonb_build_object('status','draft','packageId',pid,'versionId',vid,'adoptionId',prior.id,'sourceDigest',source_digest);
end$$;

create or replace function public.fsux4_validate_package(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a uuid;pid uuid;vid uuid;expected bigint;correlation text;p public.furnishing_packages%rowtype;v public.furnishing_package_versions%rowtype;
issues jsonb:='[]';blocking int:=0;warnings int:=0;infos int:=0;snapshot jsonb;hash text;budget jsonb;capacity jsonb;run_id uuid;max_guests int;sleeping int;dining int;living int;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ROOM_PACKAGE_ADMIN_REQUIRED' using errcode='42501';end if;
 begin pid:=(p_input->>'package_id')::uuid;vid:=(p_input->>'package_version_id')::uuid;expected:=(p_input->>'expected_version')::bigint;exception when others then raise exception 'ROOM_PACKAGE_VALIDATION_COMMAND_INVALID';end;
 correlation:=left(trim(p_input->>'correlation_id'),200);if length(correlation)<8 then raise exception 'ROOM_PACKAGE_VALIDATION_COMMAND_INVALID';end if;
 select * into p from public.furnishing_packages where id=pid and governance_scope<>'legacy_ambiguous';if not found then raise exception 'ROOM_PACKAGE_NOT_FOUND_OR_FROZEN';end if;
 a:=public.fsux4_assert_actor(p.workspace_id,p.governance_scope='platform');
 select * into v from public.furnishing_package_versions where id=vid and furnishing_package_id=pid;if not found or v.optimistic_version<>expected then raise exception 'ROOM_PACKAGE_VERSION_STALE';end if;
 if not exists(select 1 from public.fsux4_package_rooms where package_version_id=vid) then issues:=issues||jsonb_build_array(jsonb_build_object('code','PACKAGE_ROOMS_REQUIRED','severity','blocking'));blocking:=blocking+1;end if;
 if not exists(select 1 from public.fsux4_package_items where package_version_id=vid) then issues:=issues||jsonb_build_array(jsonb_build_object('code','PACKAGE_COMPOSITION_REQUIRED','severity','blocking'));blocking:=blocking+1;end if;
 if p.governance_scope='workspace' and exists(select 1 from public.fsux4_package_items i left join public.furnishing_products product on product.id=i.product_id where i.package_version_id=vid and (i.product_id is null or product.scope<>'workspace' or product.workspace_id is distinct from p.workspace_id or product.status<>'approved')) then issues:=issues||jsonb_build_array(jsonb_build_object('code','PACKAGE_PRODUCT_INELIGIBLE_OR_ADOPTION_REQUIRED','severity','blocking'));blocking:=blocking+1;end if;
 if exists(select 1 from public.fsux4_package_items where package_version_id=vid and priority not in('essential','recommended','optional')) then issues:=issues||jsonb_build_array(jsonb_build_object('code','PACKAGE_PRIORITY_INVALID','severity','blocking'));blocking:=blocking+1;end if;
 if exists(select 1 from public.fsux4_package_items t where t.package_version_id=vid and t.item_kind='television' and t.mount_not_required_reason is null and not exists(select 1 from public.fsux4_package_items m where m.room_id=t.room_id and m.item_kind='mount' and (t.tv_size_inches is null or (coalesce(m.mount_min_inches,0)<=t.tv_size_inches and coalesce(m.mount_max_inches,1000)>=t.tv_size_inches)))) then issues:=issues||jsonb_build_array(jsonb_build_object('code','TELEVISION_MOUNT_REQUIRED_OR_INCOMPATIBLE','severity','blocking'));blocking:=blocking+1;end if;
 max_guests:=coalesce((v.profile->>'maximumGuestCapacity')::int,v.guest_max,0);select coalesce(sum(sleeping_capacity),0) into sleeping from public.fsux4_package_rooms where package_version_id=vid;
 select coalesce(sum(quantity),0) into dining from public.fsux4_package_items where package_version_id=vid and item_kind='dining_seating';select coalesce(sum(quantity),0) into living from public.fsux4_package_items where package_version_id=vid and item_kind='seating';
 if sleeping<max_guests then issues:=issues||jsonb_build_array(jsonb_build_object('code','SLEEPING_CAPACITY_INSUFFICIENT','severity','blocking'));blocking:=blocking+1;end if;
 if dining<max_guests then issues:=issues||jsonb_build_array(jsonb_build_object('code','DINING_CAPACITY_INSUFFICIENT','severity','warning'));warnings:=warnings+1;end if;
 if living<max_guests then issues:=issues||jsonb_build_array(jsonb_build_object('code','LIVING_CAPACITY_INSUFFICIENT','severity','warning'));warnings:=warnings+1;end if;
 select jsonb_build_object('productSubtotalMinor',coalesce(sum(coalesce(unit_price_minor,0)*quantity) filter(where budget_treatment='included'),0),'deliveryMinor',coalesce(sum(delivery_minor*quantity) filter(where budget_treatment='included'),0),'assemblyMinor',coalesce(sum(assembly_minor*quantity) filter(where budget_treatment='included'),0),'installationMinor',coalesce(sum(installation_minor*quantity) filter(where budget_treatment='included'),0),'currency',v.currency,'basis',v.budget_basis,'missingPrices',count(*) filter(where budget_treatment='included' and unit_price_minor is null)) into budget from public.fsux4_package_items where package_version_id=vid;
 capacity:=jsonb_build_object('maximumGuests',max_guests,'sleepingCapacity',sleeping,'diningSeats',dining,'livingSeats',living);
 snapshot:=public.fsux4_package_snapshot(vid);hash:=encode(digest(snapshot::text,'sha256'),'hex');
 insert into public.fsux4_package_validation_runs(package_id,package_version_id,version,status,blocking_count,warning_count,informational_count,issues,composition_hash,budget_snapshot,capacity_snapshot,actor_id,correlation_id)
 values(pid,vid,expected,case when blocking=0 then 'ready' else 'blocked' end,blocking,warnings,infos,issues,hash,budget,capacity,a,correlation) returning id into run_id;
 return jsonb_build_object('status',case when blocking=0 then 'ready' else 'blocked' end,'validationRunId',run_id,'blocking',blocking,'warnings',warnings,'informational',infos,'issues',issues,'compositionHash',hash,'budget',budget,'capacity',capacity);
end$$;

create or replace function public.fsux4_submit_package_review(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a uuid;pid uuid;vid uuid;run_id uuid;expected bigint;command_key text;correlation text;p public.furnishing_packages%rowtype;v public.furnishing_package_versions%rowtype;r public.fsux4_package_validation_runs%rowtype;prior public.fsux4_package_review_events%rowtype;snapshot jsonb;hash text;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ROOM_PACKAGE_ADMIN_REQUIRED' using errcode='42501';end if;
 begin pid:=(p_input->>'package_id')::uuid;vid:=(p_input->>'package_version_id')::uuid;run_id:=(p_input->>'validation_run_id')::uuid;expected:=(p_input->>'expected_version')::bigint;exception when others then raise exception 'ROOM_PACKAGE_SUBMISSION_COMMAND_INVALID';end;
 command_key:=left(trim(p_input->>'idempotency_key'),200);correlation:=left(trim(p_input->>'correlation_id'),200);if length(command_key)<8 or length(correlation)<8 then raise exception 'ROOM_PACKAGE_SUBMISSION_COMMAND_INVALID';end if;
 select * into prior from public.fsux4_package_review_events where idempotency_key=command_key;if found then return prior.evidence||jsonb_build_object('status','replayed','eventId',prior.id);end if;
 select * into p from public.furnishing_packages where id=pid and governance_scope<>'legacy_ambiguous' for update;if not found then raise exception 'ROOM_PACKAGE_NOT_FOUND_OR_FROZEN';end if;a:=public.fsux4_assert_actor(p.workspace_id,p.governance_scope='platform');
 select * into v from public.furnishing_package_versions where id=vid and furnishing_package_id=pid for update;if not found or v.lifecycle_status not in('draft','changes_requested') or v.optimistic_version<>expected then raise exception 'ROOM_PACKAGE_VERSION_STALE_OR_NOT_EDITABLE';end if;
 select * into r from public.fsux4_package_validation_runs where id=run_id and package_version_id=vid and version=expected and status='ready';if not found then raise exception 'ROOM_PACKAGE_AUTHORITATIVE_VALIDATION_REQUIRED';end if;
 snapshot:=public.fsux4_package_snapshot(vid);hash:=encode(digest(snapshot::text,'sha256'),'hex');if hash<>r.composition_hash then raise exception 'ROOM_PACKAGE_VALIDATION_STALE';end if;
 if jsonb_array_length(snapshot->'items')=0 then raise exception 'ROOM_PACKAGE_COMPOSITION_REQUIRED';end if;
 update public.furnishing_package_versions set lifecycle_status='in_review',submitted_at=now(),submitted_by=a,budget_snapshot=r.budget_snapshot,capacity_snapshot=r.capacity_snapshot,optimistic_version=optimistic_version+1 where id=vid;
 update public.furnishing_packages set lifecycle_status='in_review',updated_at=now() where id=pid;
 insert into public.fsux4_package_review_events(package_id,package_version_id,event_type,actor_id,correlation_id,idempotency_key,evidence) values(pid,vid,'submitted',a,correlation,command_key,jsonb_build_object('packageId',pid,'versionId',vid,'validationRunId',run_id,'compositionHash',hash,'snapshot',snapshot,'externalEffects',false)) returning * into prior;
 return prior.evidence||jsonb_build_object('status','in_review','eventId',prior.id,'version',expected+1);
end$$;

create or replace function public.fsux4_review_package(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a uuid;pid uuid;vid uuid;expected bigint;decision text;reason text;command_key text;correlation text;p public.furnishing_packages%rowtype;v public.furnishing_package_versions%rowtype;prior public.fsux4_package_review_events%rowtype;r public.fsux4_package_validation_runs%rowtype;snapshot jsonb;hash text;snapshot_id uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ROOM_PACKAGE_ADMIN_REQUIRED' using errcode='42501';end if;
 begin pid:=(p_input->>'package_id')::uuid;vid:=(p_input->>'package_version_id')::uuid;expected:=(p_input->>'expected_version')::bigint;exception when others then raise exception 'ROOM_PACKAGE_REVIEW_COMMAND_INVALID';end;
 decision:=p_input->>'decision';reason:=trim(p_input->>'reason');command_key:=left(trim(p_input->>'idempotency_key'),200);correlation:=left(trim(p_input->>'correlation_id'),200);
 if decision not in('approve','request_changes') or length(reason)<3 or length(command_key)<8 or length(correlation)<8 then raise exception 'ROOM_PACKAGE_REVIEW_COMMAND_INVALID';end if;
 select * into prior from public.fsux4_package_review_events where idempotency_key=command_key;if found then return prior.evidence||jsonb_build_object('status','replayed','eventId',prior.id);end if;
 select * into p from public.furnishing_packages where id=pid and governance_scope<>'legacy_ambiguous' for update;if not found then raise exception 'ROOM_PACKAGE_NOT_FOUND_OR_FROZEN';end if;a:=public.fsux4_assert_actor(p.workspace_id,p.governance_scope='platform');
 select * into v from public.furnishing_package_versions where id=vid and furnishing_package_id=pid for update;if not found or v.lifecycle_status<>'in_review' or v.optimistic_version<>expected then raise exception 'ROOM_PACKAGE_REVIEW_STATE_CONFLICT';end if;
 if decision='request_changes' then
  update public.furnishing_package_versions set lifecycle_status='changes_requested',optimistic_version=optimistic_version+1 where id=vid;update public.furnishing_packages set lifecycle_status='changes_requested',updated_at=now() where id=pid;
  insert into public.fsux4_package_review_events(package_id,package_version_id,event_type,reason,affected_target,actor_id,correlation_id,idempotency_key,evidence) values(pid,vid,'changes_requested',reason,coalesce(p_input->'affected_target','{}'),a,correlation,command_key,jsonb_build_object('status','changes_requested','reason',reason,'externalEffects',false)) returning * into prior;
  return prior.evidence||jsonb_build_object('eventId',prior.id,'version',expected+1);
 end if;
 select * into r from public.fsux4_package_validation_runs where package_version_id=vid and version=expected-1 and status='ready' order by created_at desc limit 1;if not found then raise exception 'ROOM_PACKAGE_APPROVAL_VALIDATION_REQUIRED';end if;
 snapshot:=public.fsux4_package_snapshot(vid);hash:=encode(digest(snapshot::text,'sha256'),'hex');if hash<>r.composition_hash then raise exception 'ROOM_PACKAGE_APPROVAL_SNAPSHOT_STALE';end if;
 insert into public.fsux4_package_approval_snapshots(package_id,package_version_id,validation_run_id,snapshot,snapshot_hash,approved_by,correlation_id) values(pid,vid,r.id,snapshot,hash,a,correlation) returning id into snapshot_id;
 update public.furnishing_package_versions set lifecycle_status='approved',approved_at=now(),approved_by=a,optimistic_version=optimistic_version+1 where id=vid;
 update public.furnishing_package_versions set lifecycle_status='superseded' where furnishing_package_id=pid and id<>vid and lifecycle_status='approved';
 update public.furnishing_packages set lifecycle_status='approved',current_version_id=vid,updated_at=now() where id=pid;
 insert into public.fsux4_package_review_events(package_id,package_version_id,event_type,reason,actor_id,correlation_id,idempotency_key,evidence) values(pid,vid,'approved',reason,a,correlation,command_key,jsonb_build_object('status','approved','snapshotId',snapshot_id,'snapshotHash',hash,'externalEffects',false)) returning * into prior;
 return prior.evidence||jsonb_build_object('eventId',prior.id,'version',expected+1);
end$$;

create or replace function public.fsux4_create_package_revision(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a uuid;pid uuid;source_id uuid;expected bigint;command_key text;correlation text;p public.furnishing_packages%rowtype;source public.furnishing_package_versions%rowtype;prior public.fsux4_package_review_events%rowtype;next_version int;next_id uuid;r record;new_room uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ROOM_PACKAGE_ADMIN_REQUIRED' using errcode='42501';end if;
 begin pid:=(p_input->>'package_id')::uuid;source_id:=(p_input->>'source_version_id')::uuid;expected:=(p_input->>'expected_version')::bigint;exception when others then raise exception 'ROOM_PACKAGE_REVISION_COMMAND_INVALID';end;
 command_key:=left(trim(p_input->>'idempotency_key'),200);correlation:=left(trim(p_input->>'correlation_id'),200);if length(command_key)<8 or length(correlation)<8 then raise exception 'ROOM_PACKAGE_REVISION_COMMAND_INVALID';end if;
 select * into prior from public.fsux4_package_review_events where idempotency_key=command_key;if found then return prior.evidence||jsonb_build_object('status','replayed','eventId',prior.id);end if;
 select * into p from public.furnishing_packages where id=pid and governance_scope<>'legacy_ambiguous' for update;if not found then raise exception 'ROOM_PACKAGE_NOT_FOUND_OR_FROZEN';end if;a:=public.fsux4_assert_actor(p.workspace_id,p.governance_scope='platform');
 perform pg_advisory_xact_lock(hashtextextended('fsux4-package:'||pid::text,0));select * into source from public.furnishing_package_versions where id=source_id and furnishing_package_id=pid and lifecycle_status='approved' and optimistic_version=expected;if not found then raise exception 'ROOM_PACKAGE_APPROVED_VERSION_STALE';end if;
 if exists(select 1 from public.furnishing_package_versions where furnishing_package_id=pid and lifecycle_status in('draft','changes_requested','in_review')) then raise exception 'ROOM_PACKAGE_REVISION_ALREADY_OPEN';end if;
 select coalesce(max(version_number),0)+1 into next_version from public.furnishing_package_versions where furnishing_package_id=pid;
 insert into public.furnishing_package_versions(furnishing_package_id,version_number,lifecycle_status,target_property_type,estimated_budget_low_minor,estimated_budget_high_minor,currency,bedroom_min,bedroom_max,bathroom_min,bathroom_max,guest_min,guest_max,applicability,based_on_version_id,profile,budget_basis,budget_snapshot,capacity_snapshot,created_by)
 values(pid,next_version,'draft',source.target_property_type,source.estimated_budget_low_minor,source.estimated_budget_high_minor,source.currency,source.bedroom_min,source.bedroom_max,source.bathroom_min,source.bathroom_max,source.guest_min,source.guest_max,source.applicability,source.id,source.profile,source.budget_basis,source.budget_snapshot,source.capacity_snapshot,a) returning id into next_id;
 for r in select * from public.fsux4_package_rooms where package_version_id=source_id order by sort_order loop
  insert into public.fsux4_package_rooms(package_version_id,copied_from_room_id,canonical_room_type,display_name,sort_order,is_required,intended_occupancy,sleeping_capacity,description,internal_notes,created_by) values(next_id,r.id,r.canonical_room_type,r.display_name,r.sort_order,r.is_required,r.intended_occupancy,r.sleeping_capacity,r.description,r.internal_notes,a) returning id into new_room;
  insert into public.fsux4_package_items(package_version_id,room_id,copied_from_item_id,product_id,product_revision,quantity,priority,fulfillment_required,placement_guidance,budget_treatment,item_kind,tv_size_inches,mount_min_inches,mount_max_inches,mount_not_required_reason,unit_price_minor,delivery_minor,assembly_minor,installation_minor,currency,price_verified_at,sort_order,unresolved_reason,added_by)
  select next_id,new_room,i.id,i.product_id,i.product_revision,i.quantity,i.priority,i.fulfillment_required,i.placement_guidance,i.budget_treatment,i.item_kind,i.tv_size_inches,i.mount_min_inches,i.mount_max_inches,i.mount_not_required_reason,i.unit_price_minor,i.delivery_minor,i.assembly_minor,i.installation_minor,i.currency,i.price_verified_at,i.sort_order,i.unresolved_reason,a from public.fsux4_package_items i where i.room_id=r.id;
  insert into public.fsux4_package_item_alternatives(package_item_id,product_id,product_revision,rank,reason,price_difference_minor,material_style_difference,capacity_size_difference,approval_status,added_by)
  select copied.id,alt.product_id,alt.product_revision,alt.rank,alt.reason,alt.price_difference_minor,alt.material_style_difference,alt.capacity_size_difference,alt.approval_status,a from public.fsux4_package_items copied join public.fsux4_package_item_alternatives alt on alt.package_item_id=copied.copied_from_item_id where copied.package_version_id=next_id and copied.room_id=new_room;
 end loop;
 update public.furnishing_packages set lifecycle_status='draft',updated_at=now() where id=pid;
 insert into public.fsux4_package_review_events(package_id,package_version_id,event_type,reason,actor_id,correlation_id,idempotency_key,evidence) values(pid,next_id,'revision_created',nullif(trim(p_input->>'reason'),''),a,correlation,command_key,jsonb_build_object('status','draft','sourceVersionId',source_id,'revisionVersionId',next_id,'versionNumber',next_version,'externalEffects',false)) returning * into prior;
 return prior.evidence||jsonb_build_object('eventId',prior.id);
end$$;

create or replace function public.fsux4_retire_package(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a uuid;pid uuid;expected bigint;reason text;command_key text;correlation text;p public.furnishing_packages%rowtype;v public.furnishing_package_versions%rowtype;prior public.fsux4_package_review_events%rowtype;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'ROOM_PACKAGE_ADMIN_REQUIRED' using errcode='42501';end if;
 begin pid:=(p_input->>'package_id')::uuid;expected:=(p_input->>'expected_version')::bigint;exception when others then raise exception 'ROOM_PACKAGE_RETIRE_COMMAND_INVALID';end;reason:=trim(p_input->>'reason');command_key:=left(trim(p_input->>'idempotency_key'),200);correlation:=left(trim(p_input->>'correlation_id'),200);
 if length(reason)<3 or length(command_key)<8 or length(correlation)<8 then raise exception 'ROOM_PACKAGE_RETIRE_COMMAND_INVALID';end if;select * into prior from public.fsux4_package_review_events where idempotency_key=command_key;if found then return prior.evidence||jsonb_build_object('status','replayed');end if;
 select * into p from public.furnishing_packages where id=pid and governance_scope<>'legacy_ambiguous' and lifecycle_status='approved' for update;if not found then raise exception 'ROOM_PACKAGE_NOT_RETIRABLE';end if;a:=public.fsux4_assert_actor(p.workspace_id,p.governance_scope='platform');select * into v from public.furnishing_package_versions where id=p.current_version_id and optimistic_version=expected for update;if not found then raise exception 'ROOM_PACKAGE_VERSION_STALE';end if;
 update public.furnishing_packages set lifecycle_status='retired',retired_at=now(),retired_by=a,retirement_reason=reason,replacement_package_id=nullif(p_input->>'replacement_package_id','')::uuid,updated_at=now() where id=pid;update public.furnishing_package_versions set lifecycle_status='retired',optimistic_version=optimistic_version+1 where id=v.id;
 insert into public.fsux4_package_review_events(package_id,package_version_id,event_type,reason,actor_id,correlation_id,idempotency_key,evidence) values(pid,v.id,'retired',reason,a,correlation,command_key,jsonb_build_object('status','retired','externalEffects',false)) returning * into prior;return prior.evidence||jsonb_build_object('eventId',prior.id);
end$$;

create or replace function public.fsux4_prevent_approved_mutation()
returns trigger language plpgsql set search_path=public,pg_temp as $$begin
 if exists(select 1 from public.furnishing_package_versions v where v.id=coalesce(old.package_version_id,old.id) and v.lifecycle_status in('approved','superseded','retired')) then raise exception 'ROOM_PACKAGE_APPROVED_SNAPSHOT_IMMUTABLE';end if;return coalesce(new,old);
end$$;
create trigger fsux4_rooms_immutable before update or delete on public.fsux4_package_rooms for each row execute function public.fsux4_prevent_approved_mutation();
create trigger fsux4_items_immutable before update or delete on public.fsux4_package_items for each row execute function public.fsux4_prevent_approved_mutation();
create or replace function public.fsux4_prevent_snapshot_mutation() returns trigger language plpgsql set search_path=public,pg_temp as $$begin raise exception 'ROOM_PACKAGE_APPROVAL_SNAPSHOT_IMMUTABLE';end$$;
create trigger fsux4_snapshots_immutable before update or delete on public.fsux4_package_approval_snapshots for each row execute function public.fsux4_prevent_snapshot_mutation();

alter table public.fsux4_package_rooms enable row level security;alter table public.fsux4_package_items enable row level security;alter table public.fsux4_package_item_alternatives enable row level security;alter table public.fsux4_package_validation_runs enable row level security;alter table public.fsux4_package_review_events enable row level security;alter table public.fsux4_package_approval_snapshots enable row level security;alter table public.fsux4_package_adoptions enable row level security;alter table public.fsux4_package_activity enable row level security;
create policy "Members read governed package rooms" on public.fsux4_package_rooms for select to authenticated using(exists(select 1 from public.furnishing_package_versions v join public.furnishing_packages p on p.id=v.furnishing_package_id where v.id=package_version_id and p.governance_scope<>'legacy_ambiguous' and (p.governance_scope='platform' or public.active_workspace_role(p.workspace_id) is not null or public.is_admin())));
create policy "Members read governed package items" on public.fsux4_package_items for select to authenticated using(exists(select 1 from public.furnishing_package_versions v join public.furnishing_packages p on p.id=v.furnishing_package_id where v.id=package_version_id and p.governance_scope<>'legacy_ambiguous' and (p.governance_scope='platform' or public.active_workspace_role(p.workspace_id) is not null or public.is_admin())));
create policy "Members read governed package alternatives" on public.fsux4_package_item_alternatives for select to authenticated using(exists(select 1 from public.fsux4_package_items i join public.furnishing_package_versions v on v.id=i.package_version_id join public.furnishing_packages p on p.id=v.furnishing_package_id where i.id=package_item_id and (p.governance_scope='platform' or public.active_workspace_role(p.workspace_id) is not null or public.is_admin())));
create policy "Members read package validation" on public.fsux4_package_validation_runs for select to authenticated using(exists(select 1 from public.furnishing_packages p where p.id=package_id and (p.governance_scope='platform' or public.active_workspace_role(p.workspace_id) is not null or public.is_admin())));
create policy "Members read package reviews" on public.fsux4_package_review_events for select to authenticated using(exists(select 1 from public.furnishing_packages p where p.id=package_id and (p.governance_scope='platform' or public.active_workspace_role(p.workspace_id) is not null or public.is_admin())));
create policy "Members read package snapshots" on public.fsux4_package_approval_snapshots for select to authenticated using(exists(select 1 from public.furnishing_packages p where p.id=package_id and (p.governance_scope='platform' or public.active_workspace_role(p.workspace_id) is not null or public.is_admin())));
create policy "Members read package adoptions" on public.fsux4_package_adoptions for select to authenticated using(public.active_workspace_role(workspace_id) is not null or public.is_admin());
create policy "Members read package activity" on public.fsux4_package_activity for select to authenticated using(workspace_id is null or public.active_workspace_role(workspace_id) is not null or public.is_admin());

revoke all on public.fsux4_package_rooms,public.fsux4_package_items,public.fsux4_package_item_alternatives,public.fsux4_package_validation_runs,public.fsux4_package_review_events,public.fsux4_package_approval_snapshots,public.fsux4_package_adoptions,public.fsux4_package_activity from public,anon,authenticated;
grant select on public.fsux4_package_rooms,public.fsux4_package_items,public.fsux4_package_item_alternatives,public.fsux4_package_validation_runs,public.fsux4_package_review_events,public.fsux4_package_approval_snapshots,public.fsux4_package_adoptions,public.fsux4_package_activity to authenticated;
revoke all on function public.fsux4_assert_actor(uuid,boolean),public.fsux4_package_snapshot(uuid),public.fsux4_create_package(jsonb),public.fsux4_mutate_package(jsonb),public.fsux4_adopt_template(jsonb),public.fsux4_validate_package(jsonb),public.fsux4_submit_package_review(jsonb),public.fsux4_review_package(jsonb),public.fsux4_create_package_revision(jsonb),public.fsux4_retire_package(jsonb) from public,anon;
grant execute on function public.fsux4_create_package(jsonb),public.fsux4_mutate_package(jsonb),public.fsux4_adopt_template(jsonb),public.fsux4_validate_package(jsonb),public.fsux4_submit_package_review(jsonb),public.fsux4_review_package(jsonb),public.fsux4_create_package_revision(jsonb),public.fsux4_retire_package(jsonb) to authenticated;

-- The predecessor intentionally keeps its legacy scope constraint NOT VALID: only
-- the three Production-derived records are classified, and FS-UX-004 never
-- manufactures an ownership decision for any other historical development row.

commit;
