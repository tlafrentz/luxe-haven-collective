create or replace function public.activate_oc001_agreement_entitlements(
  p_agreement_id uuid,
  p_idempotency_key text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  agreement public.commercial_agreements;
  resolved_offer_id uuid;
  inserted_count integer;
begin
  select *
    into agreement
    from public.commercial_agreements
   where id = p_agreement_id
     and status = 'active';

  if not found then
    raise exception 'OC001_AGREEMENT_NOT_ACTIVE';
  end if;

  select versioned_offer.id
    into resolved_offer_id
    from public.commercial_offer_versions as versioned_offer
   where versioned_offer.code = agreement.offer_code
     and versioned_offer.version = agreement.offer_version;

  if resolved_offer_id is null then
    raise exception 'OC001_OFFER_VERSION_UNAVAILABLE';
  end if;

  insert into public.commercial_entitlements(
    tenant_id,
    customer_account_id,
    capability_code,
    resource_scope_type,
    resource_scope_id,
    source,
    source_reference_id,
    offer_code,
    offer_version,
    status,
    effective_from,
    effective_until,
    revision
  )
  select
    agreement.tenant_id,
    agreement.customer_account_id,
    capability.capability_code,
    'customer_account',
    agreement.customer_account_id,
    case agreement.agreement_type
      when 'subscription' then 'subscription'
      when 'service_engagement' then 'service_engagement'
      else 'offer_activation'
    end,
    agreement.id::text,
    agreement.offer_code,
    agreement.offer_version,
    'active',
    coalesce(agreement.activated_at, now()),
    agreement.current_period_end,
    1
  from public.commercial_offer_capabilities as capability
  where capability.offer_id = resolved_offer_id
  on conflict(
    tenant_id,
    customer_account_id,
    capability_code,
    resource_scope_type,
    resource_scope_id,
    source,
    source_reference_id
  ) do nothing;

  get diagnostics inserted_count = row_count;

  update public.commercial_purchase_intents
     set status = 'active',
         updated_at = now(),
         revision = revision + 1
   where checkout_attempt_id = agreement.checkout_attempt_id
     and status <> 'active';

  insert into public.commercial_catalog_audit_events(
    event_code,
    offer_code,
    offer_version,
    actor_id,
    reason_code,
    correlation_id,
    safe_metadata
  )
  select
    'oc001_entitlements_activated',
    agreement.offer_code,
    agreement.offer_version,
    membership.profile_id,
    'verified_payment',
    encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex'),
    jsonb_build_object('agreementId', agreement.id, 'grantCount', inserted_count)
  from public.customer_account_memberships as membership
  where membership.customer_account_id = agreement.customer_account_id
    and membership.tenant_id = agreement.tenant_id
    and membership.status = 'active'
  order by membership.created_at
  limit 1;

  return inserted_count;
end;
$$;

revoke all on function public.activate_oc001_agreement_entitlements(uuid, text)
  from public, anon, authenticated;
grant execute on function public.activate_oc001_agreement_entitlements(uuid, text)
  to service_role;
