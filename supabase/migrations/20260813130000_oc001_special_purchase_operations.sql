-- OC-001 special purchase operations: HPM capacity, Guidebook renewal, and
-- approved Furnishing checkout. Provider calls remain in the application layer;
-- these functions claim and finalize their effects under row locks.

create table public.hpm_property_addon_operations(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,customer_account_id uuid not null,
 base_agreement_id uuid not null references public.commercial_agreements(id),requested_quantity integer not null check(requested_quantity between 0 and 100),
 prior_quantity integer not null check(prior_quantity between 0 and 100),provider_subscription_reference text not null,provider_subscription_item_reference text,
 status text not null check(status in('requested','provider_applied','completed','reconciling','failed','cancelled')),
 idempotency_key_hash text not null unique,stable_failure_code text,correlation_id text not null,requested_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),completed_at timestamptz,revision integer not null default 1,
 foreign key(customer_account_id,tenant_id) references public.customer_accounts(id,tenant_id)
);
create unique index hpm_property_addon_active_uidx on public.hpm_property_addon_operations(base_agreement_id) where status in('requested','provider_applied','reconciling');
create index hpm_property_addon_account_idx on public.hpm_property_addon_operations(tenant_id,customer_account_id,created_at desc);

create table public.guidebook_hosting_renewal_obligations(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,customer_account_id uuid not null,hosting_term_id uuid not null references public.guidebook_hosting_terms(id),guidebook_id uuid not null,
 provider_customer_reference text not null,provider_subscription_reference text,provider_price_reference text not null,
 renewal_at timestamptz not null,status text not null check(status in('requested','scheduled','active','past_due','grace','cancelled','failed')),
 idempotency_key_hash text not null unique,stable_failure_code text,correlation_id text not null,requested_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),revision integer not null default 1,
 foreign key(customer_account_id,tenant_id) references public.customer_accounts(id,tenant_id),unique(hosting_term_id)
);
create unique index guidebook_hosting_provider_subscription_uidx on public.guidebook_hosting_renewal_obligations(provider_subscription_reference) where provider_subscription_reference is not null;
create index guidebook_hosting_renewal_due_idx on public.guidebook_hosting_renewal_obligations(status,renewal_at);

alter table public.commercial_configuration_approvals
 add column purchase_intent_id uuid references public.commercial_purchase_intents(id),
 add column checkout_started_at timestamptz,
 add column consumed_at timestamptz;
create unique index commercial_configuration_purchase_intent_uidx on public.commercial_configuration_approvals(purchase_intent_id) where purchase_intent_id is not null;

alter table public.hpm_property_addon_operations enable row level security;
alter table public.guidebook_hosting_renewal_obligations enable row level security;
create policy "members read HPM property add-on operations" on public.hpm_property_addon_operations for select to authenticated using(exists(select 1 from public.customer_account_memberships m where m.tenant_id=hpm_property_addon_operations.tenant_id and m.customer_account_id=hpm_property_addon_operations.customer_account_id and m.profile_id=auth.uid() and m.status='active'));
create policy "members read Guidebook renewal obligations" on public.guidebook_hosting_renewal_obligations for select to authenticated using(exists(select 1 from public.customer_account_memberships m where m.tenant_id=guidebook_hosting_renewal_obligations.tenant_id and m.customer_account_id=guidebook_hosting_renewal_obligations.customer_account_id and m.profile_id=auth.uid() and m.status='active'));
revoke all on public.hpm_property_addon_operations,public.guidebook_hosting_renewal_obligations from anon;
revoke insert,update,delete on public.hpm_property_addon_operations,public.guidebook_hosting_renewal_obligations from authenticated;
grant select on public.hpm_property_addon_operations,public.guidebook_hosting_renewal_obligations to authenticated;

