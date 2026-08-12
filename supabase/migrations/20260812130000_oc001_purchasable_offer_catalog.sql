-- OC-001 canonical purchasable offer catalog. CA-001 commercial and activation records remain authoritative.
alter table public.commercial_offer_versions drop constraint commercial_offer_versions_status_check;
alter table public.commercial_offer_versions add constraint commercial_offer_versions_status_check check(status in('draft','approved','active','inactive','retired'));
create or replace function public.prevent_active_offer_mutation() returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='active' then
    if tg_op='UPDATE' and new.status='retired' and (to_jsonb(new)-'status'-'effective_until')=(to_jsonb(old)-'status'-'effective_until') then return new; end if;
    raise exception 'Active offer versions are immutable';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create table public.commercial_offer_details (
  offer_id uuid primary key references public.commercial_offer_versions(id),
  offer_type text not null check (offer_type in ('subscription','one_time','service','deposit','consultation')),
  full_description text not null,
  audience jsonb not null check (jsonb_typeof(audience)='array'),
  deliverables jsonb not null check (jsonb_typeof(deliverables)='array'),
  exclusions jsonb not null check (jsonb_typeof(exclusions)='array'),
  eligibility_rules jsonb not null check (jsonb_typeof(eligibility_rules)='array'),
  configuration_fields jsonb not null check (jsonb_typeof(configuration_fields)='array'),
  onboarding_template_code text not null,
  destination_code text not null,
  commercial_policy_version text not null,
  cancellation_policy_code text,
  refund_policy_code text,
  renewal_policy_code text,
  terms_version text not null,
  support_level text not null,
  expected_timeline text not null,
  purchase_action text not null check (purchase_action in ('buy_now','start_subscription','configure','pay_deposit','request_consultation','join_waitlist','unavailable')),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id)
);

create table public.commercial_price_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null check (version > 0),
  offer_id uuid not null references public.commercial_offer_versions(id),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor > 0),
  price_model text not null check (price_model in ('one_time','recurring','consultation')),
  billing_cadence text check (billing_cadence in ('month','year')),
  interval_count integer check (interval_count > 0),
  tax_behavior text not null check (tax_behavior in ('exclusive','inclusive','unspecified')),
  status text not null check (status in ('active','retired')),
  effective_from timestamptz not null,
  effective_through timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  unique(code,version),
  check (effective_through is null or effective_through > effective_from),
  check ((price_model='recurring' and billing_cadence is not null and interval_count is not null) or price_model<>'recurring')
);

alter table public.billing_price_mappings
  add column price_code text,
  add column price_version integer;
alter table public.billing_price_mappings
  add constraint billing_mapping_catalog_price_fk foreign key(price_code,price_version) references public.commercial_price_versions(code,version);
create unique index billing_active_catalog_price_mapping_uidx on public.billing_price_mappings(price_code,price_version,account_mode) where status='active' and price_code is not null;

create table public.commercial_catalog_publications (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.commercial_offer_versions(id),
  publication_version integer not null check(publication_version>0),
  status text not null check(status in ('scheduled','published','retired')),
  definition_fingerprint text not null check(length(definition_fingerprint)=64),
  verification_status text not null check(verification_status in ('pending','passed','failed','blocked')),
  verification_reference text,
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  unique(offer_id,publication_version)
);
create unique index commercial_catalog_one_published_offer_uidx on public.commercial_catalog_publications(offer_id) where status='published';

