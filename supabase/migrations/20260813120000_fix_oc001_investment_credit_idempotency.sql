-- A concurrent duplicate can pass the optimistic idempotency lookup while the
-- first request is still waiting for the account-scoped lock. Re-resolve the
-- canonical reservation after locking before inspecting available allowance.

create or replace function public.reserve_oc001_investment_credit(
  p_actor_id uuid,
  p_tenant_id uuid,
  p_customer_account_id uuid,
  p_logical_analysis_reference text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  l public.investment_credit_ledgers;
  c public.investment_credit_consumptions;
  h text:=pg_catalog.encode(extensions.digest(p_idempotency_key,'sha256'),'hex');
begin
  if auth.role()<>'service_role' or not exists(
    select 1 from public.customer_account_memberships
    where profile_id=p_actor_id and tenant_id=p_tenant_id
      and customer_account_id=p_customer_account_id and status='active'
  ) then raise exception'OC001_INVESTMENT_CREDIT_NOT_AUTHORIZED'; end if;
  if length(trim(p_logical_analysis_reference))=0 then
    raise exception'OC001_INVESTMENT_ANALYSIS_REFERENCE_REQUIRED';
  end if;

  select * into c from public.investment_credit_consumptions where idempotency_key_hash=h;
  if found then return jsonb_build_object('consumptionId',c.id,'status',c.status); end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_tenant_id::text||':'||p_customer_account_id::text||':investment-credit',0)
  );

  select * into c from public.investment_credit_consumptions where idempotency_key_hash=h;
  if found then return jsonb_build_object('consumptionId',c.id,'status',c.status); end if;

  select * into l from public.investment_credit_ledgers
  where tenant_id=p_tenant_id and customer_account_id=p_customer_account_id
    and status='active' and (expires_at is null or expires_at>now())
    and consumed_count<granted_count
  order by expires_at nulls last,created_at
  for update skip locked limit 1;
  if not found then raise exception'OC001_INVESTMENT_CREDIT_UNAVAILABLE'; end if;

  insert into public.investment_credit_consumptions(
    ledger_id,tenant_id,customer_account_id,logical_analysis_reference,status,idempotency_key_hash
  ) values(l.id,p_tenant_id,p_customer_account_id,p_logical_analysis_reference,'reserved',h)
  returning * into c;
  update public.investment_credit_ledgers
    set consumed_count=consumed_count+1,
        status=case when consumed_count+1>=granted_count then'exhausted'else'active'end,
        updated_at=now(),revision=revision+1
    where id=l.id;
  return jsonb_build_object('consumptionId',c.id,'status','reserved');
end
$$;

revoke all on function public.reserve_oc001_investment_credit(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.reserve_oc001_investment_credit(uuid,uuid,uuid,text,text)
  to service_role;
