-- PC-001C.3: verified provider receipts, canonical payments/refunds, and transactional fulfillment handoff.
alter table public.commerce_orders drop constraint if exists commerce_orders_status_check;
alter table public.commerce_orders add constraint commerce_orders_status_check check(status in(
  'draft','pending-payment','payment-processing','paid','payment-failed',
  'partially-refunded','refunded','cancelled','expired'
));
alter table public.commerce_orders
  add column if not exists payment_status text,
  add column if not exists paid_at timestamptz,
  add column if not exists refunded_amount_minor bigint not null default 0 check(refunded_amount_minor >= 0),
  add column if not exists finalized_subtotal_minor bigint,
  add column if not exists finalized_discount_minor bigint,
  add column if not exists finalized_tax_minor bigint,
  add column if not exists finalized_total_minor bigint,
  add column if not exists revision integer not null default 1 check(revision > 0);

drop trigger if exists commerce_checkout_sessions_immutable on public.commerce_checkout_sessions;
alter table public.commerce_checkout_sessions
  drop constraint if exists commerce_checkout_sessions_status_check;
alter table public.commerce_checkout_sessions
  add constraint commerce_checkout_sessions_status_check check(status in('created','open','completed','expired','cancelled','pending')),
  add column if not exists provider_payment_intent_id text,
  add column if not exists provider_subscription_id text,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
create unique index if not exists commerce_checkout_payment_intent_uidx
  on public.commerce_checkout_sessions(environment,provider_payment_intent_id) where provider_payment_intent_id is not null;

create table public.commerce_payments(
  id text primary key, order_id text not null references public.commerce_orders(id), customer_id text not null references public.commerce_customers(id),
  workspace_id uuid, provider text not null check(provider='stripe'), environment text not null check(environment in('test','live')),
  provider_payment_intent_id text, provider_charge_id text, amount_minor bigint not null check(amount_minor >= 0),
  captured_amount_minor bigint check(captured_amount_minor >= 0), refunded_amount_minor bigint not null default 0 check(refunded_amount_minor >= 0),
  currency text not null check(currency ~ '^[A-Z]{3}$'), status text not null check(status in('pending','processing','succeeded','failed','cancelled','partially-refunded','refunded','unknown')),
  failure_code text, failure_message text, attempt_number integer not null check(attempt_number > 0), provider_created_at timestamptz,
  processing_at timestamptz, succeeded_at timestamptz, failed_at timestamptz, cancelled_at timestamptz, refunded_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(refunded_amount_minor <= coalesce(captured_amount_minor,amount_minor))
);
create unique index commerce_payments_intent_uidx on public.commerce_payments(provider,environment,provider_payment_intent_id) where provider_payment_intent_id is not null;
create unique index commerce_payments_charge_uidx on public.commerce_payments(provider,environment,provider_charge_id) where provider_charge_id is not null;
create index commerce_payments_order_idx on public.commerce_payments(order_id,attempt_number);

create table public.commerce_refunds(
  id text primary key, payment_id text not null references public.commerce_payments(id), order_id text not null references public.commerce_orders(id),
  provider text not null check(provider='stripe'), environment text not null check(environment in('test','live')), provider_refund_id text not null,
  amount_minor bigint not null check(amount_minor >= 0), currency text not null check(currency ~ '^[A-Z]{3}$'),
  status text not null check(status in('pending','succeeded','failed','cancelled')), reason text, provider_created_at timestamptz,
  succeeded_at timestamptz, failed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(provider,environment,provider_refund_id)
);

create table public.commerce_webhook_receipts(
  id text primary key, provider text not null check(provider='stripe'), environment text not null check(environment in('test','live')),
  provider_event_id text not null, provider_event_type text not null, provider_created_at timestamptz,
  status text not null check(status in('received','verified','processing','processed','ignored','failed')), attempts integer not null default 0 check(attempts >= 0),
  related_order_id text references public.commerce_orders(id), related_customer_id text references public.commerce_customers(id),
  normalized_event_type text, received_at timestamptz not null default now(), verified_at timestamptz, processing_started_at timestamptz,
  normalized_event jsonb,
  processed_at timestamptz, locked_at timestamptz, locked_by text, lease_expires_at timestamptz,
  last_error_code text, last_error_message text, ignored_reason text,
  unique(provider,environment,provider_event_id)
);
create index commerce_webhook_work_idx on public.commerce_webhook_receipts(status,received_at);

