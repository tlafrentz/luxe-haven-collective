-- FS-008G-C8-A: workspace catalog/package governance. Internal checkpoint only.
begin;

alter table public.furnishing_room_requirements
  add constraint furnishing_requirement_scope_consistent
  check ((scope='platform' and workspace_id is null) or (scope='workspace' and workspace_id is not null)) not valid;
alter table public.furnishing_room_packages
  add constraint furnishing_room_package_scope_consistent
  check ((scope='platform' and workspace_id is null) or (scope='workspace' and workspace_id is not null)) not valid;
alter table public.furnishing_products
  add constraint furnishing_product_scope_consistent
  check ((scope='platform' and workspace_id is null) or (scope='workspace' and workspace_id is not null)) not valid;
alter table public.furnishing_packages
  add column if not exists governance_scope text not null default 'workspace'
    check(governance_scope in('workspace','platform','legacy_ambiguous'));
update public.furnishing_packages set governance_scope='legacy_ambiguous'
where id in(
  '4d162594-f9a7-45e9-881e-adba36cd7406'::uuid,
  'c196e39c-5d10-4f9a-a8ea-48045da3fa10'::uuid,
  'a7e0d9cd-3f94-4ccb-9be4-c218bd0a1a96'::uuid
) and workspace_id is null and lifecycle_status='draft' and current_version_id is null;
alter table public.furnishing_packages
  add constraint furnishing_property_package_scope_consistent
  check(
    (governance_scope='workspace' and workspace_id is not null)
    or (governance_scope='platform' and workspace_id is null)
    or (governance_scope='legacy_ambiguous' and workspace_id is null and lifecycle_status='draft' and current_version_id is null)
  ) not valid;
create or replace function public.prevent_new_ambiguous_furnishing_package()
returns trigger language plpgsql set search_path=public,pg_temp as $$begin
 if new.governance_scope='legacy_ambiguous' and (tg_op='INSERT' or old.governance_scope<>'legacy_ambiguous') then raise exception 'FURNISHING_PACKAGE_LEGACY_SCOPE_RESERVED';end if;
 if tg_op='UPDATE' and old.governance_scope='legacy_ambiguous' and (new.workspace_id is not null or new.lifecycle_status<>'draft' or new.current_version_id is not null) then raise exception 'FURNISHING_PACKAGE_LEGACY_REVIEW_REQUIRED';end if;
 return new;
end$$;
create trigger prevent_new_ambiguous_furnishing_package before insert or update on public.furnishing_packages for each row execute function public.prevent_new_ambiguous_furnishing_package();

create table public.furnishing_catalog_approvals(
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id),
  target_type text not null check(target_type in('product','offer','requirement')),
  target_id uuid not null, status text not null check(status in('pending','approved','rejected','revoked')),
  target_snapshot jsonb not null, snapshot_hash text not null, reason text not null,
  correlation_id uuid not null, idempotency_key text not null unique,
  approved_by uuid not null references public.profiles(id), approved_at timestamptz not null default now(),
  unique(target_type,target_id,snapshot_hash,status)
);

create table public.furnishing_product_offer_assignments(
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id),
  product_id uuid not null references public.furnishing_products(id) on delete cascade,
  offer_id uuid not null references public.furnishing_product_offers(id) on delete cascade,
  role text not null check(role in('preferred','alternate')), rank integer not null check(rank>0),
  approval_id uuid not null references public.furnishing_catalog_approvals(id),
  assigned_by uuid not null references public.profiles(id), assigned_at timestamptz not null default now(), revoked_at timestamptz,
  unique(workspace_id,product_id,offer_id), unique(workspace_id,product_id,rank)
);
create unique index furnishing_one_preferred_offer
  on public.furnishing_product_offer_assignments(workspace_id,product_id)
  where role='preferred' and revoked_at is null;

