begin;

grant select, insert, update, delete
on table
  public.customer_accounts,
  public.customer_account_memberships,
  public.commercial_entitlements
to service_role;

commit;