create table public.commerce_command_receipts(
  id text primary key, order_id text not null references public.commerce_orders(id), command_type text not null,
  provider_reference text not null, result jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  unique(order_id,command_type,provider_reference)
);
create table public.commerce_outbox_events(
  id text primary key, aggregate_type text not null check(aggregate_type in('order','payment')), aggregate_id text not null,
  event_type text not null, payload_version text not null, payload jsonb not null, status text not null check(status in('pending','processing','published','failed')),
  attempts integer not null default 0 check(attempts >= 0), created_at timestamptz not null default now(), published_at timestamptz, last_error text,
  unique(aggregate_id,event_type,payload_version)
);
create table public.commerce_activity(
  id text primary key, order_id text not null references public.commerce_orders(id), payment_id text references public.commerce_payments(id),
  receipt_id text references public.commerce_webhook_receipts(id), event_type text not null, source text not null,
  summary text not null, resulting_state text, occurred_at timestamptz not null, created_at timestamptz not null default now()
);
create index commerce_activity_order_idx on public.commerce_activity(order_id,occurred_at,id);

alter table public.commerce_payments enable row level security;
alter table public.commerce_refunds enable row level security;
alter table public.commerce_webhook_receipts enable row level security;
alter table public.commerce_command_receipts enable row level security;
alter table public.commerce_outbox_events enable row level security;
alter table public.commerce_activity enable row level security;

create policy "Commerce payment owner reads" on public.commerce_payments for select to authenticated using(
  exists(select 1 from public.commerce_customers c where c.id=customer_id and(c.profile_id=auth.uid() or public.is_admin()))
);
create policy "Commerce refund owner reads" on public.commerce_refunds for select to authenticated using(
  exists(select 1 from public.commerce_orders o join public.commerce_customers c on c.id=o.customer_id where o.id=order_id and(c.profile_id=auth.uid() or public.is_admin()))
);
create policy "Commerce activity owner reads" on public.commerce_activity for select to authenticated using(
  exists(select 1 from public.commerce_orders o join public.commerce_customers c on c.id=o.customer_id where o.id=order_id and(c.profile_id=auth.uid() or public.is_admin()))
);
create policy "Commerce webhook admins read" on public.commerce_webhook_receipts for select to authenticated using(public.is_admin());
create policy "Commerce outbox admins read" on public.commerce_outbox_events for select to authenticated using(public.is_admin());
create policy "Commerce command admins read" on public.commerce_command_receipts for select to authenticated using(public.is_admin());
grant select on public.commerce_payments,public.commerce_refunds,public.commerce_activity to authenticated;
grant select on public.commerce_webhook_receipts,public.commerce_outbox_events,public.commerce_command_receipts to authenticated;

