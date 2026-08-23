-- FI-003A.1: atomically create/recover a manual cash account and its balance.
create or replace function public.record_manual_cash_balance(
  p_workspace_id uuid,
  p_code text,
  p_name text,
  p_account_type text,
  p_amount_minor bigint,
  p_currency text,
  p_as_of date,
  p_notes text,
  p_idempotency_key text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account_id uuid;
  v_balance_id uuid;
begin
  if p_account_type not in ('operating','reserve','tax','other-cash')
     or p_currency !~ '^[A-Z]{3}$'
     or nullif(trim(p_name),'') is null
     or nullif(trim(p_code),'') is null
     or nullif(trim(p_idempotency_key),'') is null then
    raise exception 'INVALID_MANUAL_CASH_BALANCE';
  end if;

  select observation.account_id, observation.id
    into v_account_id, v_balance_id
    from public.cash_balance_observations observation
   where observation.workspace_id = p_workspace_id
     and observation.idempotency_key = p_idempotency_key;

  if v_balance_id is not null then
    return jsonb_build_object('account_id',v_account_id,'balance_id',v_balance_id,'created',false);
  end if;

  insert into public.financial_accounts(
    workspace_id,code,name,category,subcategory,account_type,status,source_type,notes,active
  ) values (
    p_workspace_id,p_code,trim(p_name),
    case when p_account_type='reserve' then 'reserve' else 'asset' end,
    p_account_type,p_account_type,'active','manual',nullif(trim(p_notes),''),true
  )
  on conflict(workspace_id,code) do update set
    name=excluded.name,
    category=excluded.category,
    subcategory=excluded.subcategory,
    account_type=excluded.account_type,
    status='active',
    source_type='manual',
    notes=coalesce(excluded.notes,financial_accounts.notes),
    active=true
  returning id into v_account_id;

  insert into public.cash_balance_observations(
    workspace_id,account_id,amount_minor,currency,as_of,source_type,idempotency_key,recorded_by_profile_id
  ) values (
    p_workspace_id,v_account_id,p_amount_minor,p_currency,p_as_of,'manual',p_idempotency_key,auth.uid()
  ) returning id into v_balance_id;

  return jsonb_build_object('account_id',v_account_id,'balance_id',v_balance_id,'created',true);
end;
$$;

revoke all on function public.record_manual_cash_balance(uuid,text,text,text,bigint,text,date,text,text) from public,anon;
grant execute on function public.record_manual_cash_balance(uuid,text,text,text,bigint,text,date,text,text) to authenticated;