create table public.furnishing_package_validation_runs(
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id),
  package_kind text not null check(package_kind in('room','property')), package_version_id uuid not null,
  status text not null check(status in('valid','invalid')), issues jsonb not null default '[]',
  composition_hash text not null, validated_by uuid not null references public.profiles(id),
  correlation_id uuid not null, created_at timestamptz not null default now()
);
create table public.furnishing_package_governance_approvals(
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.owners(id),
  package_kind text not null check(package_kind in('room','property')), package_version_id uuid not null,
  validation_run_id uuid not null references public.furnishing_package_validation_runs(id),
  composition_snapshot jsonb not null, composition_hash text not null, reason text not null,
  correlation_id uuid not null, idempotency_key text not null unique,
  approved_by uuid not null references public.profiles(id), approved_at timestamptz not null default now(),
  unique(package_kind,package_version_id,composition_hash)
);

create or replace function public.fs008g_internal_catalog_visible(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.furnishing_activation_releases r
    join public.furnishing_activation_workspaces w on w.release_id=r.id and w.workspace_id=p_workspace_id
    join public.furnishing_activation_capabilities c on c.release_id=r.id and c.capability='catalog_viewing'
    where r.milestone='FS-008A' and r.global_state='internal' and not r.global_kill_switch
      and r.configuration_valid and w.enabled and not w.kill_switch and w.cohort='internal'
      and w.revoked_at is null and (w.expires_at is null or w.expires_at>now()) and c.enabled
  ) and (public.active_workspace_role(p_workspace_id) is not null or public.is_admin())
$$;

