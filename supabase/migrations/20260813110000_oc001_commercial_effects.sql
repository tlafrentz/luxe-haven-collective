-- Complete the approved OC-001 commercial effects at the authoritative agreement boundary.
-- These records describe limits and consumable commercial scope; product artifacts remain
-- owned by their product domains.

create table public.commercial_limit_grants(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null,
 customer_account_id uuid not null,
 source_agreement_id uuid not null references public.commercial_agreements(id),
 offer_code text not null,
 offer_version integer not null,
 limit_code text not null,
 allowance_value bigint not null check(allowance_value>0),
 period text,
 status text not null check(status in('active','suspended','expired','revoked')),
 effective_from timestamptz not null,
 effective_until timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision integer not null default 1,
 foreign key(customer_account_id,tenant_id) references public.customer_accounts(id,tenant_id),
 foreign key(offer_code,offer_version) references public.commercial_offer_versions(code,version),
 unique(source_agreement_id,limit_code)
);
create index commercial_limit_grants_account_idx on public.commercial_limit_grants(tenant_id,customer_account_id,limit_code,status);
alter table public.commercial_limit_grants enable row level security;
create policy "members read commercial limit grants" on public.commercial_limit_grants for select to authenticated using(exists(select 1 from public.customer_account_memberships m where m.tenant_id=commercial_limit_grants.tenant_id and m.customer_account_id=commercial_limit_grants.customer_account_id and m.profile_id=auth.uid() and m.status='active'));
revoke all on public.commercial_limit_grants from anon;
revoke insert,update,delete on public.commercial_limit_grants from authenticated;
grant select on public.commercial_limit_grants to authenticated;

create table public.investment_credit_consumptions(
 id uuid primary key default gen_random_uuid(),
 ledger_id uuid not null references public.investment_credit_ledgers(id),
 tenant_id uuid not null,
 customer_account_id uuid not null,
 logical_analysis_reference text not null,
 status text not null check(status in('reserved','consumed','released')),
 idempotency_key_hash text not null unique,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 revision integer not null default 1,
 foreign key(customer_account_id,tenant_id) references public.customer_accounts(id,tenant_id),
 unique(ledger_id,logical_analysis_reference)
);
alter table public.investment_credit_consumptions enable row level security;
create policy "members read investment credit consumption" on public.investment_credit_consumptions for select to authenticated using(exists(select 1 from public.customer_account_memberships m where m.tenant_id=investment_credit_consumptions.tenant_id and m.customer_account_id=investment_credit_consumptions.customer_account_id and m.profile_id=auth.uid() and m.status='active'));
revoke all on public.investment_credit_consumptions from anon;
revoke insert,update,delete on public.investment_credit_consumptions from authenticated;
grant select on public.investment_credit_consumptions to authenticated;