create function public.claim_oc001_hpm_property_addon(p_actor_id uuid,p_tenant_id uuid,p_customer_account_id uuid,p_quantity integer,p_idempotency_key text,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.commercial_agreements;o public.hpm_property_addon_operations;h text:=pg_catalog.encode(extensions.digest(p_idempotency_key,'sha256'),'hex');current_quantity integer:=0;
begin
 if auth.role()<>'service_role' or not exists(select 1 from public.customer_account_memberships where profile_id=p_actor_id and tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and status='active')then raise exception'OC001_HPM_ADDON_NOT_AUTHORIZED';end if;
 if p_quantity not between 0 and 100 then raise exception'OC001_HPM_ADDON_QUANTITY_INVALID';end if;
 select * into o from public.hpm_property_addon_operations where idempotency_key_hash=h;if found then return jsonb_build_object('operationId',o.id,'status',o.status,'quantity',o.requested_quantity,'providerSubscriptionReference',o.provider_subscription_reference,'providerSubscriptionItemReference',o.provider_subscription_item_reference);end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text||':'||p_customer_account_id::text||':HPM-GROWTH-PROPERTY',0));
 select * into a from public.commercial_agreements where tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and offer_code='HPM-GROWTH' and status='active' and provider_agreement_reference is not null order by activated_at desc nulls last limit 1 for update;
 if not found then raise exception'OC001_HPM_GROWTH_SUBSCRIPTION_REQUIRED';end if;
 if exists(select 1 from public.hpm_property_addon_operations where base_agreement_id=a.id and status in('requested','provider_applied','reconciling'))then raise exception'OC001_HPM_ADDON_OPERATION_IN_PROGRESS';end if;
 select coalesce(requested_quantity,0) into current_quantity from public.hpm_property_addon_operations where base_agreement_id=a.id and status='completed' order by completed_at desc limit 1;
 insert into public.hpm_property_addon_operations(tenant_id,customer_account_id,base_agreement_id,requested_quantity,prior_quantity,provider_subscription_reference,status,idempotency_key_hash,correlation_id,requested_by)values(p_tenant_id,p_customer_account_id,a.id,p_quantity,coalesce(current_quantity,0),a.provider_agreement_reference,'requested',h,p_correlation_id,p_actor_id)returning*into o;
 return jsonb_build_object('operationId',o.id,'status',o.status,'quantity',o.requested_quantity,'priorQuantity',o.prior_quantity,'providerSubscriptionReference',o.provider_subscription_reference);
end$$;

create function public.complete_oc001_hpm_property_addon(p_operation_id uuid,p_provider_subscription_item_reference text,p_provider_quantity integer,p_provider_status text,p_failure_code text default null)
returns jsonb language plpgsql security definer set search_path='' as $$declare o public.hpm_property_addon_operations;g public.commercial_limit_grants;
begin
 if auth.role()<>'service_role'then raise exception'OC001_HPM_ADDON_FINALIZE_NOT_AUTHORIZED';end if;
 select * into o from public.hpm_property_addon_operations where id=p_operation_id for update;if not found then raise exception'OC001_HPM_ADDON_OPERATION_UNKNOWN';end if;
 if o.status='completed'then return jsonb_build_object('operationId',o.id,'status',o.status,'quantity',o.requested_quantity);end if;
 if p_provider_status<>'active' or p_provider_quantity<>o.requested_quantity then update public.hpm_property_addon_operations set status='reconciling',stable_failure_code=coalesce(p_failure_code,'OC001_PROVIDER_STATE_MISMATCH'),updated_at=now(),revision=revision+1 where id=o.id;return jsonb_build_object('operationId',o.id,'status','reconciling');end if;
 select * into g from public.commercial_limit_grants where source_agreement_id=o.base_agreement_id and limit_code='property_count' for update;if not found then raise exception'OC001_HPM_BASE_LIMIT_MISSING';end if;
 update public.commercial_limit_grants set allowance_value=3+o.requested_quantity,updated_at=now(),revision=revision+1 where id=g.id;
 update public.hpm_property_addon_operations set provider_subscription_item_reference=nullif(p_provider_subscription_item_reference,''),status='completed',stable_failure_code=null,completed_at=now(),updated_at=now(),revision=revision+1 where id=o.id;
 insert into public.commercial_catalog_audit_events(event_code,offer_code,offer_version,actor_id,reason_code,correlation_id,safe_metadata)values('oc001_hpm_property_capacity_changed','HPM-GROWTH-PROPERTY',1,o.requested_by,'PROVIDER_CONFIRMED',o.correlation_id,jsonb_build_object('operationId',o.id,'quantity',o.requested_quantity,'propertyCapacity',3+o.requested_quantity));
 return jsonb_build_object('operationId',o.id,'status','completed','quantity',o.requested_quantity,'propertyCapacity',3+o.requested_quantity);
