-- PC-001C.5: canonical access grants, credits, fulfillment process manager, and feature handoff records.
alter table public.commerce_entitlement_templates
  add column if not exists scope_type text not null default 'workspace' check(scope_type in('workspace','profile','property','opportunity','order')),
  add column if not exists grant_type text not null default 'capability' check(grant_type in('capability','credit','download','quota','discount')),
  add column if not exists duration_policy text not null default 'perpetual' check(duration_policy in('perpetual','subscription-period','fixed-duration','single-use','until-revoked')),
  add column if not exists default_duration_days integer check(default_duration_days>0),
  add column if not exists default_quantity integer check(default_quantity>0),
  add column if not exists status text not null default 'active' check(status in('draft','active','inactive','archived')),
  add column if not exists updated_at timestamptz not null default now();

create table public.commerce_product_entitlement_rules(
 id text primary key,version integer not null check(version>0),product_id text references public.commerce_products(id),offer_id text references public.commerce_offers(id),
 entitlement_template_id text not null references public.commerce_entitlement_templates(id),quantity integer check(quantity>0),duration_days integer check(duration_days>0),
 activation_trigger text not null check(activation_trigger in('order-paid','subscription-active','subscription-renewed','manual')),
 cancellation_behavior text not null check(cancellation_behavior in('retain','expire-at-period-end','suspend-immediately','no-effect')),
 refund_behavior text not null check(refund_behavior in('retain','suspend','revoke','manual-review')),
 trial_access boolean not null default false,past_due_grace_days integer not null default 7 check(past_due_grace_days>=0),
 effective_from timestamptz not null, effective_to timestamptz,created_at timestamptz not null default now(),
 check((product_id is not null)::integer+(offer_id is not null)::integer=1),unique(product_id,entitlement_template_id,version),unique(offer_id,entitlement_template_id,version)
);
create table public.commerce_entitlement_grants(
 id text primary key,entitlement_template_id text not null references public.commerce_entitlement_templates(id),entitlement_key text not null,
 scope_type text not null check(scope_type in('workspace','profile','property','opportunity','order')),workspace_id uuid,profile_id uuid,property_id uuid,opportunity_id text,order_id text,
 source_type text not null check(source_type in('subscription','order','promotion','manual','founding-partner')),source_id text not null,environment text not null check(environment in('test','live')),
 quantity integer check(quantity>=0),remaining_quantity integer check(remaining_quantity>=0),status text not null check(status in('pending','active','suspended','expired','revoked','consumed')),
 effective_from timestamptz not null,effective_until timestamptz,activation_reason text,suspension_reason text,revocation_reason text,revision integer not null default 1 check(revision>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(remaining_quantity is null or(quantity is not null and remaining_quantity<=quantity)),check(effective_until is null or effective_until>=effective_from),
 check((scope_type='workspace' and workspace_id is not null)or(scope_type='profile' and profile_id is not null)or(scope_type='property' and property_id is not null)or(scope_type='opportunity' and opportunity_id is not null)or(scope_type='order' and order_id is not null))
);
create unique index commerce_grant_source_scope_uidx on public.commerce_entitlement_grants(entitlement_key,source_type,source_id,scope_type,
 coalesce(workspace_id::text,''),coalesce(profile_id::text,''),coalesce(property_id::text,''),coalesce(opportunity_id,''),coalesce(order_id,''),environment);
create index commerce_grant_resolution_idx on public.commerce_entitlement_grants(workspace_id,profile_id,entitlement_key,status,effective_until);

create table public.commerce_entitlement_history(
 id text primary key,grant_id text not null references public.commerce_entitlement_grants(id),event_type text not null,previous_status text,resulting_status text not null,
 reason text,actor_profile_id uuid,revision integer not null,snapshot jsonb not null,occurred_at timestamptz not null,created_at timestamptz not null default now()
);
create table public.commerce_entitlement_consumptions(
 id text primary key,grant_id text not null references public.commerce_entitlement_grants(id),quantity integer not null check(quantity>0),subject_type text not null,subject_id text not null,
 command_id text not null,status text not null check(status in('reserved','consumed','released','reversed')),created_at timestamptz not null default now(),
 consumed_at timestamptz,released_at timestamptz,unique(grant_id,command_id)
);
create table public.commerce_fulfillments(
 id text primary key,order_id text references public.commerce_orders(id),order_line_id text references public.commerce_order_lines(id),subscription_id text references public.commerce_subscriptions(id),
 fulfillment_type text not null,status text not null check(status in('pending','processing','ready','in-progress','completed','failed','cancelled','manual-review')),
 workspace_id uuid,profile_id uuid,environment text not null check(environment in('test','live')),target_type text,target_id text,adapter_key text not null,rule_version text not null,
 attempts integer not null default 0 check(attempts>=0),idempotency_key text unique not null,failure_code text,failure_message text,locked_at timestamptz,lease_expires_at timestamptz,
 created_at timestamptz not null default now(),started_at timestamptz,completed_at timestamptz,failed_at timestamptz,updated_at timestamptz not null default now(),
 unique(order_line_id,rule_version),check((order_id is not null and order_line_id is not null)or subscription_id is not null)
);
create index commerce_fulfillment_work_idx on public.commerce_fulfillments(status,created_at);
create table public.commerce_fulfillment_attempts(
 id text primary key,fulfillment_id text not null references public.commerce_fulfillments(id),attempt_number integer not null,command_id text not null,status text not null,
 error_code text,error_message text,target_type text,target_id text,started_at timestamptz not null,finished_at timestamptz,unique(fulfillment_id,attempt_number),unique(command_id)
);
create table public.commerce_fulfillment_targets(
 id text primary key,fulfillment_id text not null unique references public.commerce_fulfillments(id),adapter_key text not null,idempotency_key text unique not null,target_type text not null,target_id text not null,
 created_at timestamptz not null default now()
);
create table public.commerce_service_orders(
 id text primary key,commerce_order_id text not null references public.commerce_orders(id),order_line_id text not null references public.commerce_order_lines(id),
 service_type text not null,workspace_id uuid,profile_id uuid not null,property_id uuid,opportunity_id text,status text not null check(status in('awaiting-intake','ready','scheduled','in-progress','completed','cancelled')),
 assigned_to_profile_id uuid,intake_required boolean not null,requested_at timestamptz not null,due_at timestamptz,completed_at timestamptz,idempotency_key text unique not null,unique(order_line_id,service_type)
);
create table public.commerce_download_grants(
 id text primary key,entitlement_grant_id text not null references public.commerce_entitlement_grants(id),product_id text not null,asset_id text not null,profile_id uuid not null,
 order_id text not null references public.commerce_orders(id),status text not null check(status in('active','expired','revoked')),download_limit integer check(download_limit>0),
 download_count integer not null default 0 check(download_count>=0),effective_until timestamptz,created_at timestamptz not null default now(),unique(entitlement_grant_id,asset_id)
);

alter table public.commerce_product_entitlement_rules enable row level security;alter table public.commerce_entitlement_grants enable row level security;
alter table public.commerce_entitlement_history enable row level security;alter table public.commerce_entitlement_consumptions enable row level security;
alter table public.commerce_fulfillments enable row level security;alter table public.commerce_fulfillment_attempts enable row level security;
alter table public.commerce_fulfillment_targets enable row level security;alter table public.commerce_service_orders enable row level security;alter table public.commerce_download_grants enable row level security;
create policy "Active entitlement templates readable" on public.commerce_entitlement_templates for select to authenticated using(status='active'or public.is_admin());
create policy "Active entitlement rules readable" on public.commerce_product_entitlement_rules for select to authenticated using(effective_from<=now()and(effective_to is null or effective_to>now())or public.is_admin());
create policy "Entitlement subjects read grants" on public.commerce_entitlement_grants for select to authenticated using(profile_id=auth.uid()or public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Entitlement subjects read history" on public.commerce_entitlement_history for select to authenticated using(exists(select 1 from public.commerce_entitlement_grants g where g.id=grant_id and(g.profile_id=auth.uid()or public.active_workspace_role(g.workspace_id)is not null or public.is_admin())));
create policy "Entitlement subjects read consumption" on public.commerce_entitlement_consumptions for select to authenticated using(exists(select 1 from public.commerce_entitlement_grants g where g.id=grant_id and(g.profile_id=auth.uid()or public.active_workspace_role(g.workspace_id)is not null or public.is_admin())));
create policy "Fulfillment subjects read" on public.commerce_fulfillments for select to authenticated using(profile_id=auth.uid()or public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Fulfillment attempts admin read" on public.commerce_fulfillment_attempts for select to authenticated using(public.is_admin());
create policy "Fulfillment targets admin read" on public.commerce_fulfillment_targets for select to authenticated using(public.is_admin());
create policy "Service order subjects read" on public.commerce_service_orders for select to authenticated using(profile_id=auth.uid()or public.active_workspace_role(workspace_id)is not null or public.is_admin());
create policy "Download subjects read" on public.commerce_download_grants for select to authenticated using(profile_id=auth.uid()or public.is_admin());
grant select on public.commerce_product_entitlement_rules,public.commerce_entitlement_grants,public.commerce_entitlement_history,public.commerce_entitlement_consumptions,public.commerce_fulfillments,public.commerce_fulfillment_attempts,public.commerce_fulfillment_targets,public.commerce_service_orders,public.commerce_download_grants to authenticated;
create trigger commerce_entitlement_history_immutable before update or delete on public.commerce_entitlement_history for each row execute function public.prevent_commerce_history_change();
create trigger commerce_fulfillment_attempts_immutable before update or delete on public.commerce_fulfillment_attempts for each row execute function public.prevent_commerce_history_change();

create or replace function public.reserve_commerce_entitlement_credit(p_grant_id text,p_quantity integer,p_command_id text,p_subject_type text,p_subject_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.commerce_entitlement_grants%rowtype;c public.commerce_entitlement_consumptions%rowtype;
begin
 select * into c from public.commerce_entitlement_consumptions where grant_id=p_grant_id and command_id=p_command_id;if found then return to_jsonb(c);end if;
 select * into g from public.commerce_entitlement_grants where id=p_grant_id for update;
 if not found then raise exception 'commerce_entitlement_not_found' using errcode='P0001';end if;
 if auth.role()<>'service_role'and auth.uid()<>g.profile_id and public.active_workspace_role(g.workspace_id)is null and not public.is_admin()then raise exception 'commerce_permission_denied' using errcode='42501';end if;
 if g.status<>'active'or p_quantity<1 or g.remaining_quantity<p_quantity then raise exception 'commerce_entitlement_quantity_exceeded' using errcode='P0001';end if;
 update public.commerce_entitlement_grants set remaining_quantity=remaining_quantity-p_quantity,status=case when remaining_quantity-p_quantity=0 then 'consumed' else status end,revision=revision+1,updated_at=now() where id=g.id;
 insert into public.commerce_entitlement_consumptions(id,grant_id,quantity,subject_type,subject_id,command_id,status)
 values('commerce-consumption-'||md5(g.id||p_command_id),g.id,p_quantity,p_subject_type,p_subject_id,p_command_id,'reserved') returning * into c;return to_jsonb(c);
end $$;
revoke all on function public.reserve_commerce_entitlement_credit(text,integer,text,text,text) from public,anon;
grant execute on function public.reserve_commerce_entitlement_credit(text,integer,text,text,text) to authenticated,service_role;

create or replace function public.complete_commerce_entitlement_consumption(p_consumption_id text,p_action text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c public.commerce_entitlement_consumptions%rowtype;g public.commerce_entitlement_grants%rowtype;
begin
 select * into c from public.commerce_entitlement_consumptions where id=p_consumption_id for update;if not found then raise exception 'commerce_entitlement_not_found' using errcode='P0001';end if;
 select * into g from public.commerce_entitlement_grants where id=c.grant_id for update;
 if auth.role()<>'service_role'and auth.uid()<>g.profile_id and public.active_workspace_role(g.workspace_id)is null and not public.is_admin()then raise exception 'commerce_permission_denied' using errcode='42501';end if;
 if p_action='consume'then
  if c.status='consumed'then return to_jsonb(c);end if;if c.status<>'reserved'then raise exception 'commerce_idempotency_conflict' using errcode='P0001';end if;
  update public.commerce_entitlement_consumptions set status='consumed',consumed_at=now()where id=c.id returning * into c;
 elsif p_action='release'then
  if c.status='released'then return to_jsonb(c);end if;if c.status<>'reserved'then raise exception 'commerce_idempotency_conflict' using errcode='P0001';end if;
  update public.commerce_entitlement_grants set remaining_quantity=remaining_quantity+c.quantity,status='active',revision=revision+1,updated_at=now()where id=g.id and remaining_quantity+c.quantity<=quantity;
  if not found then raise exception 'commerce_entitlement_quantity_exceeded' using errcode='P0001';end if;
  update public.commerce_entitlement_consumptions set status='released',released_at=now()where id=c.id returning * into c;
 else raise exception 'commerce_idempotency_conflict' using errcode='P0001';end if;return to_jsonb(c);
end $$;
revoke all on function public.complete_commerce_entitlement_consumption(text,text)from public,anon;
grant execute on function public.complete_commerce_entitlement_consumption(text,text)to authenticated,service_role;

create or replace function public.admin_transition_commerce_entitlement(p_grant_id text,p_action text,p_expected_revision integer,p_reason text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare g public.commerce_entitlement_grants%rowtype;next_status text;
begin
 if auth.uid()is null or not public.is_admin()then raise exception 'commerce_permission_denied' using errcode='42501';end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'commerce_entitlement_reason_required' using errcode='P0001';end if;
 select * into g from public.commerce_entitlement_grants where id=p_grant_id for update;if not found then raise exception 'commerce_entitlement_not_found' using errcode='P0001';end if;
 if g.revision<>p_expected_revision then raise exception 'commerce_idempotency_conflict' using errcode='P0001';end if;
 next_status:=case p_action when'suspend'then'suspended'when'resume'then'active'when'expire'then'expired'when'revoke'then'revoked'else null end;
 if next_status is null then raise exception 'commerce_entitlement_unavailable' using errcode='P0001';end if;
 update public.commerce_entitlement_grants set status=next_status,suspension_reason=case when next_status='suspended'then p_reason else suspension_reason end,
  revocation_reason=case when next_status='revoked'then p_reason else revocation_reason end,revision=revision+1,updated_at=now()where id=g.id;
 insert into public.commerce_entitlement_history(id,grant_id,event_type,previous_status,resulting_status,reason,actor_profile_id,revision,snapshot,occurred_at)
 values('commerce-entitlement-admin-'||md5(g.id||p_action||p_expected_revision),g.id,'entitlement.'||p_action,g.status,next_status,p_reason,auth.uid(),g.revision+1,
  jsonb_build_object('grantId',g.id,'previousStatus',g.status,'resultingStatus',next_status),now())on conflict(id)do nothing;
 return jsonb_build_object('grantId',g.id,'status',next_status,'revision',g.revision+1);
end $$;
revoke all on function public.admin_transition_commerce_entitlement(text,text,integer,text)from public,anon;
grant execute on function public.admin_transition_commerce_entitlement(text,text,integer,text)to authenticated;

create or replace function public.process_commerce_fulfillment_outbox(p_outbox_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e public.commerce_outbox_events%rowtype;o public.commerce_orders%rowtype;c public.commerce_customers%rowtype;l record;t record;f public.commerce_fulfillments%rowtype;g public.commerce_entitlement_grants%rowtype;
 env text;adapter text;v_target_id text;grant_id text;template_ref text;product_id text;meta jsonb;
begin
 select * into e from public.commerce_outbox_events where id=p_outbox_id for update;if not found then raise exception 'commerce_fulfillment_not_found' using errcode='P0001';end if;
 if e.status='published'then return jsonb_build_object('status','duplicate');end if;
 update public.commerce_outbox_events set status='processing',attempts=attempts+1 where id=e.id;
 if e.event_type='order.ready-for-fulfillment'then
  select * into o from public.commerce_orders where id=e.payload->>'orderId';if o.status not in('paid','partially-refunded','refunded')then raise exception 'commerce_fulfillment_payment_required' using errcode='P0001';end if;
  select * into c from public.commerce_customers where id=o.customer_id;select environment into env from public.commerce_payments where order_id=o.id and status in('succeeded','partially-refunded','refunded')order by succeeded_at desc limit 1;
  for l in select * from public.commerce_order_lines where order_id=o.id loop
   meta:=l.product_snapshot->'metadata';product_id:=l.product_snapshot->>'id';
   adapter:=case l.product_snapshot->>'fulfillmentType' when 'analysis-credit'then'investment-analysis-credit' when 'service-project'then'guidebook-project' when 'appointment'then'notary-service-request' when 'digital-download'then'digital-download' when 'manual-fulfillment'then'manual-service-order' when 'entitlement-grant'then'entitlement-grant' else'no-op'end;
   insert into public.commerce_fulfillments(id,order_id,order_line_id,fulfillment_type,status,workspace_id,profile_id,environment,adapter_key,rule_version,idempotency_key)
   values('commerce-fulfillment-'||l.id,o.id,l.id,l.product_snapshot->>'fulfillmentType','processing',o.workspace_id,c.profile_id,env,adapter,'snapshot-v'||(l.price_snapshot->>'version'),'fulfill:'||o.id||':'||l.id||':v'||(l.price_snapshot->>'version'))
   on conflict(order_line_id,rule_version)do update set attempts=public.commerce_fulfillments.attempts returning * into f;
   update public.commerce_fulfillments set attempts=attempts+1,started_at=coalesce(started_at,now()),updated_at=now()where id=f.id;
   insert into public.commerce_fulfillment_attempts(id,fulfillment_id,attempt_number,command_id,status,started_at)
   values('commerce-attempt-'||f.id||'-'||(f.attempts+1),f.id,f.attempts+1,f.id||':'||(f.attempts+1),'processing',now())on conflict(command_id)do nothing;
   for template_ref in select jsonb_array_elements_text(coalesce(l.product_snapshot->'entitlementTemplateIds','[]'::jsonb))loop
    select * into t from public.commerce_entitlement_templates where(id=template_ref or entitlement_key=template_ref)and status='active';
    if not found then raise exception 'commerce_fulfillment_mapping_missing' using errcode='P0001';end if;
    grant_id:='commerce-grant-'||md5(o.id||l.id||t.entitlement_key);
    insert into public.commerce_entitlement_grants(id,entitlement_template_id,entitlement_key,scope_type,workspace_id,profile_id,order_id,source_type,source_id,environment,quantity,remaining_quantity,status,effective_from,effective_until,activation_reason)
    values(grant_id,t.id,t.entitlement_key,case when o.workspace_id is not null then'workspace'else'profile'end,o.workspace_id,c.profile_id,case when o.workspace_id is null then o.id end,'order',o.id,env,
      coalesce(t.default_quantity,t.grant_quantity,case when t.grant_type='credit'then l.quantity end),coalesce(t.default_quantity,t.grant_quantity,case when t.grant_type='credit'then l.quantity end),'active',now(),
      case when t.duration_policy='fixed-duration'then now()+make_interval(days=>t.default_duration_days)end,'Paid Order fulfillment')
    on conflict do nothing;
    insert into public.commerce_entitlement_history(id,grant_id,event_type,resulting_status,revision,snapshot,occurred_at)
    values('commerce-entitlement-history-'||grant_id,grant_id,'entitlement.granted','active',1,jsonb_build_object('orderId',o.id,'orderLineId',l.id,'templateKey',t.entitlement_key),now())on conflict(id)do nothing;
   end loop;
   if adapter in('guidebook-project','notary-service-request','manual-service-order')then
    v_target_id:='commerce-service-'||md5(f.idempotency_key);
    insert into public.commerce_service_orders(id,commerce_order_id,order_line_id,service_type,workspace_id,profile_id,property_id,opportunity_id,status,intake_required,requested_at,idempotency_key)
    values(v_target_id,o.id,l.id,adapter,o.workspace_id,c.profile_id,nullif(meta->>'propertyId','')::uuid,nullif(meta->>'opportunityId',''),'awaiting-intake',true,now(),f.idempotency_key)on conflict(idempotency_key)do nothing;
   elsif adapter='investment-analysis-credit'then v_target_id:=coalesce(grant_id,'commerce-credit-'||md5(f.idempotency_key));
   elsif adapter='digital-download'then
    if nullif(meta->>'assetId','')is null then raise exception 'commerce_fulfillment_mapping_missing' using errcode='P0001';end if;v_target_id:='commerce-download-'||md5(f.idempotency_key);
    insert into public.commerce_download_grants(id,entitlement_grant_id,product_id,asset_id,profile_id,order_id,status,download_limit,created_at)
    values(v_target_id,grant_id,product_id,meta->>'assetId',c.profile_id,o.id,'active',nullif(meta->>'downloadLimit','')::integer,now())on conflict(entitlement_grant_id,asset_id)do nothing;
   else v_target_id:=coalesce(grant_id,'commerce-noop-'||md5(f.idempotency_key));end if;
   insert into public.commerce_fulfillment_targets(id,fulfillment_id,adapter_key,idempotency_key,target_type,target_id)
   values('commerce-target-'||f.id,f.id,adapter,f.idempotency_key,case when adapter='investment-analysis-credit'then'credit'when adapter='digital-download'then'download'when adapter in('guidebook-project','notary-service-request','manual-service-order')then'service-order'else'entitlement'end,v_target_id)
   on conflict(idempotency_key)do nothing;
   update public.commerce_fulfillments set status=case when adapter in('guidebook-project','notary-service-request','manual-service-order')then'ready'else'completed'end,target_type=case when adapter in('guidebook-project','notary-service-request','manual-service-order')then'service-order'else adapter end,target_id=v_target_id,completed_at=now(),updated_at=now()where id=f.id;
   update public.commerce_fulfillment_attempts set status='completed',target_id=v_target_id,finished_at=now()where fulfillment_id=f.id and attempt_number=f.attempts+1;
  end loop;
 elsif e.event_type='subscription.entitlements-reconcile'then
  insert into public.commerce_fulfillments(id,subscription_id,fulfillment_type,status,workspace_id,profile_id,environment,adapter_key,rule_version,idempotency_key)
  select 'commerce-fulfillment-sub-'||s.id||'-'||s.revision,s.id,'entitlement-grant','completed',s.workspace_id,c.profile_id,s.environment,'entitlement-grant',s.revision::text,'subscription:'||s.id||':v'||s.revision
  from public.commerce_subscriptions s join public.commerce_customers c on c.id=s.customer_id where s.id=e.payload->>'subscriptionId'on conflict(idempotency_key)do nothing;
  insert into public.commerce_entitlement_grants(id,entitlement_template_id,entitlement_key,scope_type,workspace_id,profile_id,source_type,source_id,environment,quantity,remaining_quantity,status,effective_from,effective_until,activation_reason)
  select 'commerce-grant-'||md5(s.id||r.id),t.id,t.entitlement_key,t.scope_type,s.workspace_id,c.profile_id,'subscription',s.id,s.environment,coalesce(r.quantity,t.default_quantity),coalesce(r.quantity,t.default_quantity),
   case when s.status in('active','trialing')or s.cancel_at_period_end then'active'when s.status='past-due'and now()<s.current_period_end+make_interval(days=>r.past_due_grace_days)then'active'when s.status in('paused','unpaid','past-due')then'suspended'else'expired'end,
   s.current_period_start,case when s.status='past-due'then s.current_period_end+make_interval(days=>r.past_due_grace_days)else s.current_period_end end,'Subscription reconciliation'
  from public.commerce_subscriptions s join public.commerce_customers c on c.id=s.customer_id join public.commerce_product_entitlement_rules r on r.product_id=s.product_id
  join public.commerce_entitlement_templates t on t.id=r.entitlement_template_id where s.id=e.payload->>'subscriptionId'and r.activation_trigger in('subscription-active','subscription-renewed')
  on conflict do nothing;
  update public.commerce_entitlement_grants g set status=case when s.status in('active','trialing')or s.cancel_at_period_end then'active'
    when s.status='past-due'and now()<s.current_period_end+make_interval(days=>r.past_due_grace_days)then'active'when s.status in('paused','unpaid','past-due')then'suspended'else'expired'end,
    effective_until=case when s.status='past-due'then s.current_period_end+make_interval(days=>r.past_due_grace_days)else s.current_period_end end,revision=g.revision+1,updated_at=now()
  from public.commerce_subscriptions s join public.commerce_product_entitlement_rules r on r.product_id=s.product_id
  where g.source_type='subscription'and g.source_id=s.id and g.entitlement_template_id=r.entitlement_template_id and s.id=e.payload->>'subscriptionId';
 elsif e.event_type='order.refund-effects-review'then
  insert into public.commerce_fulfillments(id,order_id,order_line_id,fulfillment_type,status,workspace_id,profile_id,environment,adapter_key,rule_version,idempotency_key,failure_code,failure_message)
  select 'commerce-refund-review-'||l.id||'-'||(e.payload->>'orderRevision'),o.id,l.id,l.product_snapshot->>'fulfillmentType','manual-review',o.workspace_id,c.profile_id,
   coalesce(p.environment,'test'),'manual-service-order',e.payload->>'orderRevision','refund-review:'||o.id||':'||l.id||':'||(e.payload->>'orderRevision'),'commerce_refund_policy_review_required','Refund effects require product-policy review.'
  from public.commerce_orders o join public.commerce_customers c on c.id=o.customer_id join public.commerce_order_lines l on l.order_id=o.id
  left join lateral(select environment from public.commerce_payments where order_id=o.id order by succeeded_at desc limit 1)p on true where o.id=e.payload->>'orderId'on conflict(idempotency_key)do nothing;
 end if;
 update public.commerce_outbox_events set status='published',published_at=now()where id=e.id;return jsonb_build_object('status','published','eventId',e.id);
exception when others then update public.commerce_outbox_events set status='failed',last_error=sqlerrm where id=p_outbox_id;return jsonb_build_object('status','failed','errorCode',sqlerrm);end $$;
revoke all on function public.process_commerce_fulfillment_outbox(text)from public,anon,authenticated;grant execute on function public.process_commerce_fulfillment_outbox(text)to service_role;

create or replace function public.process_pending_commerce_fulfillment(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path=public as $$
declare e record;processed integer:=0;begin for e in select id from public.commerce_outbox_events where status in('pending','failed')and event_type in('order.ready-for-fulfillment','subscription.entitlements-reconcile','order.refund-effects-review')order by created_at limit least(greatest(p_limit,1),100)
loop perform public.process_commerce_fulfillment_outbox(e.id);processed:=processed+1;end loop;return jsonb_build_object('processed',processed);end $$;
revoke all on function public.process_pending_commerce_fulfillment(integer)from public,anon,authenticated;grant execute on function public.process_pending_commerce_fulfillment(integer)to service_role;

insert into public.commerce_entitlement_templates(id,entitlement_key,name,description,scope_type,grant_type,duration_policy,default_quantity,status,metadata)
values
 ('entitlement-investment-analysis-create','investment.analysis.create','Create investment analyses','Allows creation of investment decision analyses.','workspace','capability','until-revoked',null,'active','{}'),
 ('entitlement-investment-analysis-credit','investment.analysis.credit','Investment analysis credit','One consumable investment analysis credit.','workspace','credit','single-use',1,'active','{}'),
 ('entitlement-investment-scenarios-create','investment.scenarios.create','Create investment scenarios','Allows scenario creation.','workspace','capability','subscription-period',null,'active','{}'),
 ('entitlement-investment-reports-generate','investment.reports.generate','Generate investment reports','Allows investment report generation.','workspace','capability','subscription-period',null,'active','{}'),
 ('entitlement-portfolio-intelligence-use','portfolio_intelligence.use','Portfolio Intelligence','Allows Portfolio Intelligence access.','workspace','capability','subscription-period',null,'active','{}'),
 ('entitlement-financial-intelligence-use','financial_intelligence.use','Financial Intelligence','Allows Financial Intelligence access.','workspace','capability','subscription-period',null,'active','{}'),
 ('entitlement-reports-generate','reports.generate','Generate reports','Allows report generation.','workspace','capability','subscription-period',null,'active','{}'),
 ('entitlement-guidebooks-create','guidebooks.create','Create guidebooks','Allows guidebook creation.','workspace','capability','subscription-period',null,'active','{}'),
 ('entitlement-guidebooks-publish','guidebooks.publish','Publish guidebooks','Allows guidebook publishing.','property','capability','subscription-period',null,'active','{}'),
 ('entitlement-guidebooks-host','guidebooks.host','Host guidebooks','Allows guidebook hosting.','property','capability','subscription-period',null,'active','{}'),
 ('entitlement-guest-communications-use','guest_communications.use','Guest Communications','Allows Guest Communications access.','workspace','capability','subscription-period',null,'active','{}'),
 ('entitlement-learning-intelligence-use','learning_intelligence.use','Learning Intelligence','Allows Learning Intelligence access.','workspace','capability','subscription-period',null,'active','{}'),
 ('entitlement-press-download','press.download','Press download','Allows a protected digital download.','profile','download','until-revoked',null,'active','{}'),
 ('entitlement-notary-request','notary.request','Notary request','Allows one notary service request.','profile','credit','single-use',1,'active','{}'),
 ('entitlement-commerce-billing-manage','commerce.billing.manage','Manage billing','Allows Billing Portal access.','workspace','capability','subscription-period',null,'active','{}')
on conflict(entitlement_key)do nothing;
