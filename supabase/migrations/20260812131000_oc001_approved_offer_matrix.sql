-- OC-001 approved commercial matrix reconciliation. Prior draft rows remain non-public history.
alter table public.commercial_offer_details drop constraint commercial_offer_details_purchase_action_check;
alter table public.commercial_offer_details add constraint commercial_offer_details_purchase_action_check check(purchase_action in('buy_now','start_subscription','configure','pay_deposit','request_consultation','renew_hosting','add_to_subscription','admin_customer_request','join_waitlist','unavailable'));
alter table public.commercial_offer_details
  add column launch_state text not null default 'launch' check(launch_state in('launch','addon','renewal','deferred')),
  add column base_offer_code text,
  add column included_hosting_months integer check(included_hosting_months>0),
  add column credit_expiration_months integer check(credit_expiration_months>0),
  add column scope_approval_required boolean not null default false;
create unique index commercial_catalog_registration_audit_uidx on public.commercial_catalog_audit_events(event_code,offer_code,offer_version,reason_code) where event_code='oc001_offer_registered';

create or replace function public.read_published_offer_catalog(p_family text default null)
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
      'launchState',d.launch_state,'baseOfferCode',d.base_offer_code,'includedHostingMonths',d.included_hosting_months,'creditExpirationMonths',d.credit_expiration_months,'scopeApprovalRequired',d.scope_approval_required,
      'prices',coalesce(pr.prices,'[]'::jsonb),
      'purchaseAction',case when coalesce(mp.mapping_count,0)=coalesce(pr.price_count,0) and coalesce(pr.price_count,0)>0 then d.purchase_action else 'unavailable' end,
      'checkoutAvailable',(coalesce(mp.mapping_count,0)=coalesce(pr.price_count,0) and coalesce(pr.price_count,0)>0),
      'catalogFingerprint',p.definition_fingerprint
    ) result
    from public.commercial_offer_versions o
    join public.commercial_offer_details d on d.offer_id=o.id
    join public.commercial_catalog_publications p on p.offer_id=o.id and p.status='published' and p.verification_status='passed'
    left join lateral (select jsonb_agg(jsonb_build_object('code',v.code,'version',v.version,'currency',v.currency,'amountMinor',v.amount_minor,'model',v.price_model,'cadence',v.billing_cadence,'intervalCount',v.interval_count,'taxBehavior',v.tax_behavior) order by v.amount_minor) prices,count(*) price_count from public.commercial_price_versions v where v.offer_id=o.id and v.status='active' and v.effective_from<=now() and (v.effective_through is null or v.effective_through>now())) pr on true
    left join lateral (select count(*) mapping_count from public.billing_price_mappings m join public.commercial_price_versions v on v.code=m.price_code and v.version=m.price_version where v.offer_id=o.id and m.status='active' and m.account_mode='live' and m.effective_from<=now() and (m.effective_until is null or m.effective_until>now()) and m.amount_minor=v.amount_minor and m.currency=v.currency and coalesce(m.billing_interval,'')=coalesce(v.billing_cadence,'')) mp on true
    left join lateral (select jsonb_agg(jsonb_build_object('code',x.limit_code,'kind',x.allowance_kind,'value',x.allowance_value,'period',x.period,'enforcement',x.enforcement)) limits from public.commercial_offer_limits x where x.offer_id=o.id) l on true
    where o.status='active' and d.launch_state<>'deferred' and o.effective_from<=now() and (o.effective_until is null or o.effective_until>now()) and (p_family is null or o.product_family=case when p_family='guidebook' then 'guidebook_studio' else p_family end)
  ) catalog;
$$;

create table public.commercial_configuration_approvals(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,customer_account_id uuid not null,offer_code text not null,offer_version integer not null,
 configuration jsonb not null check(jsonb_typeof(configuration)='object'),configuration_checksum text not null check(length(configuration_checksum)=64),amount_minor bigint not null check(amount_minor>=0),currency text not null check(currency~'^[A-Z]{3}$'),
 status text not null check(status in('pending_review','approved','changes_requested','consumed','expired','cancelled')),approved_by uuid references public.profiles(id),approved_at timestamptz,expires_at timestamptz,
 consultation_credit_id uuid,idempotency_key_hash text not null unique,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),revision integer not null default 1,
 foreign key(customer_account_id,tenant_id)references public.customer_accounts(id,tenant_id),foreign key(offer_code,offer_version)references public.commercial_offer_versions(code,version)
);
create index commercial_configuration_review_idx on public.commercial_configuration_approvals(status,created_at);

create table public.commercial_upgrade_credits(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,customer_account_id uuid not null,source_agreement_id uuid not null references public.commercial_agreements(id),source_offer_code text not null,target_offer_code text not null,
 property_context_id uuid not null,amount_minor bigint not null check(amount_minor>0),currency text not null check(currency~'^[A-Z]{3}$'),status text not null check(status in('available','reserved','consumed','expired','cancelled')),
 available_until timestamptz not null,reserved_for_approval_id uuid references public.commercial_configuration_approvals(id),consumed_at timestamptz,created_at timestamptz not null default now(),revision integer not null default 1,
 foreign key(customer_account_id,tenant_id)references public.customer_accounts(id,tenant_id),unique(source_agreement_id,target_offer_code)
);
alter table public.commercial_configuration_approvals add constraint commercial_configuration_consultation_credit_fk foreign key(consultation_credit_id) references public.commercial_upgrade_credits(id);

