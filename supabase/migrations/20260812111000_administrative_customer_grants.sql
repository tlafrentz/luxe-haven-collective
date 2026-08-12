-- Actor-authorized, expiring administrative customer grants through the commerce boundary.
alter table public.commercial_entitlements add column administrative_subject_id uuid references public.profiles(id);
create index commercial_entitlements_administrative_subject_idx on public.commercial_entitlements(administrative_subject_id,source_reference_id)where source='administrative_grant';

create function public.provision_administrative_customer_grant(p_actor_id uuid,p_subject_id uuid,p_product_families text[],p_capability_codes text[],p_grant_code text,p_effective_until timestamptz,p_reason_code text,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_role text;v_subject_exists boolean;v_tenant uuid;v_account uuid;v_entitlement_ids uuid[];v_now timestamptz:=now();
begin
 select role into v_role from public.profiles where id=p_actor_id;if coalesce(v_role,'')not in('admin','administrator')then raise exception'ADMINISTRATIVE_GRANT_NOT_AUTHORIZED';end if;
 select exists(select 1 from public.profiles where id=p_subject_id)into v_subject_exists;if not v_subject_exists or p_effective_until<=v_now or cardinality(p_capability_codes)=0 then raise exception'ADMINISTRATIVE_GRANT_INVALID';end if;
 select tenant_id,customer_account_id,array_agg(id)into v_tenant,v_account,v_entitlement_ids from public.commercial_entitlements where source='administrative_grant'and source_reference_id=p_grant_code and administrative_subject_id=p_subject_id group by tenant_id,customer_account_id;
 if found then return jsonb_build_object('tenant_id',v_tenant,'customer_account_id',v_account,'entitlement_ids',v_entitlement_ids);end if;
 insert into public.owners(profile_id,company_name,display_name,legal_name,business_email,timezone,currency,language,country)values(p_subject_id,'Controlled Verification Account','Controlled Verification Account','Controlled Verification Account',concat('controlled-',p_subject_id,'@verification.invalid'),'America/Chicago','USD','en-US','US')returning id into v_tenant;
 insert into public.customer_accounts(tenant_id,account_type,status)values(v_tenant,'organization','active')returning id into v_account;
 insert into public.customer_account_memberships(tenant_id,customer_account_id,profile_id,status)values(v_tenant,v_account,p_subject_id,'active');
 insert into public.commercial_entitlements(tenant_id,customer_account_id,capability_code,resource_scope_type,resource_scope_id,source,source_reference_id,status,effective_from,effective_until,administrative_subject_id)
 select v_tenant,v_account,code,'customer_account',v_account,'administrative_grant',p_grant_code,'active',v_now,p_effective_until,p_subject_id from unnest(p_capability_codes)code;
 insert into public.commercial_entitlement_status_history(tenant_id,entitlement_id,from_status,to_status,actor_id,reason_code,source_reference_id,idempotency_key,occurred_at)
 select v_tenant,id,null,'active',p_actor_id,p_reason_code,p_grant_code,concat(p_correlation_id,':',id),v_now from public.commercial_entitlements where source_reference_id=p_grant_code and administrative_subject_id=p_subject_id;
 select array_agg(id)into v_entitlement_ids from public.commercial_entitlements where source_reference_id=p_grant_code and administrative_subject_id=p_subject_id;
 return jsonb_build_object('tenant_id',v_tenant,'customer_account_id',v_account,'entitlement_ids',v_entitlement_ids);
end$$;
revoke all on function public.provision_administrative_customer_grant(uuid,uuid,text[],text[],text,timestamptz,text,text)from public,anon,authenticated;
