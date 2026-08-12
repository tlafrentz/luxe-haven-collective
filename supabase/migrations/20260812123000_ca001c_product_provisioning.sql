-- Narrow owning-domain provisioning commands for CA-001C. No verification-only behavior.
create table public.activation_product_contexts(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,customer_account_id uuid not null,onboarding_case_id uuid not null references public.onboarding_cases(id),product_family text not null check(product_family in('hpm','guidebook_studio','furnishing','investment_intelligence')),context_type text not null,context_id uuid not null,artifact_reference_id text not null,created_by uuid not null references public.profiles(id),created_at timestamptz not null default now(),unique(onboarding_case_id,product_family),foreign key(customer_account_id,tenant_id)references public.customer_accounts(id,tenant_id));
alter table public.activation_product_contexts enable row level security;create policy "members read activation product contexts"on public.activation_product_contexts for select to authenticated using(exists(select 1 from public.customer_account_memberships where profile_id=auth.uid()and tenant_id=activation_product_contexts.tenant_id and customer_account_id=activation_product_contexts.customer_account_id and status='active'));revoke all on public.activation_product_contexts from anon;revoke insert,update,delete on public.activation_product_contexts from authenticated;grant select on public.activation_product_contexts to authenticated;

create function public.provision_activation_product_context(p_actor_id uuid,p_tenant_id uuid,p_customer_account_id uuid,p_onboarding_case_id uuid,p_product_family text,p_idempotency_key text,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path=''as $$
declare v_case public.onboarding_cases;v_existing public.activation_product_contexts;v_property uuid;v_context uuid;v_artifact text;v_capability text;v_context_type text;v_command text:=pg_catalog.encode(extensions.digest(p_idempotency_key,'sha256'),'hex');v_guidebook record;
begin
 select*into v_case from public.onboarding_cases where id=p_onboarding_case_id and tenant_id=p_tenant_id and customer_account_id=p_customer_account_id;if not found then raise exception'PRODUCT_PROVISIONING_NOT_AUTHORIZED';end if;
 if not exists(select 1 from public.profiles where id=p_actor_id and role in('admin','administrator'))and not exists(select 1 from public.customer_account_memberships where profile_id=p_actor_id and tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and status='active')then raise exception'PRODUCT_PROVISIONING_NOT_AUTHORIZED';end if;
 select*into v_existing from public.activation_product_contexts where onboarding_case_id=p_onboarding_case_id and product_family=p_product_family;if found then return jsonb_build_object('contextType',v_existing.context_type,'contextId',v_existing.context_id,'firstValueReferenceId',v_existing.artifact_reference_id);end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer_account_id::text||':'||p_product_family,0));
 if not public.onboarding_product_limit_available(p_tenant_id,p_customer_account_id,p_product_family)then raise exception'PRODUCT_LIMIT_REACHED';end if;
 v_capability:=case p_product_family when'hpm'then'hpm.workspace.access'when'guidebook_studio'then'guidebook.create'when'furnishing'then'furnishing.project.access'when'investment_intelligence'then'investment.analysis.run'else null end;
 if v_capability is null or not exists(select 1 from public.commercial_entitlements where tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and capability_code=v_capability and status='active'and effective_from<=now()and(effective_until is null or effective_until>now()))then raise exception'ENTITLEMENT_NOT_ACTIVE';end if;
 select context_id into v_property from public.onboarding_property_references where onboarding_case_id=p_onboarding_case_id and context_type=case p_product_family when'hpm'then'hpm_property'when'guidebook_studio'then'guidebook_property'when'furnishing'then'furnishing_project_property'else'investment_subject_property'end order by created_at limit 1;
 if v_property is null then select id into v_property from public.properties where owner_id=p_tenant_id order by created_at limit 1;end if;
 if p_product_family in('hpm','guidebook_studio','furnishing')and v_property is null then raise exception'PRODUCT_CONTEXT_MISSING';end if;
 if p_product_family='hpm'then
  insert into public.property_capability_enrollments(workspace_id,property_id,capability,status,source,created_by,enabled_at)values(p_tenant_id,v_property,'hpm','enabled','purchase',p_actor_id,now())on conflict(property_id,capability)do update set status='enabled',disabled_at=null,updated_at=now(),revision=public.property_capability_enrollments.revision+1;v_context:=v_property;v_context_type:='hpm_property';v_artifact:=v_property::text;
 elsif p_product_family='guidebook_studio'then
  insert into public.property_capability_enrollments(workspace_id,property_id,capability,status,source,created_by,enabled_at)values(p_tenant_id,v_property,'guidebook','enabled','purchase',p_actor_id,now())on conflict(property_id,capability)do update set status='enabled',disabled_at=null,updated_at=now(),revision=public.property_capability_enrollments.revision+1;
  select*into v_guidebook from public.create_guidebook_with_receipt(p_tenant_id,v_property,'Guest Guide',p_actor_id,v_command,v_command);v_context:=v_property;v_context_type:='guidebook_property';v_artifact:=v_guidebook.guidebook_id::text;
 elsif p_product_family='furnishing'then
  select id into v_context from public.furnishing_projects where workspace_id=p_tenant_id and property_id=v_property and lifecycle_status not in('cancelled','archived')order by created_at limit 1;if v_context is null then insert into public.furnishing_projects(workspace_id,property_id,name,lifecycle_status,project_type,created_by,status,phase,scope,budget,selections)values(p_tenant_id,v_property,'Furnishing consultation','planning','full_property',p_actor_id,'draft','setup','[]','{}','[]')returning id into v_context;end if;v_context_type:='furnishing_project_property';v_artifact:=v_context::text;
 else
  select id into v_artifact from public.investment_opportunities where workspace_id=p_tenant_id and archived_at is null and scenario_only=false order by created_at limit 1;if v_artifact is null then raise exception'INVESTMENT_ASSUMPTIONS_REQUIRED';end if;select resource_scope_id into v_context from public.commercial_entitlements where tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and capability_code='investment.analysis.run'and status='active'order by effective_from desc limit 1;v_context_type:='investment_subject_property';
 end if;
 insert into public.activation_product_contexts(tenant_id,customer_account_id,onboarding_case_id,product_family,context_type,context_id,artifact_reference_id,created_by)values(p_tenant_id,p_customer_account_id,p_onboarding_case_id,p_product_family,v_context_type,v_context,v_artifact,p_actor_id)returning*into v_existing;
 insert into public.onboarding_property_references(tenant_id,onboarding_case_id,context_type,context_id,relationship)values(p_tenant_id,p_onboarding_case_id,v_context_type,v_context,'created')on conflict(onboarding_case_id,context_type,context_id)do nothing;
 insert into public.onboarding_audit_events(tenant_id,onboarding_case_id,event_type,actor_id,actor_type,correlation_id)values(p_tenant_id,p_onboarding_case_id,'onboarding_product_provisioning_completed',p_actor_id,'system',p_correlation_id);
 return jsonb_build_object('contextType',v_context_type,'contextId',v_context,'firstValueReferenceId',v_artifact);