create table public.guidebook_hosting_terms(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,customer_account_id uuid not null,guidebook_id uuid not null,source_agreement_id uuid not null references public.commercial_agreements(id),
 starts_at timestamptz not null,ends_at timestamptz not null,status text not null check(status in('active','grace','expired','renewed')),renewal_agreement_id uuid references public.commercial_agreements(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),revision integer not null default 1,
 foreign key(customer_account_id,tenant_id)references public.customer_accounts(id,tenant_id),unique(guidebook_id,source_agreement_id),check(ends_at>starts_at)
);
create index guidebook_hosting_expiry_idx on public.guidebook_hosting_terms(status,ends_at);

create table public.investment_credit_ledgers(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,customer_account_id uuid not null,source_agreement_id uuid not null references public.commercial_agreements(id),granted_count integer not null check(granted_count>0),consumed_count integer not null default 0 check(consumed_count>=0 and consumed_count<=granted_count),
 expires_at timestamptz,status text not null check(status in('active','exhausted','expired','revoked')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),revision integer not null default 1,
 foreign key(customer_account_id,tenant_id)references public.customer_accounts(id,tenant_id),unique(source_agreement_id)
);

alter table public.commercial_configuration_approvals enable row level security;alter table public.commercial_upgrade_credits enable row level security;alter table public.guidebook_hosting_terms enable row level security;alter table public.investment_credit_ledgers enable row level security;
create policy "members read configuration approvals" on public.commercial_configuration_approvals for select to authenticated using(exists(select 1 from public.customer_account_memberships m where m.tenant_id=commercial_configuration_approvals.tenant_id and m.customer_account_id=commercial_configuration_approvals.customer_account_id and m.profile_id=auth.uid() and m.status='active'));
create policy "admins read commercial credits" on public.commercial_upgrade_credits for select to authenticated using(public.is_admin());
create policy "members read hosting terms" on public.guidebook_hosting_terms for select to authenticated using(exists(select 1 from public.customer_account_memberships m where m.tenant_id=guidebook_hosting_terms.tenant_id and m.customer_account_id=guidebook_hosting_terms.customer_account_id and m.profile_id=auth.uid() and m.status='active'));
create policy "members read investment credits" on public.investment_credit_ledgers for select to authenticated using(exists(select 1 from public.customer_account_memberships m where m.tenant_id=investment_credit_ledgers.tenant_id and m.customer_account_id=investment_credit_ledgers.customer_account_id and m.profile_id=auth.uid() and m.status='active'));
revoke all on public.commercial_configuration_approvals,public.commercial_upgrade_credits,public.guidebook_hosting_terms,public.investment_credit_ledgers from anon;
revoke insert,update,delete on public.commercial_configuration_approvals,public.commercial_upgrade_credits,public.guidebook_hosting_terms,public.investment_credit_ledgers from authenticated;
grant select on public.commercial_configuration_approvals,public.guidebook_hosting_terms,public.investment_credit_ledgers to authenticated;

create function public.approve_oc001_furnishing_configuration(p_actor_id uuid,p_approval_id uuid,p_expected_revision integer,p_reason_code text,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare v public.commercial_configuration_approvals;
begin
 if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor_id and role='admin') or length(trim(p_reason_code))=0 then raise exception'OC001_SCOPE_APPROVAL_NOT_AUTHORIZED';end if;
 select * into v from public.commercial_configuration_approvals where id=p_approval_id for update;if not found or v.offer_code<>'FS-DESIGN' or v.status<>'pending_review' or v.revision<>p_expected_revision then raise exception'OC001_SCOPE_APPROVAL_CONFLICT';end if;
 update public.commercial_configuration_approvals set status='approved',approved_by=p_actor_id,approved_at=now(),expires_at=now()+interval'30 days',updated_at=now(),revision=revision+1 where id=v.id;
 insert into public.commercial_catalog_audit_events(event_code,offer_code,offer_version,actor_id,reason_code,correlation_id,safe_metadata)values('oc001_furnishing_scope_approved',v.offer_code,v.offer_version,p_actor_id,p_reason_code,p_correlation_id,jsonb_build_object('approvalId',v.id,'amountMinor',v.amount_minor));
 return jsonb_build_object('approvalId',v.id,'status','approved','revision',v.revision+1);
end$$;
revoke all on function public.approve_oc001_furnishing_configuration(uuid,uuid,integer,text,text)from public,anon,authenticated;grant execute on function public.approve_oc001_furnishing_configuration(uuid,uuid,integer,text,text)to service_role;

update public.commercial_offer_versions set status='retired',effective_until=now() where status='draft' and code in('hpm.starter','hpm.professional','hpm.portfolio','hpm.enterprise','guidebook.diy','guidebook.done_for_you','guidebook.premium','furnishing.essential','furnishing.elevated','furnishing.luxury','investment.essentials','investment.pro','investment.premier');
