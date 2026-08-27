create table public.auth_email_action_states (
  id uuid primary key default gen_random_uuid(),
  flow text not null check (flow in ('invite','recovery')),
  token_ciphertext text not null,
  token_iv text not null,
  token_tag text not null,
  token_digest text not null check (length(token_digest)=64),
  browser_nonce_digest text not null check (length(browser_nonce_digest)=64),
  redirect_to text not null,
  status text not null default 'pending' check (status in ('pending','claimed','consumed','failed','expired')),
  expires_at timestamptz not null,
  claimed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index auth_email_action_states_expiry_idx
  on public.auth_email_action_states(status,expires_at);
alter table public.auth_email_action_states enable row level security;
revoke all on table public.auth_email_action_states from public,anon,authenticated;
grant all on table public.auth_email_action_states to service_role;
