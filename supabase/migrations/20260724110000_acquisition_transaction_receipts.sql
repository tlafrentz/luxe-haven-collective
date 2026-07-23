-- IA-002A.7.5: durable receipt fingerprints and versioned transaction RPC input.
alter table public.acquisition_command_receipts add column if not exists request_fingerprint text not null default 'v1:00000000';
alter table public.acquisition_command_receipts add column if not exists opportunity_id text references public.investment_opportunities(id) on delete restrict;
alter table public.acquisition_command_receipts add constraint acquisition_receipt_fingerprint_format check (request_fingerprint ~ '^v1:[0-9a-f]{8}$');
create unique index if not exists acquisition_receipts_owner_command_idx on public.acquisition_command_receipts(owner_id, command_id);

create or replace function public.save_acquisition_pipeline_transaction_v1(p_input jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare owner uuid; command_id text; command_type text; fingerprint text; existing public.acquisition_command_receipts;
begin
  if jsonb_typeof(p_input) <> 'object' or (p_input->>'schemaVersion') <> '1' then raise exception 'Invalid acquisition transaction schema' using errcode = 'P0001'; end if;
  owner := (p_input->>'ownerId')::uuid; command_id := p_input->'commandReceipt'->>'commandId'; command_type := p_input->'commandReceipt'->>'commandType'; fingerprint := p_input->'commandReceipt'->>'requestFingerprint';
  if auth.uid() is null or (owner <> auth.uid() and not public.is_admin()) then raise exception 'Acquisition access denied' using errcode = '42501'; end if;
  select * into existing from public.acquisition_command_receipts where owner_id=owner and command_id=command_id;
  if found then if existing.request_fingerprint <> fingerprint or existing.command_type <> command_type then raise exception 'Acquisition command id reused' using errcode = '23505'; end if; return jsonb_build_object('status','replayed','commandId',command_id,'receiptResult',existing.result); end if;
  raise exception 'Transaction plan execution requires the production plan writer' using errcode = 'P0001';
end; $$;
revoke all on function public.save_acquisition_pipeline_transaction_v1(jsonb) from public;
grant execute on function public.save_acquisition_pipeline_transaction_v1(jsonb) to authenticated;

-- Rollback: revoke/drop RPC, indexes, constraints, and added receipt columns.