create table public.commercial_offer_verification_results (
  id text primary key,
  offer_id uuid not null references public.commercial_offer_versions(id),
  status text not null check(status in ('passed','failed','blocked')),
  verified_commit_sha text not null check(length(verified_commit_sha)=40),
  deployment_id text not null,
  evidence_fingerprint text not null check(length(evidence_fingerprint)=64),
  verified_at timestamptz not null,
  verified_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.commercial_catalog_publications add constraint commercial_catalog_publication_verification_fk foreign key(verification_reference) references public.commercial_offer_verification_results(id);

create table public.commercial_offer_replacements (
  retired_offer_id uuid primary key references public.commercial_offer_versions(id),
  replacement_offer_id uuid not null references public.commercial_offer_versions(id),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  check(retired_offer_id<>replacement_offer_id)
);

create table public.commercial_purchase_intents (
  id uuid primary key,
  tenant_id uuid not null,
  customer_account_id uuid not null,
  offer_code text not null,
  offer_version integer not null,
  price_code text not null,
  price_version integer not null,
  billing_price_mapping_id uuid not null references public.billing_price_mappings(id),
  configuration_snapshot jsonb not null check(jsonb_typeof(configuration_snapshot)='object'),
  commercial_snapshot_checksum text not null check(length(commercial_snapshot_checksum)=64),
  policy_snapshot jsonb not null check(jsonb_typeof(policy_snapshot)='object'),
  entitlement_snapshot jsonb not null check(jsonb_typeof(entitlement_snapshot)='array'),
  status text not null check(status in ('created','checkout_pending','processing','paid','active','failed','expired','refunded','cancelled')),
  idempotency_key_hash text not null unique,
  checkout_attempt_id uuid references public.billing_checkout_attempts(id),
  correlation_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision integer not null default 1,
  foreign key(customer_account_id,tenant_id) references public.customer_accounts(id,tenant_id),
  foreign key(offer_code,offer_version) references public.commercial_offer_versions(code,version),
  foreign key(price_code,price_version) references public.commercial_price_versions(code,version)
);
create index commercial_purchase_intents_account_idx on public.commercial_purchase_intents(tenant_id,customer_account_id,status,created_at desc);

create table public.commercial_catalog_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  offer_code text,
  offer_version integer,
  price_code text,
  price_version integer,
  actor_id uuid not null references public.profiles(id),
  reason_code text not null,
  correlation_id text not null,
  safe_metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(safe_metadata)='object'),
  occurred_at timestamptz not null default now()
);
create index commercial_catalog_audit_offer_idx on public.commercial_catalog_audit_events(offer_code,offer_version,occurred_at desc);

create function public.prevent_published_commercial_definition_mutation() returns trigger language plpgsql set search_path='' as $$
declare offer_status text; target_offer_id uuid;
begin
  if tg_op='DELETE' then target_offer_id:=old.offer_id; else target_offer_id:=new.offer_id; end if;
  select status into offer_status from public.commercial_offer_versions where id=target_offer_id;
  if offer_status='draft' then if tg_op='DELETE' then return old; else return new; end if; end if;
  raise exception 'Published commercial definitions are immutable';
end $$;
create trigger commercial_offer_details_immutable before update or delete on public.commercial_offer_details for each row execute function public.prevent_published_commercial_definition_mutation();
create trigger commercial_price_versions_immutable before update or delete on public.commercial_price_versions for each row execute function public.prevent_published_commercial_definition_mutation();

alter table public.commercial_offer_details enable row level security;
alter table public.commercial_price_versions enable row level security;
alter table public.commercial_catalog_publications enable row level security;
alter table public.commercial_offer_verification_results enable row level security;
alter table public.commercial_offer_replacements enable row level security;
alter table public.commercial_purchase_intents enable row level security;
alter table public.commercial_catalog_audit_events enable row level security;
create policy "catalog viewers read offer details" on public.commercial_offer_details for select to authenticated using(public.is_admin());
create policy "catalog viewers read price versions" on public.commercial_price_versions for select to authenticated using(public.is_admin());
create policy "catalog viewers read publications" on public.commercial_catalog_publications for select to authenticated using(public.is_admin());
create policy "catalog viewers read verification results" on public.commercial_offer_verification_results for select to authenticated using(public.is_admin());
create policy "catalog viewers read replacements" on public.commercial_offer_replacements for select to authenticated using(public.is_admin());
create policy "members read purchase intents" on public.commercial_purchase_intents for select to authenticated using(exists(select 1 from public.customer_account_memberships m where m.customer_account_id=commercial_purchase_intents.customer_account_id and m.tenant_id=commercial_purchase_intents.tenant_id and m.profile_id=auth.uid() and m.status='active'));
create policy "catalog viewers read catalog audit" on public.commercial_catalog_audit_events for select to authenticated using(public.is_admin());
revoke all on public.commercial_offer_details,public.commercial_price_versions,public.commercial_catalog_publications,public.commercial_offer_verification_results,public.commercial_offer_replacements,public.commercial_purchase_intents,public.commercial_catalog_audit_events from anon;
revoke insert,update,delete on public.commercial_offer_details,public.commercial_price_versions,public.commercial_catalog_publications,public.commercial_offer_verification_results,public.commercial_offer_replacements,public.commercial_purchase_intents,public.commercial_catalog_audit_events from authenticated;
grant select on public.commercial_purchase_intents to authenticated;