create or replace function public.approve_controlled_furnishing_catalog_target(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a uuid:=auth.uid(); w uuid; t text; target uuid; state text; reason text; correlation uuid; command_key text; snapshot jsonb; hash text; prior public.furnishing_catalog_approvals%rowtype;
begin
 if a is null or not public.is_admin() then raise exception 'FURNISHING_CATALOG_ADMIN_REQUIRED' using errcode='42501'; end if;
 begin w:=(p_input->>'workspace_id')::uuid;target:=(p_input->>'target_id')::uuid;correlation:=(p_input->>'correlation_id')::uuid;exception when others then raise exception 'CATALOG_APPROVAL_COMMAND_INVALID';end;
 t:=p_input->>'target_type';state:=p_input->>'status';reason:=trim(p_input->>'reason');command_key:=left(trim(p_input->>'idempotency_key'),200);
 if t not in('product','offer','requirement') or state not in('approved','rejected','revoked') or length(reason)<3 or length(command_key)<8 then raise exception 'CATALOG_APPROVAL_COMMAND_INVALID';end if;
 perform public.authorize_controlled_furnishing_catalog_mutation(w);
 if t='product' then select to_jsonb(p) into snapshot from public.furnishing_products p where p.id=target and p.workspace_id=w and p.scope='workspace';
 elsif t='offer' then select to_jsonb(o) into snapshot from public.furnishing_product_offers o join public.furnishing_products p on p.id=o.product_id where o.id=target and p.workspace_id=w and p.scope='workspace';
 else select to_jsonb(q) into snapshot from public.furnishing_room_requirements q where q.id=target and q.workspace_id=w and q.scope='workspace'; end if;
 if snapshot is null then raise exception 'CATALOG_APPROVAL_TARGET_SCOPE_INVALID';end if;
 hash:=encode(digest(snapshot::text,'sha256'),'hex');
 select x.* into prior from public.furnishing_catalog_approvals x where x.idempotency_key=command_key;
 if found then if prior.target_id<>target or prior.snapshot_hash<>hash or prior.status<>state then raise exception 'CATALOG_APPROVAL_REPLAY_CONFLICT';end if;return jsonb_build_object('status','replayed','id',prior.id);end if;
 insert into public.furnishing_catalog_approvals(workspace_id,target_type,target_id,status,target_snapshot,snapshot_hash,reason,correlation_id,idempotency_key,approved_by) values(w,t,target,state,snapshot,hash,reason,correlation,command_key,a) returning * into prior;
 if t='product' then update public.furnishing_products set status=case when state='approved' then 'approved' else 'in_review' end where id=target;
 elsif t='offer' then update public.furnishing_product_offers set status=case when state='approved' then 'active' else 'unavailable' end where id=target; end if;
 return jsonb_build_object('status',state,'id',prior.id,'snapshotHash',hash);
end $$;

create or replace function public.assign_controlled_furnishing_offer(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a uuid:=auth.uid();w uuid;p uuid;o uuid;approval uuid;offer_role text;offer_rank integer;assignment public.furnishing_product_offer_assignments%rowtype;
begin
 if a is null or not public.is_admin() then raise exception 'FURNISHING_CATALOG_ADMIN_REQUIRED' using errcode='42501';end if;
 begin w:=(p_input->>'workspace_id')::uuid;p:=(p_input->>'product_id')::uuid;o:=(p_input->>'offer_id')::uuid;approval:=(p_input->>'approval_id')::uuid;offer_rank:=(p_input->>'rank')::integer;exception when others then raise exception 'OFFER_ASSIGNMENT_COMMAND_INVALID';end;
 offer_role:=p_input->>'role'; perform public.authorize_controlled_furnishing_catalog_mutation(w);
 if offer_role not in('preferred','alternate') or offer_rank<1 then raise exception 'OFFER_ASSIGNMENT_COMMAND_INVALID';end if;
 if not exists(select 1 from public.furnishing_products product join public.furnishing_product_offers offer on offer.product_id=product.id join public.furnishing_catalog_approvals approval_row on approval_row.id=approval and approval_row.target_type='offer' and approval_row.target_id=offer.id and approval_row.status='approved' where product.id=p and product.workspace_id=w and product.scope='workspace' and product.status='approved' and offer.id=o and offer.status='active' and approval_row.workspace_id=w) then raise exception 'OFFER_ASSIGNMENT_NOT_APPROVED';end if;
 insert into public.furnishing_product_offer_assignments(workspace_id,product_id,offer_id,role,rank,approval_id,assigned_by) values(w,p,o,offer_role,offer_rank,approval,a) returning * into assignment;
 if offer_role='preferred' then update public.furnishing_products set preferred_offer_id=o where id=p;end if;
 return jsonb_build_object('status','assigned','id',assignment.id,'role',offer_role,'rank',offer_rank);
end $$;

create or replace function public.validate_controlled_furnishing_package(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a uuid:=auth.uid();w uuid;v uuid;k text;correlation uuid;snapshot jsonb;issues jsonb:='[]'::jsonb;hash text;run_id uuid;
begin
 if a is null or not public.is_admin() then raise exception 'FURNISHING_PACKAGE_ADMIN_REQUIRED' using errcode='42501';end if;
 begin w:=(p_input->>'workspace_id')::uuid;v:=(p_input->>'package_version_id')::uuid;correlation:=(p_input->>'correlation_id')::uuid;exception when others then raise exception 'PACKAGE_VALIDATION_COMMAND_INVALID';end;
 k:=p_input->>'package_kind';if k not in('room','property') then raise exception 'PACKAGE_VALIDATION_COMMAND_INVALID';end if;
 perform public.authorize_controlled_furnishing_catalog_mutation(w);
 if k='room' then
   select jsonb_build_object('version',to_jsonb(version_row),'items',coalesce(jsonb_agg(to_jsonb(item_row) order by item_row.sort_order) filter(where item_row.id is not null),'[]'::jsonb)) into snapshot
   from public.furnishing_room_package_versions version_row join public.furnishing_room_packages package_row on package_row.id=version_row.room_package_id
   left join public.furnishing_room_package_items item_row on item_row.room_package_version_id=version_row.id
   where version_row.id=v and package_row.scope='workspace' and package_row.workspace_id=w and version_row.lifecycle_status='in_review' group by version_row.id;
   if snapshot is null then raise exception 'PACKAGE_VERSION_SCOPE_OR_STATE_INVALID';end if;
   if jsonb_array_length(snapshot->'items')=0 then issues:=issues||jsonb_build_array('ROOM_PACKAGE_COMPOSITION_REQUIRED');end if;
   if exists(select 1 from public.furnishing_room_package_items i left join public.furnishing_products p on p.id=i.recommended_product_id left join public.furnishing_product_offer_assignments x on x.product_id=p.id and x.workspace_id=w and x.role='preferred' and x.revoked_at is null where i.room_package_version_id=v and (i.quantity_rule_id is null or (i.required and i.recommended_product_id is null) or (i.recommended_product_id is not null and (p.status<>'approved' or x.id is null)))) then issues:=issues||jsonb_build_array('ROOM_PACKAGE_ITEM_NOT_GOVERNED');end if;
 else
   select jsonb_build_object('version',to_jsonb(version_row),'rooms',coalesce(jsonb_agg(to_jsonb(composition_row) order by composition_row.sort_order) filter(where composition_row.id is not null),'[]'::jsonb)) into snapshot
   from public.furnishing_package_versions version_row join public.furnishing_packages package_row on package_row.id=version_row.furnishing_package_id
   left join public.furnishing_package_room_composition composition_row on composition_row.furnishing_package_version_id=version_row.id
   where version_row.id=v and package_row.workspace_id=w and version_row.lifecycle_status='in_review' group by version_row.id;
   if snapshot is null then raise exception 'PACKAGE_VERSION_SCOPE_OR_STATE_INVALID';end if;
   if jsonb_array_length(snapshot->'rooms')=0 then issues:=issues||jsonb_build_array('PROPERTY_PACKAGE_COMPOSITION_REQUIRED');end if;
   if exists(select 1 from public.furnishing_package_room_composition c join public.furnishing_room_package_versions rv on rv.id=c.room_package_version_id join public.furnishing_room_packages rp on rp.id=rv.room_package_id where c.furnishing_package_version_id=v and (rv.lifecycle_status<>'approved' or rp.scope<>'workspace' or rp.workspace_id is distinct from w)) then issues:=issues||jsonb_build_array('PROPERTY_PACKAGE_ROOM_SCOPE_OR_APPROVAL_INVALID');end if;
 end if;
 hash:=encode(digest(snapshot::text,'sha256'),'hex');
 insert into public.furnishing_package_validation_runs(workspace_id,package_kind,package_version_id,status,issues,composition_hash,validated_by,correlation_id) values(w,k,v,case when jsonb_array_length(issues)=0 then 'valid' else 'invalid' end,issues,hash,a,correlation) returning id into run_id;
 return jsonb_build_object('status',case when jsonb_array_length(issues)=0 then 'valid' else 'invalid' end,'validationRunId',run_id,'issues',issues,'compositionHash',hash);
end $$;

create or replace function public.approve_controlled_furnishing_package(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a uuid:=auth.uid();w uuid;v uuid;run_id uuid;k text;reason text;correlation uuid;command_key text;validation public.furnishing_package_validation_runs%rowtype;approval_id uuid;
begin
 if a is null or not public.is_admin() then raise exception 'FURNISHING_PACKAGE_ADMIN_REQUIRED' using errcode='42501';end if;
 begin w:=(p_input->>'workspace_id')::uuid;v:=(p_input->>'package_version_id')::uuid;run_id:=(p_input->>'validation_run_id')::uuid;correlation:=(p_input->>'correlation_id')::uuid;exception when others then raise exception 'PACKAGE_APPROVAL_COMMAND_INVALID';end;
 k:=p_input->>'package_kind';reason:=trim(p_input->>'reason');command_key:=left(trim(p_input->>'idempotency_key'),200);
 if k not in('room','property') or length(reason)<3 or length(command_key)<8 then raise exception 'PACKAGE_APPROVAL_COMMAND_INVALID';end if;
 perform public.authorize_controlled_furnishing_catalog_mutation(w);
 if exists(select 1 from public.furnishing_package_governance_approvals x where x.idempotency_key=command_key) then return jsonb_build_object('status','replayed');end if;
 select x.* into validation from public.furnishing_package_validation_runs x where x.id=run_id and x.workspace_id=w and x.package_kind=k and x.package_version_id=v and x.status='valid';
 if not found then raise exception 'PACKAGE_VALIDATION_REQUIRED';end if;
 if k='room' then update public.furnishing_room_package_versions set lifecycle_status='approved',approved_at=now(),approved_by=a where id=v and lifecycle_status='in_review'; if not found then raise exception 'PACKAGE_VERSION_NOT_REVIEWABLE';end if; update public.furnishing_room_packages p set lifecycle_status='approved',current_version_id=v,updated_at=now() from public.furnishing_room_package_versions rv where rv.id=v and p.id=rv.room_package_id and p.workspace_id=w and p.scope='workspace';
 else update public.furnishing_package_versions set lifecycle_status='approved',approved_at=now() where id=v and lifecycle_status='in_review';if not found then raise exception 'PACKAGE_VERSION_NOT_REVIEWABLE';end if;update public.furnishing_packages p set lifecycle_status='approved',current_version_id=v,updated_at=now() from public.furnishing_package_versions pv where pv.id=v and p.id=pv.furnishing_package_id and p.workspace_id=w;end if;
 insert into public.furnishing_package_governance_approvals(workspace_id,package_kind,package_version_id,validation_run_id,composition_snapshot,composition_hash,reason,correlation_id,idempotency_key,approved_by) values(w,k,v,run_id,jsonb_build_object('validationRunId',run_id,'compositionHash',validation.composition_hash),validation.composition_hash,reason,correlation,command_key,a) returning id into approval_id;
 return jsonb_build_object('status','approved','id',approval_id,'compositionHash',validation.composition_hash);
end $$;

alter table public.furnishing_catalog_approvals enable row level security;
alter table public.furnishing_product_offer_assignments enable row level security;
alter table public.furnishing_package_validation_runs enable row level security;
alter table public.furnishing_package_governance_approvals enable row level security;
create policy "Internal cohort reads catalog approvals" on public.furnishing_catalog_approvals for select to authenticated using(public.fs008g_internal_catalog_visible(workspace_id));
create policy "Internal cohort reads offer assignments" on public.furnishing_product_offer_assignments for select to authenticated using(public.fs008g_internal_catalog_visible(workspace_id));
create policy "Internal cohort reads package validation" on public.furnishing_package_validation_runs for select to authenticated using(public.fs008g_internal_catalog_visible(workspace_id));
create policy "Internal cohort reads package approvals" on public.furnishing_package_governance_approvals for select to authenticated using(public.fs008g_internal_catalog_visible(workspace_id));
revoke all on public.furnishing_catalog_approvals,public.furnishing_product_offer_assignments,public.furnishing_package_validation_runs,public.furnishing_package_governance_approvals from public,anon;
revoke insert,update,delete on public.furnishing_catalog_approvals,public.furnishing_product_offer_assignments,public.furnishing_package_validation_runs,public.furnishing_package_governance_approvals from authenticated;
revoke all on function public.approve_controlled_furnishing_catalog_target(jsonb),public.assign_controlled_furnishing_offer(jsonb),public.validate_controlled_furnishing_package(jsonb),public.approve_controlled_furnishing_package(jsonb) from public,anon;
grant execute on function public.approve_controlled_furnishing_catalog_target(jsonb),public.assign_controlled_furnishing_offer(jsonb),public.validate_controlled_furnishing_package(jsonb),public.approve_controlled_furnishing_package(jsonb) to authenticated;

commit;
