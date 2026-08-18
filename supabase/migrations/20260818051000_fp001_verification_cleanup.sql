-- One-off cleanup: remove a verification-only Founding HPM Partner record
-- (customer_accounts.display_name = 'Trigger Check') created while manually
-- confirming the append-only trigger on customer_program_audit_events during
-- FP-001C/D implementation. Deleting an append-only audit row is only
-- possible by briefly disabling the trigger for this specific, targeted
-- cleanup, matching this repo's existing convention for verification-run
-- data fixes (see 20260817235000_close_preflight_autocreate_launch.sql).
do $$
declare v_program_id uuid; v_account_id uuid;
begin
  select cp.id,cp.customer_account_id into v_program_id,v_account_id
    from public.customer_programs cp
    join public.customer_accounts ca on ca.id=cp.customer_account_id
    where ca.display_name='Trigger Check' and cp.cohort='2026-01-trigger-check'
    limit 1;
  if v_program_id is not null then
    alter table public.customer_program_audit_events disable trigger customer_program_audit_events_append_only;
    delete from public.customer_program_audit_events where customer_program_id=v_program_id;
    alter table public.customer_program_audit_events enable trigger customer_program_audit_events_append_only;
    delete from public.customer_programs where id=v_program_id;
    delete from public.customer_accounts where id=v_account_id;
  end if;
end$$;