create function public.read_published_offer_catalog(p_family text default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(result order by result->>'family',result->>'customerName'),'[]'::jsonb)
  from (
    select jsonb_build_object(
      'offerCode',o.code,'version',o.version,
      'family',case when o.product_family='guidebook_studio' then 'guidebook' else o.product_family end,
      'customerName',o.name,'shortDescription',o.short_description,'fullDescription',d.full_description,
      'audience',d.audience,'deliverables',d.deliverables,'exclusions',d.exclusions,'limits',coalesce(l.limits,'[]'::jsonb),
      'requiredInputs',d.configuration_fields,'supportLevel',d.support_level,'expectedTimeline',d.expected_timeline,
      'termsVersion',d.terms_version,'cancellationPolicyCode',d.cancellation_policy_code,'refundPolicyCode',d.refund_policy_code,'renewalPolicyCode',d.renewal_policy_code,
      'prices',coalesce(pr.prices,'[]'::jsonb),
      'purchaseAction',case when d.purchase_action='request_consultation' then d.purchase_action when coalesce(mp.mapping_count,0)=coalesce(pr.price_count,0) and coalesce(pr.price_count,0)>0 then d.purchase_action else 'unavailable' end,
      'checkoutAvailable',(coalesce(mp.mapping_count,0)=coalesce(pr.price_count,0) and coalesce(pr.price_count,0)>0),
      'catalogFingerprint',p.definition_fingerprint
    ) result
    from public.commercial_offer_versions o
    join public.commercial_offer_details d on d.offer_id=o.id
    join public.commercial_catalog_publications p on p.offer_id=o.id and p.status='published' and p.verification_status='passed'
    left join lateral (select jsonb_agg(jsonb_build_object('code',v.code,'version',v.version,'currency',v.currency,'amountMinor',v.amount_minor,'model',v.price_model,'cadence',v.billing_cadence,'intervalCount',v.interval_count,'taxBehavior',v.tax_behavior) order by v.amount_minor) prices,count(*) price_count from public.commercial_price_versions v where v.offer_id=o.id and v.status='active' and v.effective_from<=now() and (v.effective_through is null or v.effective_through>now())) pr on true
    left join lateral (select count(*) mapping_count from public.billing_price_mappings m join public.commercial_price_versions v on v.code=m.price_code and v.version=m.price_version where v.offer_id=o.id and m.status='active' and m.account_mode='live' and m.effective_from<=now() and (m.effective_until is null or m.effective_until>now()) and m.amount_minor=v.amount_minor and m.currency=v.currency and coalesce(m.billing_interval,'')=coalesce(v.billing_cadence,'')) mp on true
    left join lateral (select jsonb_agg(jsonb_build_object('code',x.limit_code,'kind',x.allowance_kind,'value',x.allowance_value,'period',x.period,'enforcement',x.enforcement)) limits from public.commercial_offer_limits x where x.offer_id=o.id) l on true
    where o.status='active' and o.effective_from<=now() and (o.effective_until is null or o.effective_until>now()) and (p_family is null or o.product_family=case when p_family='guidebook' then 'guidebook_studio' else p_family end)
  ) catalog;
$$;
revoke all on function public.read_published_offer_catalog(text) from public;
grant execute on function public.read_published_offer_catalog(text) to anon,authenticated;

