-- Bounded pre-publication purchase entry for approved controlled production identities.
-- Payment truth, activation, entitlement issuance, and onboarding continue through CA-001A-D.
create function public.create_oc001_controlled_purchase_intent(
  p_executor_id uuid,p_customer_actor_id uuid,p_tenant_id uuid,p_customer_account_id uuid,p_identity_type_code text,
  p_offer_code text,p_offer_version integer,p_price_code text,p_price_version integer,p_configuration jsonb,p_checksum text,
  p_policy_snapshot jsonb,p_entitlement_snapshot jsonb,p_idempotency_hash text,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.commercial_purchase_intents;mapping public.billing_price_mappings;created public.commercial_purchase_intents;
begin
 if auth.role()<>'service_role' then raise exception'OC001_CONTROLLED_EXECUTION_NOT_AUTHORIZED';end if;
 if not exists(select 1 from public.controlled_verification_identities i where i.opaque_auth_subject_reference=p_executor_id::text and i.identity_type_code='release_verifier' and i.status='active' and(i.expires_at is null or i.expires_at>now()))then raise exception'OC001_CONTROLLED_EXECUTOR_INVALID';end if;
 if p_identity_type_code not in('hpm_customer','guidebook_customer','furnishing_customer','investment_customer','bundle_customer')then raise exception'OC001_CONTROLLED_TARGET_INVALID';end if;
 if not exists(select 1 from public.controlled_verification_identities i where i.opaque_auth_subject_reference=p_customer_actor_id::text and i.identity_type_code=p_identity_type_code and i.tenant_id=p_tenant_id and i.customer_account_id=p_customer_account_id and i.status='active' and(i.expires_at is null or i.expires_at>now()))then raise exception'OC001_CONTROLLED_TARGET_INVALID';end if;
 if not exists(select 1 from public.customer_account_memberships m where m.profile_id=p_customer_actor_id and m.tenant_id=p_tenant_id and m.customer_account_id=p_customer_account_id and m.status='active')then raise exception'OC001_CONTROLLED_MEMBERSHIP_INVALID';end if;
 if not((p_identity_type_code='hpm_customer'and p_offer_code like'HPM-%')or(p_identity_type_code='guidebook_customer'and p_offer_code like'GB-%')or(p_identity_type_code='furnishing_customer'and p_offer_code like'FS-%')or(p_identity_type_code='investment_customer'and p_offer_code like'II-%'))then raise exception'OC001_CONTROLLED_PRODUCT_SCOPE_INVALID';end if;
 select*into existing from public.commercial_purchase_intents where idempotency_key_hash=p_idempotency_hash;
 if found then
  if existing.tenant_id<>p_tenant_id or existing.customer_account_id<>p_customer_account_id or existing.offer_code<>p_offer_code or existing.offer_version<>p_offer_version or existing.price_code<>p_price_code or existing.price_version<>p_price_version or existing.commercial_snapshot_checksum<>p_checksum then raise exception'OC001_IDEMPOTENCY_CONFLICT';end if;
  return jsonb_build_object('id',existing.id,'status',existing.status,'checkoutAttemptId',existing.checkout_attempt_id,'mappingId',existing.billing_price_mapping_id);
 end if;
 select m.*into mapping from public.billing_price_mappings m join public.commercial_price_versions v on v.code=m.price_code and v.version=m.price_version join public.commercial_offer_versions o on o.id=v.offer_id join public.commercial_offer_details d on d.offer_id=o.id
 where o.code=p_offer_code and o.version=p_offer_version and o.status='draft'and d.launch_state<>'deferred'and v.code=p_price_code and v.version=p_price_version and v.status='active'and m.status='active'and m.account_mode='live'and m.currency=v.currency and m.amount_minor=v.amount_minor and coalesce(m.billing_interval,'')=coalesce(v.billing_cadence,'')and now()>=m.effective_from and(m.effective_until is null or now()<m.effective_until);
 if not found then raise exception'OC001_CONTROLLED_PRICE_UNAVAILABLE';end if;
 insert into public.commercial_purchase_intents(id,tenant_id,customer_account_id,offer_code,offer_version,price_code,price_version,billing_price_mapping_id,configuration_snapshot,commercial_snapshot_checksum,policy_snapshot,entitlement_snapshot,status,idempotency_key_hash,correlation_id)
 values(gen_random_uuid(),p_tenant_id,p_customer_account_id,p_offer_code,p_offer_version,p_price_code,p_price_version,mapping.id,p_configuration,p_checksum,p_policy_snapshot,p_entitlement_snapshot,'created',p_idempotency_hash,p_correlation_id)returning*into created;
 insert into public.commercial_catalog_audit_events(event_code,offer_code,offer_version,price_code,price_version,actor_id,reason_code,correlation_id,safe_metadata)values('oc001_controlled_purchase_intent_created',p_offer_code,p_offer_version,p_price_code,p_price_version,p_executor_id,'controlled_production_verification',p_correlation_id,jsonb_build_object('identityType',p_identity_type_code));
 return jsonb_build_object('id',created.id,'status',created.status,'mappingId',mapping.id,'stripePriceReference',mapping.stripe_price_reference,'stripeProductReference',mapping.stripe_product_reference,'billingModel',mapping.billing_model);
end$$;
revoke all on function public.create_oc001_controlled_purchase_intent(uuid,uuid,uuid,uuid,text,text,integer,text,integer,jsonb,text,jsonb,jsonb,text,text)from public,anon,authenticated;
grant execute on function public.create_oc001_controlled_purchase_intent(uuid,uuid,uuid,uuid,text,text,integer,text,integer,jsonb,text,jsonb,jsonb,text,text)to service_role;
