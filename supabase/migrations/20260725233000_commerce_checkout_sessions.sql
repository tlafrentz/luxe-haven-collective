create table public.commerce_checkout_sessions (
 id text primary key, provider_session_id text unique not null, order_id text unique not null references public.commerce_orders(id),
 customer_id text not null references public.commerce_customers(id), workspace_id uuid, product_id text not null references public.commerce_products(id),
 offer_id text not null references public.commerce_offers(id), price_id text not null references public.commerce_prices(id),
 environment text not null check(environment in ('test','live')), status text not null check(status in ('pending','cancelled','expired')),
 checkout_url text, expires_at timestamptz not null, created_at timestamptz not null
);
create index commerce_checkout_customer_created_idx on public.commerce_checkout_sessions(customer_id,created_at desc);
create index commerce_checkout_expiration_idx on public.commerce_checkout_sessions(status,expires_at);
alter table public.commerce_checkout_sessions enable row level security;
create policy "Commerce checkout owner reads" on public.commerce_checkout_sessions for select to authenticated using(exists(select 1 from public.commerce_customers c where c.id=customer_id and(c.profile_id=auth.uid() or public.is_admin())));
create policy "Commerce checkout admin reads" on public.commerce_checkout_sessions for select to authenticated using(public.is_admin());
grant select on public.commerce_checkout_sessions to authenticated;
create trigger commerce_checkout_sessions_immutable before update or delete on public.commerce_checkout_sessions for each row execute function public.prevent_commerce_history_change();