create or replace function public.process_commerce_provider_event(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_receipt_id text := 'commerce-receipt-' || (p_event->>'providerEventId');
  v_order public.commerce_orders%rowtype;
  v_checkout public.commerce_checkout_sessions%rowtype;
  v_payment public.commerce_payments%rowtype;
  v_event_type text := p_event->>'eventType';
  v_order_id text := nullif(p_event->>'internalOrderId','');
  v_environment text := p_event->>'environment';
  v_amount bigint := nullif(p_event->>'amountMinor','')::bigint;
  v_currency text := upper(nullif(p_event->>'currency',''));
  v_payment_id text;
  v_next_status text;
  v_new_revision integer;
begin
  insert into public.commerce_webhook_receipts(
    id,provider,environment,provider_event_id,provider_event_type,provider_created_at,status,attempts,
    normalized_event_type,received_at,verified_at,processing_started_at
  ) values(
    v_receipt_id,'stripe',v_environment,p_event->>'providerEventId',p_event->>'providerEventType',
    (p_event->>'providerCreatedAt')::timestamptz,'processing',1,v_event_type,now(),now(),now()
  ) on conflict(provider,environment,provider_event_id) do nothing;
  if not found then
    if exists(select 1 from public.commerce_webhook_receipts where id=v_receipt_id and status in('processed','ignored')) then
      return jsonb_build_object('status','duplicate','receiptId',v_receipt_id);
    end if;
    update public.commerce_webhook_receipts set status='processing',attempts=attempts+1,processing_started_at=now(),
      locked_at=now(),locked_by='commerce-webhook',lease_expires_at=now()+interval '2 minutes' where id=v_receipt_id;
  end if;

  if v_event_type='unsupported' then
    update public.commerce_webhook_receipts set status='ignored',processed_at=now(),ignored_reason='Event is outside PC-001C.3 scope' where id=v_receipt_id;
    return jsonb_build_object('status','ignored','receiptId',v_receipt_id);
  end if;

  if v_order_id is null and nullif(p_event->>'providerCheckoutSessionId','') is not null then
    select * into v_checkout from public.commerce_checkout_sessions
      where provider_session_id=p_event->>'providerCheckoutSessionId' and environment=v_environment;
    v_order_id := v_checkout.order_id;
  end if;
  if v_order_id is null and nullif(p_event->>'providerPaymentIntentId','') is not null then
    select order_id into v_order_id from public.commerce_payments
      where provider='stripe' and environment=v_environment and provider_payment_intent_id=p_event->>'providerPaymentIntentId';
  end if;
  if v_order_id is null and nullif(p_event->>'providerChargeId','') is not null then
    select order_id into v_order_id from public.commerce_payments
      where provider='stripe' and environment=v_environment and provider_charge_id=p_event->>'providerChargeId';
  end if;
  if v_order_id is null then raise exception 'commerce_order_not_found' using errcode='P0001'; end if;

  select * into v_order from public.commerce_orders where id=v_order_id for update;
  if not found then raise exception 'commerce_order_not_found' using errcode='P0001'; end if;
  if exists(select 1 from public.commerce_checkout_sessions where order_id=v_order.id and environment<>v_environment) then raise exception 'commerce_environment_mismatch' using errcode='P0001'; end if;
  if v_checkout.id is not null and v_checkout.order_id<>v_order.id then raise exception 'commerce_order_resolution_ambiguous' using errcode='P0001'; end if;
  if nullif(p_event->>'internalCustomerId','') is not null and p_event->>'internalCustomerId'<>v_order.customer_id then raise exception 'commerce_customer_mismatch' using errcode='P0001'; end if;
  if nullif(p_event->>'workspaceId','') is not null and (v_order.workspace_id is null or p_event->>'workspaceId'<>v_order.workspace_id::text) then raise exception 'commerce_workspace_mismatch' using errcode='P0001'; end if;
  if v_currency is not null and v_currency<>upper(v_order.currency) then raise exception 'commerce_currency_mismatch' using errcode='P0001'; end if;
  if v_amount is not null and v_event_type in('payment.succeeded','subscription.checkout.completed') and v_amount<>v_order.total_minor then raise exception 'commerce_amount_mismatch' using errcode='P0001'; end if;

  if nullif(p_event->>'providerCheckoutSessionId','') is not null then
    update public.commerce_checkout_sessions set
      status=case when v_event_type='checkout.expired' then 'expired' when v_event_type in('checkout.completed','subscription.checkout.completed','payment.succeeded') then 'completed' else status end,
      provider_payment_intent_id=coalesce(nullif(p_event->>'providerPaymentIntentId',''),provider_payment_intent_id),
      provider_subscription_id=coalesce(nullif(p_event->>'providerSubscriptionId',''),provider_subscription_id),
      completed_at=case when v_event_type in('checkout.completed','subscription.checkout.completed','payment.succeeded') then coalesce(completed_at,now()) else completed_at end,
      updated_at=now()
    where provider_session_id=p_event->>'providerCheckoutSessionId' and environment=v_environment;
  end if;

  if v_event_type in('checkout.completed','subscription.checkout.completed','payment.processing','payment.succeeded','payment.failed','payment.cancelled') then
    v_payment_id := 'commerce-payment-' || coalesce(nullif(p_event->>'providerPaymentIntentId',''),p_event->>'providerEventId');
    select * into v_payment from public.commerce_payments where provider='stripe' and environment=v_environment
      and provider_payment_intent_id=nullif(p_event->>'providerPaymentIntentId','') for update;
    if not found then
      insert into public.commerce_payments(
        id,order_id,customer_id,workspace_id,provider,environment,provider_payment_intent_id,provider_charge_id,
        amount_minor,captured_amount_minor,currency,status,attempt_number,provider_created_at,created_at,updated_at
      ) values(
        v_payment_id,v_order.id,v_order.customer_id,v_order.workspace_id,'stripe',v_environment,
        nullif(p_event->>'providerPaymentIntentId',''),nullif(p_event->>'providerChargeId',''),
        coalesce(v_amount,v_order.total_minor),case when (p_event->>'paymentStatus')='succeeded' or v_event_type='payment.succeeded' then coalesce(v_amount,v_order.total_minor) end,
        coalesce(v_currency,v_order.currency),
        case when (p_event->>'paymentStatus')='succeeded' or v_event_type='payment.succeeded' then 'succeeded'
             when v_event_type='payment.failed' then 'failed' when v_event_type='payment.cancelled' then 'cancelled' else 'processing' end,
        coalesce((select max(attempt_number)+1 from public.commerce_payments where order_id=v_order.id),1),
        (p_event->>'providerCreatedAt')::timestamptz,now(),now()
      ) returning * into v_payment;
    else
      v_payment_id := v_payment.id;
      if v_payment.order_id<>v_order.id then raise exception 'commerce_order_resolution_ambiguous' using errcode='P0001'; end if;
      update public.commerce_payments set
        provider_charge_id=coalesce(nullif(p_event->>'providerChargeId',''),provider_charge_id),
        status=case when status in('partially-refunded','refunded') then status
          when (p_event->>'paymentStatus')='succeeded' or v_event_type='payment.succeeded' then 'succeeded'
          when v_event_type='payment.failed' and status<>'succeeded' then 'failed'
          when v_event_type='payment.cancelled' and status<>'succeeded' then 'cancelled'
          when status<>'succeeded' then 'processing' else status end,
        captured_amount_minor=case when (p_event->>'paymentStatus')='succeeded' or v_event_type='payment.succeeded' then coalesce(v_amount,amount_minor) else captured_amount_minor end,
        processing_at=case when v_event_type in('checkout.completed','subscription.checkout.completed','payment.processing') then coalesce(processing_at,now()) else processing_at end,
        succeeded_at=case when (p_event->>'paymentStatus')='succeeded' or v_event_type='payment.succeeded' then coalesce(succeeded_at,now()) else succeeded_at end,
        failed_at=case when v_event_type='payment.failed' then coalesce(failed_at,now()) else failed_at end,
        failure_code=case when v_event_type='payment.failed' then nullif(p_event->>'failureCode','') else failure_code end,
        updated_at=now()
      where id=v_payment_id returning * into v_payment;
    end if;
    v_next_status := case when v_payment.status='succeeded' then 'paid' when v_payment.status='failed' then 'payment-failed'
      when v_payment.status='cancelled' then 'cancelled' else 'payment-processing' end;
  elsif v_event_type='checkout.expired' then
    v_next_status := case when v_order.status='paid' then 'paid' else 'expired' end;
  elsif v_event_type='refund.updated' then
    select * into v_payment from public.commerce_payments where order_id=v_order.id
      and (provider_payment_intent_id=nullif(p_event->>'providerPaymentIntentId','') or provider_charge_id=nullif(p_event->>'providerChargeId',''))
      order by succeeded_at desc nulls last limit 1 for update;
    if not found then raise exception 'commerce_reconciliation_required' using errcode='P0001'; end if;
    v_payment_id:=v_payment.id;
    if nullif(p_event->>'providerRefundId','') is not null then
      insert into public.commerce_refunds(id,payment_id,order_id,provider,environment,provider_refund_id,amount_minor,currency,status,provider_created_at,succeeded_at,failed_at)
      values('commerce-refund-'||(p_event->>'providerRefundId'),v_payment.id,v_order.id,'stripe',v_environment,p_event->>'providerRefundId',
        coalesce((p_event->>'refundedAmountMinor')::bigint,0),coalesce(v_currency,v_payment.currency),coalesce(p_event->>'refundStatus','pending'),
        (p_event->>'providerCreatedAt')::timestamptz,case when p_event->>'refundStatus'='succeeded' then now() end,case when p_event->>'refundStatus'='failed' then now() end)
      on conflict(provider,environment,provider_refund_id) do update set status=excluded.status,succeeded_at=excluded.succeeded_at,failed_at=excluded.failed_at,updated_at=now();
    end if;
    select coalesce(sum(amount_minor),0) into v_amount from public.commerce_refunds where payment_id=v_payment.id and status='succeeded';
    if v_amount>coalesce(v_payment.captured_amount_minor,v_payment.amount_minor) then raise exception 'commerce_refund_exceeds_payment' using errcode='P0001'; end if;
    update public.commerce_payments set refunded_amount_minor=v_amount,
      status=case when v_amount=0 then status when v_amount=coalesce(captured_amount_minor,amount_minor) then 'refunded' else 'partially-refunded' end,
      refunded_at=case when v_amount>0 then now() else refunded_at end,updated_at=now() where id=v_payment.id;
    v_next_status:=case when v_amount=coalesce(v_payment.captured_amount_minor,v_payment.amount_minor) then 'refunded' else 'partially-refunded' end;
  end if;

  if v_next_status is not null and v_order.status not in('refunded') then
    if v_order.status='paid' and v_next_status in('payment-processing','payment-failed','expired','cancelled') then v_next_status:='paid'; end if;
    if v_order.status='partially-refunded' and v_next_status not in('refunded','partially-refunded') then v_next_status:='partially-refunded'; end if;
    v_new_revision:=v_order.revision+case when v_order.status<>v_next_status then 1 else 0 end;
    update public.commerce_orders set status=v_next_status,payment_status=case when v_payment_id is null then payment_status else (select status from public.commerce_payments where id=v_payment_id) end,
      paid_at=case when v_next_status='paid' then coalesce(paid_at,now()) else paid_at end,
      refunded_amount_minor=case when v_next_status in('partially-refunded','refunded') then coalesce(v_amount,refunded_amount_minor) else refunded_amount_minor end,
      finalized_subtotal_minor=case when v_next_status='paid' then coalesce(finalized_subtotal_minor,subtotal_minor) else finalized_subtotal_minor end,
      finalized_discount_minor=case when v_next_status='paid' then coalesce(finalized_discount_minor,0) else finalized_discount_minor end,
      finalized_tax_minor=case when v_next_status='paid' then coalesce(finalized_tax_minor,0) else finalized_tax_minor end,
      finalized_total_minor=case when v_next_status='paid' then coalesce(finalized_total_minor,total_minor) else finalized_total_minor end,
      revision=v_new_revision,updated_at=now() where id=v_order.id;
  else v_new_revision:=v_order.revision; end if;

  insert into public.commerce_activity(id,order_id,payment_id,receipt_id,event_type,source,summary,resulting_state,occurred_at)
    values('commerce-activity-'||(p_event->>'providerEventId'),v_order.id,v_payment_id,v_receipt_id,v_event_type,'stripe',
      'Verified provider event applied.',coalesce(v_next_status,v_order.status),(p_event->>'providerCreatedAt')::timestamptz)
    on conflict(id) do nothing;
  if v_next_status='paid' then
    insert into public.commerce_outbox_events(id,aggregate_type,aggregate_id,event_type,payload_version,payload,status)
      values('commerce-outbox-order-ready-'||v_order.id||'-'||v_new_revision,'order',v_order.id,'order.ready-for-fulfillment',
        v_new_revision::text,jsonb_build_object('orderId',v_order.id,'customerId',v_order.customer_id,'workspaceId',v_order.workspace_id,'paymentId',v_payment_id,'orderRevision',v_new_revision),'pending')
      on conflict(aggregate_id,event_type,payload_version) do nothing;
  end if;
  if v_next_status in('partially-refunded','refunded') then
    insert into public.commerce_outbox_events(id,aggregate_type,aggregate_id,event_type,payload_version,payload,status)
      values('commerce-outbox-order-refund-'||v_order.id||'-'||v_new_revision,'order',v_order.id,'order.refund-effects-review',
        v_new_revision::text,jsonb_build_object('orderId',v_order.id,'orderRevision',v_new_revision,'refundStatus',v_next_status),'pending')
      on conflict(aggregate_id,event_type,payload_version) do nothing;
  end if;
  update public.commerce_webhook_receipts set status='processed',related_order_id=v_order.id,related_customer_id=v_order.customer_id,processed_at=now() where id=v_receipt_id;
  return jsonb_build_object('status','processed','receiptId',v_receipt_id,'orderId',v_order.id,'orderStatus',coalesce(v_next_status,v_order.status));
exception when others then
  update public.commerce_webhook_receipts set status='failed',last_error_code=sqlerrm,last_error_message='Provider event requires operational review.',processed_at=now() where id=v_receipt_id;
  return jsonb_build_object('status','failed','receiptId',v_receipt_id,'errorCode',sqlerrm);
end $$;
revoke all on function public.process_commerce_provider_event(jsonb) from public,anon,authenticated;
grant execute on function public.process_commerce_provider_event(jsonb) to service_role;