end$$;
revoke all on function public.provision_activation_product_context(uuid,uuid,uuid,uuid,text,text,text)from public,anon,authenticated;

create function public.authorize_onboarding_product_provisioning(p_actor_id uuid,p_tenant_id uuid,p_customer_account_id uuid,p_onboarding_case_id uuid)
returns boolean language sql stable security definer set search_path=''as $$
 select exists(select 1 from public.onboarding_cases c where c.id=p_onboarding_case_id and c.tenant_id=p_tenant_id and c.customer_account_id=p_customer_account_id and c.status in('ready','in_progress','customer_action_required','internal_action_required','ready_for_provisioning','provisioning','ready_for_handoff'))
 and(exists(select 1 from public.profiles p where p.id=p_actor_id and p.role in('admin','administrator'))or exists(select 1 from public.customer_account_memberships m where m.profile_id=p_actor_id and m.tenant_id=p_tenant_id and m.customer_account_id=p_customer_account_id and m.status='active'))
$$;
revoke all on function public.authorize_onboarding_product_provisioning(uuid,uuid,uuid,uuid)from public,anon,authenticated;

create function public.onboarding_product_limit_available(p_tenant_id uuid,p_customer_account_id uuid,p_product_family text)
returns boolean language plpgsql stable security definer set search_path=''as $$
declare v_limit_code text;v_allowance bigint;v_unlimited boolean;v_usage bigint;
begin
 v_limit_code:=case p_product_family when'hpm'then'workspace_count'when'guidebook_studio'then'guidebook_count'when'furnishing'then'furnishing_project_count'when'investment_intelligence'then'saved_investment_count'else null end;
 if v_limit_code is null then return false;end if;
 select bool_or(l.allowance_kind='unlimited'),max(l.allowance_value)filter(where l.allowance_kind='finite')into v_unlimited,v_allowance
 from public.commercial_entitlements e join public.commercial_offer_versions o on o.code=e.offer_code and o.version=e.offer_version join public.commercial_offer_limits l on l.offer_id=o.id and l.limit_code=v_limit_code
 where e.tenant_id=p_tenant_id and e.customer_account_id=p_customer_account_id and e.status='active'and e.effective_from<=now()and(e.effective_until is null or e.effective_until>now());
 if coalesce(v_unlimited,false)then return true;end if;if v_allowance is null then return false;end if;
 select count(*)into v_usage from public.activation_product_contexts where tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and product_family=p_product_family;
 return v_usage<v_allowance;
end$$;
revoke all on function public.onboarding_product_limit_available(uuid,uuid,text)from public,anon,authenticated;

create function public.record_onboarding_product_reference(p_onboarding_case_id uuid,p_tenant_id uuid,p_product_family text,p_context_type text,p_context_id uuid,p_relationship text,p_correlation_id text)
returns void language plpgsql security definer set search_path=''as $$
begin
 if not exists(select 1 from public.activation_product_contexts c where c.onboarding_case_id=p_onboarding_case_id and c.tenant_id=p_tenant_id and c.product_family=p_product_family and c.context_type=p_context_type and c.context_id=p_context_id)then raise exception'PRODUCT_CONTEXT_REFERENCE_INVALID';end if;
 insert into public.onboarding_property_references(tenant_id,onboarding_case_id,context_type,context_id,relationship)values(p_tenant_id,p_onboarding_case_id,p_context_type,p_context_id,p_relationship)on conflict(onboarding_case_id,context_type,context_id)do nothing;
end$$;
revoke all on function public.record_onboarding_product_reference(uuid,uuid,text,text,uuid,text,text)from public,anon,authenticated;
