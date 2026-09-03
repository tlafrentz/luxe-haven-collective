-- FS-UX-009 Production certification correction: an identical selection
-- allocation replay is checked against the original accepted plan revision.
begin;

create or replace function public.save_furnishing_selection_delivery(p_input jsonb)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare a uuid:=auth.uid();selection_id uuid;expected bigint;requested numeric;delivery bigint;correlation uuid;command_key text;selection public.furnishing_product_selections%rowtype;plan public.furnishing_plans%rowtype;project public.furnishing_projects%rowtype;property_id uuid;rule public.furnishing_quantity_rules%rowtype;allocation public.furnishing_selection_delivery_allocations%rowtype;fingerprint text;prior public.furnishing_owner_plan_commands%rowtype;
begin
 if a is null then raise exception 'OWNER_SELECTION_UNAUTHORIZED' using errcode='42501';end if;
 begin selection_id:=(p_input->>'selection_id')::uuid;expected:=(p_input->>'expected_revision')::bigint;requested:=(p_input->>'quantity')::numeric;delivery:=(p_input->>'delivery_minor')::bigint;correlation:=(p_input->>'correlation_id')::uuid;exception when others then raise exception 'OWNER_SELECTION_COMMAND_INVALID';end;
 command_key:=left(trim(p_input->>'idempotency_key'),200);if length(command_key)<8 or requested<0 or delivery<0 then raise exception 'OWNER_SELECTION_COMMAND_INVALID';end if;
 select s.* into selection from public.furnishing_product_selections s where s.id=selection_id for update;if not found then raise exception 'OWNER_SELECTION_NOT_FOUND';end if;
 select x.* into plan from public.furnishing_plans x where x.id=selection.furnishing_plan_id for update;select p.* into project from public.furnishing_projects p where p.id=plan.project_id;property_id:=project.property_id;
 select c.* into prior from public.furnishing_owner_plan_commands c where c.idempotency_key=command_key for update;
 if found then
  fingerprint:=encode(digest(concat_ws(':',selection_id,prior.expected_revision,requested,delivery,correlation),'sha256'),'hex');
  if prior.payload_hash<>fingerprint or prior.workspace_id<>project.workspace_id or prior.project_id<>project.id or prior.plan_id<>plan.id or prior.actor_id<>a or prior.command_type<>'selection_saved'
    or not exists(select 1 from public.furnishing_command_contexts context where context.idempotency_key=command_key and context.actor_id=a and context.workspace_id=project.workspace_id and context.command_type='project.selection.quantity' and context.target_type='selection' and context.target_id=selection_id::text)
  then raise exception 'OWNER_SELECTION_REPLAY_CONFLICT';end if;
  return prior.after_state||jsonb_build_object('status','replayed');
 end if;
 if plan.status<>'draft' or plan.revision<>expected or not public.fs008g_owner_selection_eligible(project.workspace_id) then raise exception 'OWNER_SELECTION_STALE_OR_INELIGIBLE';end if;
 select q.* into rule from public.furnishing_quantity_rules q where q.id=selection.quantity_rule_id;
 if rule.rule_type='fixed' and rule.multiplier=1 and requested<>1 then raise exception 'OWNER_SELECTION_FIXED_ONE';end if;
 if requested<coalesce(rule.minimum,0) or (rule.maximum is not null and requested>rule.maximum) then raise exception 'OWNER_SELECTION_QUANTITY_BOUNDS';end if;
 fingerprint:=encode(digest(concat_ws(':',selection_id,expected,requested,delivery,correlation),'sha256'),'hex');
 update public.furnishing_product_selections set quantity_override=requested,purchase_quantity=greatest(0,requested-existing_quantity),estimated_total_minor=case when estimated_unit_price_minor is null then null else estimated_unit_price_minor*greatest(0,requested-existing_quantity) end,revision=revision+1,updated_at=now() where id=selection.id;
 insert into public.furnishing_selection_delivery_allocations(workspace_id,project_id,selection_id,property_id,quantity,delivery_minor,currency,created_by) values(project.workspace_id,project.id,selection.id,property_id,greatest(0,requested-selection.existing_quantity),delivery,selection.currency,a) on conflict on constraint furnishing_selection_delivery_allo_selection_id_property_id_key do update set quantity=excluded.quantity,delivery_minor=excluded.delivery_minor,revision=furnishing_selection_delivery_allocations.revision+1,updated_at=now() returning * into allocation;
 update public.furnishing_plans set revision=revision+1,estimated_shipping_minor=(select coalesce(sum(d.delivery_minor),0) from public.furnishing_selection_delivery_allocations d where d.project_id=project.id),estimated_total_minor=(select coalesce(sum(s.estimated_total_minor),0) from public.furnishing_product_selections s where s.furnishing_plan_id=plan.id)+(select coalesce(sum(d.delivery_minor),0) from public.furnishing_selection_delivery_allocations d where d.project_id=project.id),updated_at=now() where id=plan.id;
 insert into public.furnishing_owner_plan_commands(workspace_id,project_id,plan_id,actor_id,command_type,expected_revision,resulting_revision,payload_hash,before_state,after_state,correlation_id,idempotency_key) values(project.workspace_id,project.id,plan.id,a,'selection_saved',expected,expected+1,fingerprint,jsonb_build_object('planRevision',expected,'selectionRevision',selection.revision,'selectionId',selection.id),jsonb_build_object('planRevision',expected+1,'selectionRevision',selection.revision+1,'selectionId',selection.id,'budgetDerived',true),correlation,command_key) returning * into prior;
 return prior.after_state||jsonb_build_object('status','saved');
end $$;

revoke all on function public.save_furnishing_selection_delivery(jsonb) from public,anon;
grant execute on function public.save_furnishing_selection_delivery(jsonb) to authenticated;

commit;
