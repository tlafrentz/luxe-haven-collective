create policy "admins read customer accounts" on public.customer_accounts for select to authenticated using(public.is_admin());
create policy "admins read commercial entitlements" on public.commercial_entitlements for select to authenticated using(public.is_admin());
create policy "admins read property entitlement allocations" on public.property_entitlement_allocations for select to authenticated using(public.is_admin());
