-- FS-UX-009: package discovery and atomic plan eligibility reconciliation.
begin;

create or replace function public.discover_furnishing_owner_packages(p_workspace_id uuid)
returns table(package_version_id uuid,name text,description text,tier text,property_type text,version_number integer,estimated_budget_low_minor bigint,estimated_budget_high_minor bigint)
language sql stable security definer set search_path=public,pg_temp as $$
 select version_row.id,package_row.name,package_row.description,package_row.tier,package_row.property_type,
   version_row.version_number,version_row.estimated_budget_low_minor,version_row.estimated_budget_high_minor
 from public.furnishing_package_versions version_row
 join public.furnishing_packages package_row on package_row.id=version_row.furnishing_package_id
 join public.furnishing_package_governance_approvals approval on approval.package_kind='property'
   and approval.package_version_id=version_row.id and approval.workspace_id=p_workspace_id
 where public.fs008g_owner_selection_eligible(p_workspace_id)
   and package_row.workspace_id=p_workspace_id
   and package_row.lifecycle_status='approved'
   and package_row.current_version_id=version_row.id
   and version_row.lifecycle_status='approved'
   and not exists(
     select 1
     from public.furnishing_package_room_composition composition
     join public.furnishing_room_package_versions room_version on room_version.id=composition.room_package_version_id
     join public.furnishing_room_packages room_package on room_package.id=room_version.room_package_id
     join public.furnishing_room_package_items item on item.room_package_version_id=room_version.id and item.required
     left join public.furnishing_quantity_rules quantity_rule on quantity_rule.id=item.quantity_rule_id
       and quantity_rule.workspace_id=p_workspace_id
     left join public.furnishing_products product on product.id=item.recommended_product_id
       and product.workspace_id=p_workspace_id and product.scope='workspace'
       and product.status='approved' and product.retired_at is null
     left join lateral(
       select product_version.id
       from public.furnishing_product_versions product_version
       where product_version.product_id=product.id and product_version.workspace_id=p_workspace_id
         and product_version.lifecycle_status='approved'
       order by product_version.version desc,product_version.id
       limit 1
     ) eligible_version on true
     left join lateral(
       select offer.id
       from public.furnishing_product_offers offer
       join public.furnishing_product_offer_assignments assignment
         on assignment.workspace_id=p_workspace_id and assignment.product_id=product.id
        and assignment.offer_id=offer.id and assignment.revoked_at is null
       where offer.product_id=product.id and offer.workspace_id=p_workspace_id
         and offer.status='active' and offer.availability='in_stock'
         and offer.listed_price_minor is not null
       order by (offer.id=product.preferred_offer_id) desc,
         (assignment.role='preferred') desc,assignment.rank,offer.listed_price_minor,offer.id
       limit 1
     ) eligible_offer on true
     where composition.furnishing_package_version_id=version_row.id
       and (room_package.workspace_id<>p_workspace_id
         or room_package.lifecycle_status<>'approved'
         or room_package.current_version_id is distinct from room_version.id
         or room_version.lifecycle_status<>'approved'
         or quantity_rule.id is null
         or quantity_rule.rule_type='custom'
         or quantity_rule.multiplier<=0
         or product.id is null
         or eligible_version.id is null
         or eligible_offer.id is null)
   )
 order by package_row.name,version_row.version_number desc
$$;

alter function public.generate_authorized_furnishing_plan(jsonb)
  rename to generate_authorized_furnishing_plan_pre_eligibility;

revoke all on function public.generate_authorized_furnishing_plan_pre_eligibility(jsonb)
  from public,anon,authenticated;