create function public.create_oc001_purchase_intent(
  p_actor_id uuid,p_tenant_id uuid,p_customer_account_id uuid,p_offer_code text,p_offer_version integer,p_price_code text,p_price_version integer,
  p_configuration jsonb,p_checksum text,p_policy_snapshot jsonb,p_entitlement_snapshot jsonb,p_idempotency_hash text,p_correlation_id text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.commercial_purchase_intents; mapping public.billing_price_mappings; created public.commercial_purchase_intents;
begin
  if p_actor_id<>auth.uid() and auth.role()<>'service_role' then raise exception 'OC001_NOT_AUTHORIZED'; end if;
  if not exists(select 1 from public.customer_account_memberships m where m.profile_id=p_actor_id and m.tenant_id=p_tenant_id and m.customer_account_id=p_customer_account_id and m.status='active') then raise exception 'OC001_NOT_AUTHORIZED'; end if;
  select * into existing from public.commercial_purchase_intents where idempotency_key_hash=p_idempotency_hash;
  if found then
    if existing.tenant_id<>p_tenant_id or existing.customer_account_id<>p_customer_account_id or existing.offer_code<>p_offer_code or existing.offer_version<>p_offer_version or existing.price_code<>p_price_code or existing.price_version<>p_price_version or existing.commercial_snapshot_checksum<>p_checksum then raise exception 'OC001_IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('id',existing.id,'status',existing.status,'checkoutAttemptId',existing.checkout_attempt_id,'mappingId',existing.billing_price_mapping_id);
  end if;
  select m.* into mapping from public.billing_price_mappings m join public.commercial_price_versions v on v.code=m.price_code and v.version=m.price_version join public.commercial_offer_versions o on o.id=v.offer_id join public.commercial_catalog_publications pub on pub.offer_id=o.id and pub.status='published' and pub.verification_status='passed' where o.code=p_offer_code and o.version=p_offer_version and o.status='active' and v.code=p_price_code and v.version=p_price_version and v.status='active' and m.status='active' and m.account_mode='live' and m.currency=v.currency and m.amount_minor=v.amount_minor and coalesce(m.billing_interval,'')=coalesce(v.billing_cadence,'') and now()>=m.effective_from and (m.effective_until is null or now()<m.effective_until);
  if not found then raise exception 'OC001_PRICE_MAPPING_UNAVAILABLE'; end if;
  insert into public.commercial_purchase_intents(id,tenant_id,customer_account_id,offer_code,offer_version,price_code,price_version,billing_price_mapping_id,configuration_snapshot,commercial_snapshot_checksum,policy_snapshot,entitlement_snapshot,status,idempotency_key_hash,correlation_id)
  values(gen_random_uuid(),p_tenant_id,p_customer_account_id,p_offer_code,p_offer_version,p_price_code,p_price_version,mapping.id,p_configuration,p_checksum,p_policy_snapshot,p_entitlement_snapshot,'created',p_idempotency_hash,p_correlation_id) returning * into created;
  return jsonb_build_object('id',created.id,'status',created.status,'mappingId',mapping.id,'stripePriceReference',mapping.stripe_price_reference,'stripeProductReference',mapping.stripe_product_reference,'billingModel',mapping.billing_model);
end $$;
revoke all on function public.create_oc001_purchase_intent(uuid,uuid,uuid,text,integer,text,integer,jsonb,text,jsonb,jsonb,text,text) from public;
grant execute on function public.create_oc001_purchase_intent(uuid,uuid,uuid,text,integer,text,integer,jsonb,text,jsonb,jsonb,text,text) to authenticated;

create function public.attach_oc001_checkout(p_actor_id uuid,p_purchase_intent_id uuid,p_attempt_id uuid,p_session_reference text,p_customer_reference text,p_expires_at timestamptz,p_idempotency_hash text,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare intent public.commercial_purchase_intents; mapping public.billing_price_mappings;
begin
  select i.* into intent from public.commercial_purchase_intents i join public.customer_account_memberships m on m.customer_account_id=i.customer_account_id and m.tenant_id=i.tenant_id where i.id=p_purchase_intent_id and m.profile_id=p_actor_id and m.status='active' for update;
  if not found then raise exception 'OC001_NOT_AUTHORIZED'; end if;
  if intent.checkout_attempt_id is not null then return jsonb_build_object('purchaseIntentId',intent.id,'checkoutAttemptId',intent.checkout_attempt_id,'status',intent.status); end if;
  select * into mapping from public.billing_price_mappings where id=intent.billing_price_mapping_id;
  insert into public.billing_checkout_attempts(id,tenant_id,customer_account_id,offer_code,offer_version,billing_price_mapping_id,mode,status,stripe_customer_reference,stripe_checkout_session_reference,idempotency_key_hash,correlation_id,created_at,expires_at,revision)
  values(p_attempt_id,intent.tenant_id,intent.customer_account_id,intent.offer_code,intent.offer_version,intent.billing_price_mapping_id,case when mapping.billing_model='recurring' then 'subscription' else 'payment' end,'session_created',p_customer_reference,p_session_reference,p_idempotency_hash,p_correlation_id,now(),p_expires_at,1);
  update public.commercial_purchase_intents set checkout_attempt_id=p_attempt_id,status='checkout_pending',updated_at=now(),revision=revision+1 where id=intent.id;
  return jsonb_build_object('purchaseIntentId',intent.id,'checkoutAttemptId',p_attempt_id,'status','checkout_pending');
end $$;
revoke all on function public.attach_oc001_checkout(uuid,uuid,uuid,text,text,timestamptz,text,text) from public;
grant execute on function public.attach_oc001_checkout(uuid,uuid,uuid,text,text,timestamptz,text,text) to authenticated;

create function public.activate_oc001_agreement_entitlements(p_agreement_id uuid,p_idempotency_key text)
returns integer language plpgsql security definer set search_path='' as $$
declare agreement public.commercial_agreements; offer_id uuid; inserted_count integer;
begin
  select * into agreement from public.commercial_agreements where id=p_agreement_id and status='active';
  if not found then raise exception 'OC001_AGREEMENT_NOT_ACTIVE'; end if;
  select id into offer_id from public.commercial_offer_versions where code=agreement.offer_code and version=agreement.offer_version;
  insert into public.commercial_entitlements(tenant_id,customer_account_id,capability_code,resource_scope_type,resource_scope_id,source,source_reference_id,offer_code,offer_version,status,effective_from,effective_until,revision)
  select agreement.tenant_id,agreement.customer_account_id,c.capability_code,'customer_account',agreement.customer_account_id,case agreement.agreement_type when 'subscription' then 'subscription' when 'service_engagement' then 'service_engagement' else 'offer_activation' end,agreement.id::text,agreement.offer_code,agreement.offer_version,'active',coalesce(agreement.activated_at,now()),agreement.current_period_end,1
  from public.commercial_offer_capabilities c where c.offer_id=offer_id
  on conflict(tenant_id,customer_account_id,capability_code,resource_scope_type,resource_scope_id,source,source_reference_id) do nothing;
  get diagnostics inserted_count=row_count;
  update public.commercial_purchase_intents set status='active',updated_at=now(),revision=revision+1 where checkout_attempt_id=agreement.checkout_attempt_id and status<>'active';
  insert into public.commercial_catalog_audit_events(event_code,offer_code,offer_version,actor_id,reason_code,correlation_id,safe_metadata)
  select 'oc001_entitlements_activated',agreement.offer_code,agreement.offer_version,m.profile_id,'verified_payment',encode(extensions.digest(p_idempotency_key,'sha256'),'hex'),jsonb_build_object('agreementId',agreement.id,'grantCount',inserted_count) from public.customer_account_memberships m where m.customer_account_id=agreement.customer_account_id and m.tenant_id=agreement.tenant_id and m.status='active' order by m.created_at limit 1;
  return inserted_count;
end $$;
revoke all on function public.activate_oc001_agreement_entitlements(uuid,text) from public,anon,authenticated;
grant execute on function public.activate_oc001_agreement_entitlements(uuid,text) to service_role;

create function public.transition_oc001_agreement_entitlements(p_agreement_id uuid,p_action text,p_effective_at timestamptz,p_idempotency_key text)
returns integer language plpgsql security definer set search_path='' as $$
declare target_status text; changed_count integer; actor uuid;
begin
  if auth.role()<>'service_role' then raise exception 'OC001_NOT_AUTHORIZED'; end if;
  target_status:=case p_action when 'suspend' then 'suspended' when 'restore' then 'active' when 'expire' then 'expired' else null end;
  if target_status is null then raise exception 'OC001_ENTITLEMENT_TRANSITION_INVALID'; end if;
  select m.profile_id into actor from public.commercial_agreements a join public.customer_account_memberships m on m.tenant_id=a.tenant_id and m.customer_account_id=a.customer_account_id and m.status='active' where a.id=p_agreement_id order by m.created_at limit 1;
  if actor is null then raise exception 'OC001_ENTITLEMENT_ACTOR_UNAVAILABLE'; end if;
  insert into public.commercial_entitlement_status_history(tenant_id,entitlement_id,from_status,to_status,actor_id,reason_code,source_reference_id,idempotency_key,occurred_at)
  select e.tenant_id,e.id,e.status,target_status,actor,'verified_commercial_state',p_agreement_id::text,encode(extensions.digest(p_idempotency_key||':'||e.id::text,'sha256'),'hex'),p_effective_at
  from public.commercial_entitlements e where e.source_reference_id=p_agreement_id::text and e.status<>target_status
  on conflict(idempotency_key) do nothing;
  update public.commercial_entitlements e set status=target_status,effective_until=case when target_status='expired' then p_effective_at when target_status='active' then null else e.effective_until end,updated_at=p_effective_at,revision=e.revision+1
  where e.source_reference_id=p_agreement_id::text and e.status<>target_status;
  get diagnostics changed_count=row_count;
  return changed_count;
end $$;
revoke all on function public.transition_oc001_agreement_entitlements(uuid,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.transition_oc001_agreement_entitlements(uuid,text,timestamptz,text) to service_role;