create function public.initialize_oc001_agreement_effects(p_agreement_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.commercial_agreements;o uuid;cfg jsonb:='{}';quantity integer:=1;credits integer;expires timestamptz;limit_count integer:=0;
begin
 select * into a from public.commercial_agreements where id=p_agreement_id and status='active' for update;
 if not found then raise exception'OC001_AGREEMENT_NOT_ACTIVE';end if;
 select id into o from public.commercial_offer_versions where code=a.offer_code and version=a.offer_version;
 if o is null then raise exception'OC001_OFFER_VERSION_UNAVAILABLE';end if;
 select coalesce(i.configuration_snapshot,'{}') into cfg from public.commercial_purchase_intents i where i.checkout_attempt_id=a.checkout_attempt_id;
 if a.offer_code='HPM-GROWTH-PROPERTY' then quantity:=greatest(1,least(100,coalesce((cfg->>'property_quantity')::integer,1)));end if;
 insert into public.commercial_limit_grants(tenant_id,customer_account_id,source_agreement_id,offer_code,offer_version,limit_code,allowance_value,period,status,effective_from,effective_until)
 select a.tenant_id,a.customer_account_id,a.id,a.offer_code,a.offer_version,l.limit_code,l.allowance_value*case when a.offer_code='HPM-GROWTH-PROPERTY' then quantity else 1 end,l.period,'active',coalesce(a.activated_at,now()),a.current_period_end
 from public.commercial_offer_limits l where l.offer_id=o and l.allowance_kind='finite'
 on conflict(source_agreement_id,limit_code)do nothing;
 get diagnostics limit_count=row_count;
 if a.offer_code in('II-SINGLE','II-BUNDLE')then
  credits:=case a.offer_code when'II-SINGLE'then 1 else 5 end;
  expires:=case when a.offer_code='II-BUNDLE'then coalesce(a.activated_at,now())+interval'12 months' else null end;
  insert into public.investment_credit_ledgers(tenant_id,customer_account_id,source_agreement_id,granted_count,expires_at,status)
  values(a.tenant_id,a.customer_account_id,a.id,credits,expires,'active')on conflict(source_agreement_id)do nothing;
 end if;
 return jsonb_build_object('agreementId',a.id,'limitGrantCount',limit_count,'investmentCredits',coalesce(credits,0));
end$$;
revoke all on function public.initialize_oc001_agreement_effects(uuid,text)from public,anon,authenticated;
grant execute on function public.initialize_oc001_agreement_effects(uuid,text)to service_role;

create function public.reserve_oc001_investment_credit(p_actor_id uuid,p_tenant_id uuid,p_customer_account_id uuid,p_logical_analysis_reference text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.investment_credit_ledgers;c public.investment_credit_consumptions;h text:=pg_catalog.encode(extensions.digest(p_idempotency_key,'sha256'),'hex');
begin
 if auth.role()<>'service_role' or not exists(select 1 from public.customer_account_memberships where profile_id=p_actor_id and tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and status='active')then raise exception'OC001_INVESTMENT_CREDIT_NOT_AUTHORIZED';end if;
 if length(trim(p_logical_analysis_reference))=0 then raise exception'OC001_INVESTMENT_ANALYSIS_REFERENCE_REQUIRED';end if;
 select * into c from public.investment_credit_consumptions where idempotency_key_hash=h;if found then return jsonb_build_object('consumptionId',c.id,'status',c.status);end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text||':'||p_customer_account_id::text||':investment-credit',0));
 select * into l from public.investment_credit_ledgers where tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and status='active'and(expires_at is null or expires_at>now())and consumed_count<granted_count order by expires_at nulls last,created_at for update skip locked limit 1;
 if not found then raise exception'OC001_INVESTMENT_CREDIT_UNAVAILABLE';end if;
 insert into public.investment_credit_consumptions(ledger_id,tenant_id,customer_account_id,logical_analysis_reference,status,idempotency_key_hash)values(l.id,p_tenant_id,p_customer_account_id,p_logical_analysis_reference,'reserved',h)returning*into c;
 update public.investment_credit_ledgers set consumed_count=consumed_count+1,status=case when consumed_count+1>=granted_count then'exhausted'else'active'end,updated_at=now(),revision=revision+1 where id=l.id;
 return jsonb_build_object('consumptionId',c.id,'status','reserved');
end$$;
revoke all on function public.reserve_oc001_investment_credit(uuid,uuid,uuid,text,text)from public,anon,authenticated;
grant execute on function public.reserve_oc001_investment_credit(uuid,uuid,uuid,text,text)to service_role;