create function public.generate_authorized_furnishing_plan(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  actor uuid:=auth.uid();
  context_id uuid;
  context_row public.furnishing_command_contexts%rowtype;
  project_row public.furnishing_projects%rowtype;
  package_version public.furnishing_package_versions%rowtype;
  package_row public.furnishing_packages%rowtype;
  prior public.furnishing_plan_generation_commands%rowtype;
  eligibility record;
  generated jsonb;
begin
  if actor is null then
    raise exception 'FURNISHING_PLAN_UNAUTHENTICATED' using errcode='42501';
  end if;
  begin
    context_id:=(p_input->>'command_context_id')::uuid;
  exception when others then
    raise exception 'FURNISHING_PLAN_COMMAND_INVALID';
  end;

  perform pg_advisory_xact_lock(hashtextextended('furnishing-plan-generate:'||context_id::text,0));
  select context.* into context_row
  from public.furnishing_command_contexts context
  where context.id=context_id for update;
  if not found then raise exception 'FURNISHING_PLAN_CONTEXT_MISSING'; end if;
  if context_row.actor_id<>actor then
    raise exception 'FURNISHING_PLAN_CONTEXT_ACTOR_MISMATCH' using errcode='42501';
  end if;

  select command.* into prior
  from public.furnishing_plan_generation_commands command
  where command.idempotency_key=context_row.idempotency_key for update;
  if found then
    return public.generate_authorized_furnishing_plan_pre_eligibility(p_input);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('furnishing-plan-project:'||context_row.target_id,0));
  select project.* into project_row
  from public.furnishing_projects project
  where project.id::text=context_row.target_id for update;
  if not found then raise exception 'FURNISHING_PLAN_PROJECT_NOT_FOUND'; end if;
  if project_row.workspace_id<>context_row.workspace_id then
    raise exception 'FURNISHING_PLAN_WORKSPACE_MISMATCH' using errcode='42501';
  end if;

  select version.* into package_version
  from public.furnishing_package_versions version
  where version.id=project_row.furnishing_package_version_id for share;
  if not found then raise exception 'FURNISHING_PLAN_PACKAGE_NOT_FOUND'; end if;
  select package.* into package_row
  from public.furnishing_packages package
  where package.id=package_version.furnishing_package_id for share;
  if not found or package_row.workspace_id<>project_row.workspace_id
    or package_row.lifecycle_status<>'approved'
    or package_row.current_version_id is distinct from package_version.id
    or package_version.lifecycle_status<>'approved'
  then raise exception 'FURNISHING_PLAN_PACKAGE_STALE'; end if;

  perform 1 from public.furnishing_package_room_composition composition
  where composition.furnishing_package_version_id=package_version.id
  order by composition.id for share;
  perform 1 from public.furnishing_room_package_versions room_version
  where room_version.id in(select composition.room_package_version_id
    from public.furnishing_package_room_composition composition
    where composition.furnishing_package_version_id=package_version.id)
  order by room_version.id for share;
  perform 1 from public.furnishing_room_packages room_package
  where room_package.id in(select room_version.room_package_id
    from public.furnishing_room_package_versions room_version
    where room_version.id in(select composition.room_package_version_id
      from public.furnishing_package_room_composition composition
      where composition.furnishing_package_version_id=package_version.id))
  order by room_package.id for share;
  perform 1 from public.furnishing_room_package_items item
  where item.room_package_version_id in(select composition.room_package_version_id
    from public.furnishing_package_room_composition composition
    where composition.furnishing_package_version_id=package_version.id)
  order by item.id for share;
  perform 1 from public.furnishing_quantity_rules quantity_rule
  where quantity_rule.id in(select item.quantity_rule_id
    from public.furnishing_room_package_items item
    where item.room_package_version_id in(select composition.room_package_version_id
      from public.furnishing_package_room_composition composition
      where composition.furnishing_package_version_id=package_version.id))
  order by quantity_rule.id for share;
  perform 1 from public.furnishing_products product
  where product.id in(select item.recommended_product_id
    from public.furnishing_room_package_items item
    where item.room_package_version_id in(select composition.room_package_version_id
      from public.furnishing_package_room_composition composition
      where composition.furnishing_package_version_id=package_version.id))
  order by product.id for share;
  perform 1 from public.furnishing_product_versions product_version
  where product_version.product_id in(select item.recommended_product_id
    from public.furnishing_room_package_items item
    where item.room_package_version_id in(select composition.room_package_version_id
      from public.furnishing_package_room_composition composition
      where composition.furnishing_package_version_id=package_version.id))
  order by product_version.id for share;
  perform 1 from public.furnishing_product_offers offer
  where offer.product_id in(select item.recommended_product_id
    from public.furnishing_room_package_items item
    where item.room_package_version_id in(select composition.room_package_version_id
      from public.furnishing_package_room_composition composition
      where composition.furnishing_package_version_id=package_version.id))
  order by offer.id for share;
  perform 1 from public.furnishing_product_offer_assignments assignment
  where assignment.product_id in(select item.recommended_product_id
    from public.furnishing_room_package_items item
    where item.room_package_version_id in(select composition.room_package_version_id
      from public.furnishing_package_room_composition composition
      where composition.furnishing_package_version_id=package_version.id))
  order by assignment.id for share;

  for eligibility in
    select item.id as package_item_id,item.required,item.recommended_product_id,
      room_package.workspace_id as room_package_workspace_id,
      room_package.lifecycle_status as room_package_status,
      room_package.current_version_id as current_room_package_version_id,
      room_version.id as room_package_version_id,
      room_version.lifecycle_status as room_package_version_status,
      quantity_rule.id as quantity_rule_id,quantity_rule.rule_type,quantity_rule.multiplier,
      product.id as product_id,product.status as product_status,product.retired_at,
      eligible_version.id as product_version_id,eligible_offer.id as offer_id
    from public.furnishing_package_room_composition composition
    join public.furnishing_room_package_versions room_version on room_version.id=composition.room_package_version_id
    join public.furnishing_room_packages room_package on room_package.id=room_version.room_package_id
    join public.furnishing_room_package_items item on item.room_package_version_id=room_version.id
    left join public.furnishing_quantity_rules quantity_rule on quantity_rule.id=item.quantity_rule_id
      and quantity_rule.workspace_id=project_row.workspace_id
    left join public.furnishing_products product on product.id=item.recommended_product_id
      and product.workspace_id=project_row.workspace_id and product.scope='workspace'
      and product.status='approved' and product.retired_at is null
    left join lateral(
      select product_version.id
      from public.furnishing_product_versions product_version
      where product_version.product_id=product.id
        and product_version.workspace_id=project_row.workspace_id
        and product_version.lifecycle_status='approved'
      order by product_version.version desc,product_version.id
      limit 1
    ) eligible_version on true
    left join lateral(
      select offer.id
      from public.furnishing_product_offers offer
      join public.furnishing_product_offer_assignments assignment
        on assignment.workspace_id=project_row.workspace_id and assignment.product_id=product.id
       and assignment.offer_id=offer.id and assignment.revoked_at is null
      where offer.product_id=product.id and offer.workspace_id=project_row.workspace_id
        and offer.status='active' and offer.availability='in_stock'
        and offer.listed_price_minor is not null
      order by (offer.id=product.preferred_offer_id) desc,
        (assignment.role='preferred') desc,assignment.rank,offer.listed_price_minor,offer.id
      limit 1
    ) eligible_offer on true
    where composition.furnishing_package_version_id=package_version.id
    order by composition.sort_order,composition.id,item.sort_order,item.id
  loop
    if eligibility.required and (
      eligibility.room_package_workspace_id<>project_row.workspace_id
      or eligibility.room_package_status<>'approved'
      or eligibility.current_room_package_version_id is distinct from eligibility.room_package_version_id
      or eligibility.room_package_version_status<>'approved'
      or eligibility.quantity_rule_id is null
      or eligibility.rule_type='custom'
      or eligibility.multiplier<=0
      or eligibility.product_id is null
      or eligibility.product_version_id is null
      or eligibility.offer_id is null
    ) then
      raise exception 'FURNISHING_PLAN_PACKAGE_ITEM_INELIGIBLE:%',eligibility.package_item_id;
    end if;
    if eligibility.product_version_id is not null then
      perform 1 from public.furnishing_product_versions version
      where version.id=eligibility.product_version_id for share;
    end if;
    if eligibility.offer_id is not null then
      perform 1 from public.furnishing_product_offers offer
      where offer.id=eligibility.offer_id for share;
      perform 1 from public.furnishing_product_offer_assignments assignment
      where assignment.workspace_id=project_row.workspace_id
        and assignment.product_id=eligibility.product_id
        and assignment.offer_id=eligibility.offer_id and assignment.revoked_at is null for share;
    end if;
  end loop;

  generated:=public.generate_authorized_furnishing_plan_pre_eligibility(p_input);

  update public.furnishing_product_selections selection
  set product_version_id=(select version.id
    from public.furnishing_product_versions version
    where version.product_id=selection.product_id
      and version.workspace_id=project_row.workspace_id
      and version.lifecycle_status='approved'
    order by version.version desc,version.id
    limit 1)
  where selection.furnishing_plan_id=(generated->>'planId')::uuid
    and selection.product_id is not null;

  if exists(
    select 1 from public.furnishing_product_selections selection
    where selection.furnishing_plan_id=(generated->>'planId')::uuid
      and selection.required and selection.product_version_id is null
  ) then raise exception 'FURNISHING_PLAN_PRODUCT_VERSION_PERSISTENCE_FAILED'; end if;

  return generated;
end $$;

revoke all on function public.discover_furnishing_owner_packages(uuid),
  public.generate_authorized_furnishing_plan(jsonb) from public,anon;
grant execute on function public.discover_furnishing_owner_packages(uuid),
  public.generate_authorized_furnishing_plan(jsonb) to authenticated;

commit;
