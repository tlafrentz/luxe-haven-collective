-- PC-001C.4: provider-neutral subscription and invoice projections with immutable history.
create table public.commerce_subscriptions(
  id text primary key,
  customer_id text not null references public.commerce_customers(id),
  workspace_id uuid not null,
  product_id text not null references public.commerce_products(id),
  offer_id text references public.commerce_offers(id),
  price_id text not null references public.commerce_prices(id),
  provider text not null check(provider='stripe'),
  environment text not null check(environment in('test','live')),
  provider_subscription_id text not null,
  status text not null check(status in('incomplete','trialing','active','past-due','paused','cancelled','expired','unpaid')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  revision integer not null default 1 check(revision>0),
  last_synchronized_at timestamptz not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(provider,environment,provider_subscription_id),
  check(current_period_end>=current_period_start)
);
create unique index commerce_primary_workspace_subscription_uidx on public.commerce_subscriptions(workspace_id,environment)
  where status in('incomplete','trialing','active','past-due','paused','unpaid');
create index commerce_subscription_customer_idx on public.commerce_subscriptions(customer_id,updated_at desc);

create table public.commerce_subscription_history(
  id text primary key,
  subscription_id text not null references public.commerce_subscriptions(id),
  receipt_id text references public.commerce_webhook_receipts(id),
  event_type text not null,
  previous_status text,
  resulting_status text not null,
  previous_price_id text,
  resulting_price_id text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  cancel_at_period_end boolean not null,
  revision integer not null check(revision>0),
  occurred_at timestamptz not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index commerce_subscription_history_idx on public.commerce_subscription_history(subscription_id,revision);

create table public.commerce_invoices(
  id text primary key,
  subscription_id text not null references public.commerce_subscriptions(id),
  customer_id text not null references public.commerce_customers(id),
  workspace_id uuid not null,
  provider text not null check(provider='stripe'),
  environment text not null check(environment in('test','live')),
  provider_invoice_id text not null,
  invoice_number text,
  amount_minor bigint not null check(amount_minor>=0),
  currency text not null check(currency~'^[A-Z]{3}$'),
  status text not null check(status in('draft','open','paid','void','uncollectible')),
  hosted_invoice_url text,
  invoice_pdf_url text,
  period_start timestamptz,
  period_end timestamptz,
  due_at timestamptz,
  next_payment_attempt_at timestamptz,
  paid_at timestamptz,
  last_synchronized_at timestamptz not null,
  created_at timestamptz not null,
  unique(provider,environment,provider_invoice_id)
);
create index commerce_invoice_subscription_idx on public.commerce_invoices(subscription_id,created_at desc);

create table public.commerce_invoice_revisions(
  id text primary key,
  invoice_id text not null references public.commerce_invoices(id),
  receipt_id text references public.commerce_webhook_receipts(id),
  provider_event_id text not null,
  revision integer not null check(revision>0),
  status text not null,
  snapshot jsonb not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(invoice_id,provider_event_id)
);
create index commerce_invoice_revisions_idx on public.commerce_invoice_revisions(invoice_id,revision);

create table public.commerce_billing_portal_sessions(
  id text primary key,
  customer_id text not null references public.commerce_customers(id),
  workspace_id uuid not null,
  provider text not null check(provider='stripe'),
  environment text not null check(environment in('test','live')),
  provider_portal_session_id text not null,
  return_url text not null,
  status text not null check(status in('created','expired')),
  expires_at timestamptz,
  created_at timestamptz not null,
  unique(provider,environment,provider_portal_session_id)
);
create table public.commerce_payment_method_summaries(
  id text primary key,
  customer_id text not null references public.commerce_customers(id),
  workspace_id uuid not null,
  provider text not null check(provider='stripe'),
  environment text not null check(environment in('test','live')),
  provider_payment_method_id text not null,
  brand text not null,
  last_four text not null check(last_four~'^[0-9]{4}$'),
  expiration_month integer not null check(expiration_month between 1 and 12),
  expiration_year integer not null check(expiration_year>=2020),
  last_synchronized_at timestamptz not null,
  unique(provider,environment,provider_payment_method_id),
  unique(customer_id,environment)
);

alter table public.commerce_subscriptions enable row level security;
alter table public.commerce_subscription_history enable row level security;
alter table public.commerce_invoices enable row level security;
alter table public.commerce_invoice_revisions enable row level security;
alter table public.commerce_billing_portal_sessions enable row level security;
alter table public.commerce_payment_method_summaries enable row level security;
create policy "Billing workspace subscription reads" on public.commerce_subscriptions for select to authenticated using(
  exists(select 1 from public.commerce_customers c where c.id=customer_id and(c.profile_id=auth.uid() or public.is_admin()))
);
create policy "Billing workspace subscription history reads" on public.commerce_subscription_history for select to authenticated using(
  exists(select 1 from public.commerce_subscriptions s join public.commerce_customers c on c.id=s.customer_id where s.id=subscription_id and(c.profile_id=auth.uid() or public.is_admin()))
);
create policy "Billing workspace invoice reads" on public.commerce_invoices for select to authenticated using(
  exists(select 1 from public.commerce_customers c where c.id=customer_id and(c.profile_id=auth.uid() or public.is_admin()))
);
create policy "Billing workspace invoice revision reads" on public.commerce_invoice_revisions for select to authenticated using(
  exists(select 1 from public.commerce_invoices i join public.commerce_customers c on c.id=i.customer_id where i.id=invoice_id and(c.profile_id=auth.uid() or public.is_admin()))
);
create policy "Billing Portal session owner reads" on public.commerce_billing_portal_sessions for select to authenticated using(
  exists(select 1 from public.commerce_customers c where c.id=customer_id and(c.profile_id=auth.uid() or public.is_admin()))
);
create policy "Billing payment method owner reads" on public.commerce_payment_method_summaries for select to authenticated using(
  exists(select 1 from public.commerce_customers c where c.id=customer_id and(c.profile_id=auth.uid() or public.is_admin()))
);
grant select on public.commerce_subscriptions,public.commerce_subscription_history,public.commerce_invoices,public.commerce_invoice_revisions,public.commerce_billing_portal_sessions,public.commerce_payment_method_summaries to authenticated;

create trigger commerce_subscription_history_immutable before update or delete on public.commerce_subscription_history for each row execute function public.prevent_commerce_history_change();
create trigger commerce_invoice_revisions_immutable before update or delete on public.commerce_invoice_revisions for each row execute function public.prevent_commerce_history_change();

create or replace function public.process_commerce_billing_event(p_event jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_receipt_id text := 'commerce-receipt-'||(p_event->>'providerEventId');
  v_type text := p_event->>'eventType';
  v_environment text := p_event->>'environment';
  v_customer public.commerce_customers%rowtype;
  v_subscription public.commerce_subscriptions%rowtype;
  v_invoice public.commerce_invoices%rowtype;
  v_checkout public.commerce_checkout_sessions%rowtype;
  v_product_id text;
  v_price_id text;
  v_offer_id text;
  v_workspace_id uuid;
  v_status text;
  v_start timestamptz;
  v_end timestamptz;
  v_revision integer;
begin
  update public.commerce_webhook_receipts set status='processing',attempts=attempts+1,processing_started_at=now(),
    locked_at=now(),locked_by='commerce-billing',lease_expires_at=now()+interval '2 minutes' where id=v_receipt_id and status not in('processed','ignored');
  if not found then return jsonb_build_object('status','duplicate','receiptId',v_receipt_id); end if;

  select * into v_customer from public.commerce_customers where stripe_customer_id=p_event->>'providerCustomerId';
  if not found then raise exception 'commerce_customer_mismatch' using errcode='P0001'; end if;
  if nullif(p_event->>'workspaceId','') is not null and (v_customer.workspace_id is null or v_customer.workspace_id::text<>p_event->>'workspaceId') then
    raise exception 'commerce_workspace_mismatch' using errcode='P0001';
  end if;
  v_workspace_id:=coalesce(nullif(p_event->>'workspaceId','')::uuid,v_customer.workspace_id);
  if v_workspace_id is null then raise exception 'commerce_workspace_mismatch' using errcode='P0001'; end if;

  if v_type like 'subscription.%' then
    if nullif(p_event->>'providerSubscriptionId','') is null then raise exception 'commerce_reconciliation_required' using errcode='P0001'; end if;
    select * into v_subscription from public.commerce_subscriptions where provider='stripe' and environment=v_environment
      and provider_subscription_id=p_event->>'providerSubscriptionId' for update;
    select p.id,pr.id into v_product_id,v_price_id from public.commerce_prices pr join public.commerce_products p on p.id=pr.product_id
      where pr.stripe_price_id=p_event->>'providerPriceId';
    if v_product_id is null and nullif(p_event->>'providerCheckoutSessionId','') is not null then
      select * into v_checkout from public.commerce_checkout_sessions where provider_session_id=p_event->>'providerCheckoutSessionId' and environment=v_environment;
      v_product_id:=v_checkout.product_id;v_price_id:=v_checkout.price_id;v_offer_id:=v_checkout.offer_id;
    end if;
    v_product_id:=coalesce(v_product_id,v_subscription.product_id);
    v_price_id:=coalesce(v_price_id,v_subscription.price_id);
    v_offer_id:=coalesce(v_offer_id,v_subscription.offer_id);
    if v_product_id is null or v_price_id is null then raise exception 'commerce_reconciliation_required' using errcode='P0001'; end if;
    v_status:=coalesce(nullif(p_event->>'subscriptionStatus',''),
      case when v_type='subscription.cancelled' then 'cancelled' when v_type='subscription.paused' then 'paused' when v_type='subscription.resumed' then 'active' else 'incomplete' end);
    v_start:=coalesce(nullif(p_event->>'currentPeriodStart','')::timestamptz,v_subscription.current_period_start,now());
    v_end:=coalesce(nullif(p_event->>'currentPeriodEnd','')::timestamptz,v_subscription.current_period_end,v_start+interval '1 month');
    if v_subscription.id is null then
      insert into public.commerce_subscriptions(id,customer_id,workspace_id,product_id,offer_id,price_id,provider,environment,provider_subscription_id,status,
        current_period_start,current_period_end,cancel_at_period_end,revision,last_synchronized_at,created_at,updated_at)
      values('commerce-subscription-'||(p_event->>'providerSubscriptionId'),v_customer.id,v_workspace_id,v_product_id,v_offer_id,v_price_id,'stripe',v_environment,
        p_event->>'providerSubscriptionId',v_status,v_start,v_end,coalesce((p_event->>'cancelAtPeriodEnd')::boolean,false),1,now(),
        (p_event->>'providerCreatedAt')::timestamptz,now()) returning * into v_subscription;
      v_revision:=1;
    else
      if v_subscription.workspace_id<>v_workspace_id or v_subscription.customer_id<>v_customer.id then raise exception 'commerce_workspace_mismatch' using errcode='P0001'; end if;
      v_revision:=v_subscription.revision+1;
      update public.commerce_subscriptions set product_id=v_product_id,offer_id=v_offer_id,price_id=v_price_id,status=v_status,
        current_period_start=v_start,current_period_end=v_end,cancel_at_period_end=coalesce((p_event->>'cancelAtPeriodEnd')::boolean,false),
        revision=v_revision,last_synchronized_at=now(),updated_at=now() where id=v_subscription.id;
    end if;
    insert into public.commerce_subscription_history(id,subscription_id,receipt_id,event_type,previous_status,resulting_status,previous_price_id,resulting_price_id,
      period_start,period_end,cancel_at_period_end,revision,occurred_at,snapshot)
    values('commerce-subscription-history-'||(p_event->>'providerEventId'),v_subscription.id,v_receipt_id,v_type,
      v_subscription.status,v_status,v_subscription.price_id,v_price_id,v_start,v_end,coalesce((p_event->>'cancelAtPeriodEnd')::boolean,false),
      v_revision,(p_event->>'providerCreatedAt')::timestamptz,p_event) on conflict(id) do nothing;
    insert into public.commerce_outbox_events(id,aggregate_type,aggregate_id,event_type,payload_version,payload,status)
      values('commerce-outbox-subscription-'||v_subscription.id||'-'||v_revision,'order',v_subscription.id,'subscription.entitlements-reconcile',
        v_revision::text,jsonb_build_object('subscriptionId',v_subscription.id,'subscriptionRevision',v_revision),'pending')
      on conflict(aggregate_id,event_type,payload_version) do nothing;
    insert into public.commerce_activity(id,order_id,receipt_id,event_type,source,summary,resulting_state,occurred_at)
      select 'commerce-activity-'||(p_event->>'providerEventId'),c.order_id,v_receipt_id,v_type,'stripe','Subscription billing state synchronized.',v_status,
        (p_event->>'providerCreatedAt')::timestamptz from public.commerce_checkout_sessions c
      where c.provider_subscription_id=p_event->>'providerSubscriptionId' limit 1 on conflict(id) do nothing;
  elsif v_type like 'invoice.%' then
    select * into v_subscription from public.commerce_subscriptions where provider='stripe' and environment=v_environment
      and provider_subscription_id=p_event->>'providerSubscriptionId' for update;
    if not found then raise exception 'commerce_reconciliation_required' using errcode='P0001'; end if;
    if v_subscription.customer_id<>v_customer.id then raise exception 'commerce_customer_mismatch' using errcode='P0001'; end if;
    v_status:=coalesce(nullif(p_event->>'invoiceStatus',''),case when v_type='invoice.paid' then 'paid' else 'open' end);
    select * into v_invoice from public.commerce_invoices where provider='stripe' and environment=v_environment and provider_invoice_id=p_event->>'providerInvoiceId' for update;
    if v_invoice.id is null then
      insert into public.commerce_invoices(id,subscription_id,customer_id,workspace_id,provider,environment,provider_invoice_id,invoice_number,amount_minor,currency,status,
        hosted_invoice_url,invoice_pdf_url,period_start,period_end,due_at,next_payment_attempt_at,paid_at,last_synchronized_at,created_at)
      values('commerce-invoice-'||(p_event->>'providerInvoiceId'),v_subscription.id,v_customer.id,v_workspace_id,'stripe',v_environment,p_event->>'providerInvoiceId',
        nullif(p_event->>'invoiceNumber',''),coalesce((p_event->>'amountMinor')::bigint,0),coalesce(p_event->>'currency','USD'),v_status,
        nullif(p_event->>'invoiceUrl',''),nullif(p_event->>'invoicePdfUrl',''),nullif(p_event->>'currentPeriodStart','')::timestamptz,
        nullif(p_event->>'currentPeriodEnd','')::timestamptz,nullif(p_event->>'dueAt','')::timestamptz,nullif(p_event->>'nextPaymentAttemptAt','')::timestamptz,
        case when v_status='paid' then (p_event->>'providerCreatedAt')::timestamptz end,now(),(p_event->>'providerCreatedAt')::timestamptz) returning * into v_invoice;
      v_revision:=1;
    else
      select coalesce(max(revision),0)+1 into v_revision from public.commerce_invoice_revisions where invoice_id=v_invoice.id;
      update public.commerce_invoices set invoice_number=coalesce(nullif(p_event->>'invoiceNumber',''),invoice_number),
        amount_minor=coalesce((p_event->>'amountMinor')::bigint,amount_minor),currency=coalesce(p_event->>'currency',currency),status=v_status,
        hosted_invoice_url=coalesce(nullif(p_event->>'invoiceUrl',''),hosted_invoice_url),invoice_pdf_url=coalesce(nullif(p_event->>'invoicePdfUrl',''),invoice_pdf_url),
        due_at=coalesce(nullif(p_event->>'dueAt','')::timestamptz,due_at),next_payment_attempt_at=nullif(p_event->>'nextPaymentAttemptAt','')::timestamptz,
        paid_at=case when v_status='paid' then coalesce(paid_at,(p_event->>'providerCreatedAt')::timestamptz) else paid_at end,last_synchronized_at=now()
      where id=v_invoice.id;
    end if;
    insert into public.commerce_invoice_revisions(id,invoice_id,receipt_id,provider_event_id,revision,status,snapshot,occurred_at)
      values('commerce-invoice-revision-'||(p_event->>'providerEventId'),v_invoice.id,v_receipt_id,p_event->>'providerEventId',v_revision,v_status,p_event,
        (p_event->>'providerCreatedAt')::timestamptz) on conflict(invoice_id,provider_event_id) do nothing;
  elsif v_type='billing.payment-method-updated' then
    if nullif(p_event->>'providerPaymentMethodId','') is null or nullif(p_event->>'paymentMethodLastFour','') is null then
      raise exception 'commerce_reconciliation_required' using errcode='P0001';
    end if;
    insert into public.commerce_payment_method_summaries(id,customer_id,workspace_id,provider,environment,provider_payment_method_id,brand,last_four,expiration_month,expiration_year,last_synchronized_at)
    values('commerce-payment-method-'||(p_event->>'providerPaymentMethodId'),v_customer.id,v_workspace_id,'stripe',v_environment,
      p_event->>'providerPaymentMethodId',coalesce(nullif(p_event->>'paymentMethodBrand',''),'unknown'),p_event->>'paymentMethodLastFour',
      (p_event->>'paymentMethodExpirationMonth')::integer,(p_event->>'paymentMethodExpirationYear')::integer,now())
    on conflict(customer_id,environment) do update set provider_payment_method_id=excluded.provider_payment_method_id,brand=excluded.brand,last_four=excluded.last_four,
      expiration_month=excluded.expiration_month,expiration_year=excluded.expiration_year,last_synchronized_at=now();
  else
    update public.commerce_webhook_receipts set status='ignored',processed_at=now(),ignored_reason='Unsupported Billing event' where id=v_receipt_id;
    return jsonb_build_object('status','ignored','receiptId',v_receipt_id);
  end if;
  update public.commerce_webhook_receipts set status='processed',related_customer_id=v_customer.id,processed_at=now(),lease_expires_at=null where id=v_receipt_id;
  return jsonb_build_object('status','processed','receiptId',v_receipt_id);
exception when others then
  update public.commerce_webhook_receipts set status='failed',last_error_code=sqlerrm,last_error_message='Billing event requires operational review.',processed_at=now() where id=v_receipt_id;
  return jsonb_build_object('status','failed','receiptId',v_receipt_id,'errorCode',sqlerrm);
end $$;
revoke all on function public.process_commerce_billing_event(jsonb) from public,anon,authenticated;
grant execute on function public.process_commerce_billing_event(jsonb) to service_role;