create function public.register_oc001_guidebook_hosting(p_actor_id uuid,p_tenant_id uuid,p_customer_account_id uuid,p_guidebook_id uuid,p_agreement_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.commercial_agreements;t public.guidebook_hosting_terms;
begin
 if auth.role()<>'service_role' or not exists(select 1 from public.customer_account_memberships where profile_id=p_actor_id and tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and status='active')then raise exception'OC001_GUIDEBOOK_HOSTING_NOT_AUTHORIZED';end if;
 select * into a from public.commercial_agreements where id=p_agreement_id and tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and status='active'and offer_code in('GB-SELF','GB-GUIDED','GB-DFY');if not found then raise exception'OC001_GUIDEBOOK_AGREEMENT_INVALID';end if;
 if not exists(select 1 from public.guidebooks g where g.id=p_guidebook_id and g.workspace_id=p_tenant_id)then raise exception'OC001_GUIDEBOOK_CONTEXT_INVALID';end if;
 insert into public.guidebook_hosting_terms(tenant_id,customer_account_id,guidebook_id,source_agreement_id,starts_at,ends_at,status)values(p_tenant_id,p_customer_account_id,p_guidebook_id,a.id,coalesce(a.activated_at,now()),coalesce(a.activated_at,now())+interval'12 months','active')on conflict(guidebook_id,source_agreement_id)do update set updated_at=public.guidebook_hosting_terms.updated_at returning*into t;
 return jsonb_build_object('hostingTermId',t.id,'status',t.status,'endsAt',t.ends_at);
end$$;
revoke all on function public.register_oc001_guidebook_hosting(uuid,uuid,uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.register_oc001_guidebook_hosting(uuid,uuid,uuid,uuid,uuid)to service_role;

create function public.create_oc001_furnishing_configuration(p_actor_id uuid,p_tenant_id uuid,p_customer_account_id uuid,p_additional_rooms integer,p_additional_revisions integer,p_property_context_id uuid,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.commercial_configuration_approvals;c public.commercial_upgrade_credits;h text:=pg_catalog.encode(extensions.digest(p_idempotency_key,'sha256'),'hex');amount bigint;
begin
 if auth.role()<>'service_role' or not exists(select 1 from public.customer_account_memberships where profile_id=p_actor_id and tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and status='active')then raise exception'OC001_CONFIGURATION_NOT_AUTHORIZED';end if;
 if p_additional_rooms not between 0 and 20 or p_additional_revisions not between 0 and 10 then raise exception'OC001_CONFIGURATION_INVALID';end if;
 select * into a from public.commercial_configuration_approvals where idempotency_key_hash=h;if found then return jsonb_build_object('approvalId',a.id,'status',a.status,'amountMinor',a.amount_minor);end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_customer_account_id::text||':'||p_property_context_id::text||':FS-DESIGN',0));
 select * into c from public.commercial_upgrade_credits where tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and property_context_id=p_property_context_id and target_offer_code='FS-DESIGN'and status='available'and available_until>now()order by created_at limit 1 for update;
 amount:=149500+p_additional_rooms*25000+p_additional_revisions*15000-case when found then least(c.amount_minor,24900)else 0 end;
 insert into public.commercial_configuration_approvals(tenant_id,customer_account_id,offer_code,offer_version,configuration,configuration_checksum,amount_minor,currency,status,consultation_credit_id,idempotency_key_hash)values(p_tenant_id,p_customer_account_id,'FS-DESIGN',1,jsonb_build_object('additional_room_count',p_additional_rooms,'additional_revision_count',p_additional_revisions,'property_context_id',p_property_context_id),pg_catalog.encode(extensions.digest(p_additional_rooms::text||':'||p_additional_revisions::text||':'||p_property_context_id::text,'sha256'),'hex'),amount,'USD','pending_review',c.id,h)returning*into a;
 if c.id is not null then update public.commercial_upgrade_credits set status='reserved',reserved_for_approval_id=a.id,updated_at=now(),revision=revision+1 where id=c.id;end if;
 return jsonb_build_object('approvalId',a.id,'status',a.status,'amountMinor',a.amount_minor);
end$$;
revoke all on function public.create_oc001_furnishing_configuration(uuid,uuid,uuid,integer,integer,uuid,text)from public,anon,authenticated;
grant execute on function public.create_oc001_furnishing_configuration(uuid,uuid,uuid,integer,integer,uuid,text)to service_role;

create function public.register_oc001_furnishing_consultation_credit(p_actor_id uuid,p_tenant_id uuid,p_customer_account_id uuid,p_property_context_id uuid,p_agreement_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.commercial_agreements;c public.commercial_upgrade_credits;
begin
 if auth.role()<>'service_role' or not exists(select 1 from public.customer_account_memberships where profile_id=p_actor_id and tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and status='active')then raise exception'OC001_CONSULTATION_CREDIT_NOT_AUTHORIZED';end if;
 select * into a from public.commercial_agreements where id=p_agreement_id and tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and offer_code='FS-CONSULT'and status='active';if not found then raise exception'OC001_CONSULTATION_AGREEMENT_INVALID';end if;
 insert into public.commercial_upgrade_credits(tenant_id,customer_account_id,source_agreement_id,source_offer_code,target_offer_code,property_context_id,amount_minor,currency,status,available_until)values(p_tenant_id,p_customer_account_id,a.id,'FS-CONSULT','FS-DESIGN',p_property_context_id,24900,'USD','available',coalesce(a.activated_at,now())+interval'30 days')on conflict(source_agreement_id,target_offer_code)do update set updated_at=public.commercial_upgrade_credits.updated_at returning*into c;
 return jsonb_build_object('creditId',c.id,'status',c.status,'availableUntil',c.available_until);
end$$;
revoke all on function public.register_oc001_furnishing_consultation_credit(uuid,uuid,uuid,uuid,uuid)from public,anon,authenticated;
grant execute on function public.register_oc001_furnishing_consultation_credit(uuid,uuid,uuid,uuid,uuid)to service_role;

-- Existing active controlled purchases are reconciled idempotently when the migration is applied.
select public.initialize_oc001_agreement_effects(id,'oc001-effects-backfill:'||id::text)from public.commercial_agreements where status='active'and offer_code in('HPM-STARTER','HPM-GROWTH','HPM-GROWTH-PROPERTY','GB-SELF','GB-GUIDED','GB-DFY','II-SINGLE','II-BUNDLE','FS-CONSULT','FS-DESIGN');
