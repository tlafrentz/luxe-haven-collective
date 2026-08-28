-- FS-008G finalization: server-authoritative context for existing Furnishing commands.
begin;

create table if not exists public.furnishing_command_contexts (
  id uuid primary key default gen_random_uuid(),
  candidate_commit text not null,
  workflow text not null,
  workspace_id uuid not null,
  actor_id uuid not null references public.profiles(id),
  actor_role text not null,
  command_type text not null,
  target_type text not null,
  target_id text not null,
  correlation_id uuid not null default gen_random_uuid(),
  idempotency_key text not null unique,
  binding_hash text not null unique,
  expires_at timestamptz not null,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now(),
  check (length(candidate_commit) between 7 and 64),
  check (workflow ~ '^fs008g-finalization:[a-z0-9_-]+$'),
  check (command_type ~ '^[a-z0-9_.-]+$'),
  check (target_type in ('workspace','import','package','package_version','room_package','room_package_version','room_package_item','plan','selection','project','snapshot','baseline','budget','batch','order','line','discrepancy','cleanup')),
  check (expires_at > created_at)
);

create index if not exists furnishing_command_context_scope_idx
  on public.furnishing_command_contexts(workspace_id,actor_id,workflow,command_type,target_type,target_id);

alter table public.furnishing_command_contexts enable row level security;

create or replace function public.issue_fs008g_furnishing_command_context(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  context_row public.furnishing_command_contexts%rowtype;
  actor uuid := (p_input->>'actorId')::uuid;
  workspace uuid := (p_input->>'workspaceId')::uuid;
  expires timestamptz := (p_input->>'expiresAt')::timestamptz;
  binding text;
begin
  if not exists(select 1 from public.profiles p where p.id=actor and p.role=p_input->>'actorRole') then
    raise exception 'FS008G_CONTEXT_ACTOR_INVALID';
  end if;
  if expires<=now() or expires>now()+interval '2 hours' then raise exception 'FS008G_CONTEXT_EXPIRY_INVALID'; end if;
  binding:=encode(digest(concat_ws(':',p_input->>'candidateCommit',p_input->>'workflow',workspace::text,actor::text,p_input->>'commandType',p_input->>'targetType',p_input->>'targetId'),'sha256'),'hex');
  select * into context_row from public.furnishing_command_contexts where binding_hash=binding for update;
  if found then
    if context_row.retired_at is not null then raise exception 'FS008G_CONTEXT_RETIRED'; end if;
    update public.furnishing_command_contexts set expires_at=expires,refreshed_at=now() where id=context_row.id returning * into context_row;
  else
    insert into public.furnishing_command_contexts(candidate_commit,workflow,workspace_id,actor_id,actor_role,command_type,target_type,target_id,idempotency_key,binding_hash,expires_at)
    values(p_input->>'candidateCommit',p_input->>'workflow',workspace,actor,p_input->>'actorRole',p_input->>'commandType',p_input->>'targetType',p_input->>'targetId','fs008g-ctx-'||binding,binding,expires)
    returning * into context_row;
  end if;
  return jsonb_build_object('contextId',context_row.id,'expiresAt',context_row.expires_at);
end $$;

create or replace function public.resolve_fs008g_furnishing_command_context(p_context_id uuid,p_actor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare context_row public.furnishing_command_contexts%rowtype;
begin
  select * into context_row from public.furnishing_command_contexts where id=p_context_id for update;
  if not found then raise exception 'FS008G_CONTEXT_MISSING'; end if;
  if context_row.actor_id<>p_actor_id then raise exception 'FS008G_CONTEXT_ACTOR_MISMATCH'; end if;
  if context_row.retired_at is not null then raise exception 'FS008G_CONTEXT_RETIRED'; end if;
  if context_row.expires_at<=now() then raise exception 'FS008G_CONTEXT_EXPIRED'; end if;
  return jsonb_build_object('candidateCommit',context_row.candidate_commit,'workflow',context_row.workflow,'workspaceId',context_row.workspace_id,'actorId',context_row.actor_id,'actorRole',context_row.actor_role,'commandType',context_row.command_type,'targetType',context_row.target_type,'targetId',context_row.target_id,'correlationId',context_row.correlation_id,'idempotencyKey',context_row.idempotency_key,'expiresAt',context_row.expires_at);
end $$;

revoke all on public.furnishing_command_contexts from public,anon,authenticated;
revoke all on function public.issue_fs008g_furnishing_command_context(jsonb),public.resolve_fs008g_furnishing_command_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.issue_fs008g_furnishing_command_context(jsonb),public.resolve_fs008g_furnishing_command_context(uuid,uuid) to service_role;

commit;