end$$;

create function public.claim_oc001_guidebook_hosting_renewal(p_actor_id uuid,p_tenant_id uuid,p_customer_account_id uuid,p_guidebook_id uuid,p_account_mode text,p_idempotency_key text,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path='' as $$declare t public.guidebook_hosting_terms;o public.guidebook_hosting_renewal_obligations;m public.billing_price_mappings;c public.billing_customer_associations;h text:=pg_catalog.encode(extensions.digest(p_idempotency_key,'sha256'),'hex');
begin
 if auth.role()<>'service_role' or not exists(select 1 from public.customer_account_memberships where profile_id=p_actor_id and tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and status='active')then raise exception'OC001_GUIDEBOOK_RENEWAL_NOT_AUTHORIZED';end if;
 select * into o from public.guidebook_hosting_renewal_obligations where idempotency_key_hash=h;if found then return jsonb_build_object('obligationId',o.id,'status',o.status,'renewalAt',o.renewal_at,'providerCustomerReference',o.provider_customer_reference,'providerPriceReference',o.provider_price_reference,'providerSubscriptionReference',o.provider_subscription_reference);end if;
 select * into t from public.guidebook_hosting_terms where tenant_id=p_tenant_id and customer_account_id=p_customer_account_id and guidebook_id=p_guidebook_id and status in('active','grace') order by ends_at desc limit 1 for update;if not found then raise exception'OC001_GUIDEBOOK_HOSTING_TERM_REQUIRED';end if;
 if p_account_mode not in('test','live')then raise exception'OC001_ACCOUNT_MODE_INVALID';end if;
 select * into m from public.billing_price_mappings where price_code='GB-HOSTING-RENEWAL-ANNUAL'and price_version=1 and status='active'and account_mode=p_account_mode order by effective_from desc limit 1;if not found then raise exception'OC001_GUIDEBOOK_RENEWAL_PRICE_UNAVAILABLE';end if;
 select * into c from public.billing_customer_associations where customer_account_id=p_customer_account_id and account_mode=m.account_mode and status='active';if not found then raise exception'OC001_GUIDEBOOK_CUSTOMER_MAPPING_REQUIRED';end if;
 insert into public.guidebook_hosting_renewal_obligations(tenant_id,customer_account_id,hosting_term_id,guidebook_id,provider_customer_reference,provider_price_reference,renewal_at,status,idempotency_key_hash,correlation_id,requested_by)values(p_tenant_id,p_customer_account_id,t.id,p_guidebook_id,c.stripe_customer_reference,m.stripe_price_reference,t.ends_at,'requested',h,p_correlation_id,p_actor_id)returning*into o;
 return jsonb_build_object('obligationId',o.id,'status',o.status,'renewalAt',o.renewal_at,'providerCustomerReference',o.provider_customer_reference,'providerPriceReference',o.provider_price_reference);
end$$;

create function public.complete_oc001_guidebook_hosting_renewal_schedule(p_obligation_id uuid,p_provider_subscription_reference text,p_provider_trial_end timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$declare o public.guidebook_hosting_renewal_obligations;
begin if auth.role()<>'service_role'then raise exception'OC001_GUIDEBOOK_RENEWAL_FINALIZE_NOT_AUTHORIZED';end if;select * into o from public.guidebook_hosting_renewal_obligations where id=p_obligation_id for update;if not found then raise exception'OC001_GUIDEBOOK_RENEWAL_UNKNOWN';end if;if o.status in('scheduled','active')then return jsonb_build_object('obligationId',o.id,'status',o.status);end if;if abs(extract(epoch from(p_provider_trial_end-o.renewal_at)))>60 then raise exception'OC001_GUIDEBOOK_RENEWAL_DATE_MISMATCH';end if;update public.guidebook_hosting_renewal_obligations set provider_subscription_reference=p_provider_subscription_reference,status='scheduled',updated_at=now(),revision=revision+1 where id=o.id;return jsonb_build_object('obligationId',o.id,'status','scheduled');end$$;

create function public.apply_oc001_guidebook_hosting_renewal(p_provider_subscription_reference text,p_period_start timestamptz,p_period_end timestamptz,p_paid boolean)
returns jsonb language plpgsql security definer set search_path='' as $$declare o public.guidebook_hosting_renewal_obligations;t public.guidebook_hosting_terms;
begin if auth.role()<>'service_role'then raise exception'OC001_GUIDEBOOK_RENEWAL_EVENT_NOT_AUTHORIZED';end if;select * into o from public.guidebook_hosting_renewal_obligations where provider_subscription_reference=p_provider_subscription_reference for update;if not found then raise exception'OC001_GUIDEBOOK_RENEWAL_UNKNOWN';end if;select * into t from public.guidebook_hosting_terms where id=o.hosting_term_id for update;if p_paid then if p_period_end<>p_period_start+interval'1 year'then raise exception'OC001_GUIDEBOOK_RENEWAL_PERIOD_INVALID';end if;update public.guidebook_hosting_terms set starts_at=p_period_start,ends_at=p_period_end,status='renewed',updated_at=now(),revision=revision+1 where id=t.id;update public.guidebook_hosting_renewal_obligations set status='active',renewal_at=p_period_end,stable_failure_code=null,updated_at=now(),revision=revision+1 where id=o.id;else update public.guidebook_hosting_terms set status='grace',updated_at=now(),revision=revision+1 where id=t.id;update public.guidebook_hosting_renewal_obligations set status='past_due',stable_failure_code='PAYMENT_FAILED',updated_at=now(),revision=revision+1 where id=o.id;end if;return jsonb_build_object('obligationId',o.id,'status',case when p_paid then'active'else'past_due'end,'guidebookId',o.guidebook_id);end$$;

create function public.create_oc001_furnishing_approved_purchase_intent(p_actor_id uuid,p_approval_id uuid,p_expected_revision integer,p_account_mode text,p_idempotency_hash text,p_correlation_id text)
returns jsonb language plpgsql security definer set search_path='' as $$declare a public.commercial_configuration_approvals;i public.commercial_purchase_intents;m public.billing_price_mappings;
begin
 if auth.role()<>'service_role'then raise exception'OC001_FURNISHING_CHECKOUT_NOT_AUTHORIZED';end if;
 select * into a from public.commercial_configuration_approvals where id=p_approval_id for update;if not found or a.status<>'approved'or a.revision<>p_expected_revision or a.expires_at<=now()then raise exception'OC001_FURNISHING_APPROVAL_STALE';end if;
 if not exists(select 1 from public.customer_account_memberships where profile_id=p_actor_id and tenant_id=a.tenant_id and customer_account_id=a.customer_account_id and status='active')then raise exception'OC001_FURNISHING_CHECKOUT_NOT_AUTHORIZED';end if;
 if a.purchase_intent_id is not null then select * into i from public.commercial_purchase_intents where id=a.purchase_intent_id;return jsonb_build_object('purchaseIntentId',i.id,'status',i.status,'amountMinor',a.amount_minor,'configurationChecksum',a.configuration_checksum);end if;
 if p_account_mode not in('test','live')then raise exception'OC001_ACCOUNT_MODE_INVALID';end if;
 select * into m from public.billing_price_mappings where price_code='FS-DESIGN-BASE'and price_version=1 and status='active'and account_mode=p_account_mode order by effective_from desc limit 1;if not found then raise exception'OC001_FURNISHING_PRICE_UNAVAILABLE';end if;
 insert into public.commercial_purchase_intents(id,tenant_id,customer_account_id,offer_code,offer_version,price_code,price_version,billing_price_mapping_id,configuration_snapshot,commercial_snapshot_checksum,policy_snapshot,entitlement_snapshot,status,idempotency_key_hash,correlation_id)
 values(gen_random_uuid(),a.tenant_id,a.customer_account_id,'FS-DESIGN',a.offer_version,'FS-DESIGN-BASE',1,m.id,a.configuration,a.configuration_checksum,jsonb_build_object('scopeApprovalId',a.id,'scopeApprovalRevision',a.revision),jsonb_build_array(jsonb_build_object('capabilityCode','furnishing.project.access','resourceType','furnishing_project'),jsonb_build_object('capabilityCode','furnishing.intake.submit','resourceType','furnishing_project'),jsonb_build_object('capabilityCode','furnishing.requirements.manage','resourceType','furnishing_project'),jsonb_build_object('capabilityCode','furnishing.status.view','resourceType','furnishing_project'),jsonb_build_object('capabilityCode','furnishing.deliverable.view','resourceType','furnishing_project')),'created',p_idempotency_hash,p_correlation_id)returning*into i;
 update public.commercial_configuration_approvals set purchase_intent_id=i.id,checkout_started_at=now(),updated_at=now(),revision=revision+1 where id=a.id;
 return jsonb_build_object('purchaseIntentId',i.id,'status',i.status,'amountMinor',a.amount_minor,'currency',a.currency,'configurationChecksum',a.configuration_checksum,'providerProductReference',m.stripe_product_reference);
end$$;

create function public.consume_oc001_furnishing_configuration(p_purchase_intent_id uuid,p_agreement_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$declare a public.commercial_configuration_approvals;g public.commercial_agreements;
begin if auth.role()<>'service_role'then raise exception'OC001_FURNISHING_CONSUME_NOT_AUTHORIZED';end if;select * into a from public.commercial_configuration_approvals where purchase_intent_id=p_purchase_intent_id for update;if not found then raise exception'OC001_FURNISHING_CONFIGURATION_UNKNOWN';end if;if a.status='consumed'then return jsonb_build_object('approvalId',a.id,'status','consumed');end if;select * into g from public.commercial_agreements where id=p_agreement_id and checkout_attempt_id=(select checkout_attempt_id from public.commercial_purchase_intents where id=p_purchase_intent_id)and status='active';if not found then raise exception'OC001_FURNISHING_AGREEMENT_NOT_ACTIVE';end if;update public.commercial_configuration_approvals set status='consumed',consumed_at=now(),updated_at=now(),revision=revision+1 where id=a.id;update public.commercial_upgrade_credits set status='consumed',consumed_at=now(),updated_at=now(),revision=revision+1 where id=a.consultation_credit_id and status='reserved';return jsonb_build_object('approvalId',a.id,'status','consumed','agreementId',g.id);end$$;

create function public.cancel_oc001_furnishing_configuration(p_actor_id uuid,p_approval_id uuid,p_expected_revision integer,p_reason_code text)
returns jsonb language plpgsql security definer set search_path='' as $$declare a public.commercial_configuration_approvals;
begin if auth.role()<>'service_role'then raise exception'OC001_FURNISHING_CANCEL_NOT_AUTHORIZED';end if;select * into a from public.commercial_configuration_approvals where id=p_approval_id for update;if not found or a.revision<>p_expected_revision or a.status not in('pending_review','approved','changes_requested')then raise exception'OC001_FURNISHING_CANCEL_CONFLICT';end if;if not exists(select 1 from public.customer_account_memberships where profile_id=p_actor_id and tenant_id=a.tenant_id and customer_account_id=a.customer_account_id and status='active')and not exists(select 1 from public.profiles where id=p_actor_id and role='admin')then raise exception'OC001_FURNISHING_CANCEL_NOT_AUTHORIZED';end if;if length(trim(p_reason_code))=0 then raise exception'OC001_FURNISHING_CANCEL_REASON_REQUIRED';end if;update public.commercial_configuration_approvals set status='cancelled',updated_at=now(),revision=revision+1 where id=a.id;update public.commercial_upgrade_credits set status=case when available_until>now()then'available'else'expired'end,reserved_for_approval_id=null,updated_at=now(),revision=revision+1 where id=a.consultation_credit_id and status='reserved';return jsonb_build_object('approvalId',a.id,'status','cancelled');end$$;

create function public.expire_oc001_guidebook_hosting(p_hosting_term_id uuid,p_reason_code text)
returns jsonb language plpgsql security definer set search_path='' as $$declare t public.guidebook_hosting_terms;
begin if auth.role()<>'service_role'then raise exception'OC001_GUIDEBOOK_EXPIRY_NOT_AUTHORIZED';end if;select * into t from public.guidebook_hosting_terms where id=p_hosting_term_id for update;if not found then raise exception'OC001_GUIDEBOOK_HOSTING_TERM_UNKNOWN';end if;if t.status<>'grace'or now()<t.ends_at+interval'7 days'then raise exception'OC001_GUIDEBOOK_TRANSITION_PERIOD_ACTIVE';end if;if length(trim(p_reason_code))=0 then raise exception'OC001_GUIDEBOOK_EXPIRY_REASON_REQUIRED';end if;update public.guidebook_hosting_terms set status='expired',updated_at=now(),revision=revision+1 where id=t.id;update public.guidebooks set public_url_status='revoked',updated_at=now(),revision=revision+1 where id=t.guidebook_id and public_url_status='active';return jsonb_build_object('hostingTermId',t.id,'status','expired','guidebookId',t.guidebook_id,'exportAvailable',true);end$$;

revoke all on function public.claim_oc001_hpm_property_addon(uuid,uuid,uuid,integer,text,text),function public.complete_oc001_hpm_property_addon(uuid,text,integer,text,text),function public.claim_oc001_guidebook_hosting_renewal(uuid,uuid,uuid,uuid,text,text,text),function public.complete_oc001_guidebook_hosting_renewal_schedule(uuid,text,timestamptz),function public.apply_oc001_guidebook_hosting_renewal(text,timestamptz,timestamptz,boolean),function public.create_oc001_furnishing_approved_purchase_intent(uuid,uuid,integer,text,text,text),function public.consume_oc001_furnishing_configuration(uuid,uuid),function public.cancel_oc001_furnishing_configuration(uuid,uuid,integer,text),function public.expire_oc001_guidebook_hosting(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_oc001_hpm_property_addon(uuid,uuid,uuid,integer,text,text),function public.complete_oc001_hpm_property_addon(uuid,text,integer,text,text),function public.claim_oc001_guidebook_hosting_renewal(uuid,uuid,uuid,uuid,text,text,text),function public.complete_oc001_guidebook_hosting_renewal_schedule(uuid,text,timestamptz),function public.apply_oc001_guidebook_hosting_renewal(text,timestamptz,timestamptz,boolean),function public.create_oc001_furnishing_approved_purchase_intent(uuid,uuid,integer,text,text,text),function public.consume_oc001_furnishing_configuration(uuid,uuid),function public.cancel_oc001_furnishing_configuration(uuid,uuid,integer,text),function public.expire_oc001_guidebook_hosting(uuid,text) to service_role;
