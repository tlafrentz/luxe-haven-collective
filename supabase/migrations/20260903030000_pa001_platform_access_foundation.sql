-- PA-001: Platform Access Architecture — foundation data model.
--
-- New, additive authorization substrate: a privilege registry, five
-- canonical roles, versioned role compositions, scoped role assignments,
-- and an audit trail. This migration ships completely unused — nothing
-- existing reads or writes these tables, and no RLS policy anywhere else
-- references them. It layers on top of the existing public.owners /
-- public.workspace_memberships tenancy model without changing either.
begin;

-- 1. Scope hierarchy -------------------------------------------------------
-- Enum declaration order gives us "<"/"<=" comparison for free, which is
-- exactly what "a broader grant covers its descendants" needs.
create type public.access_scope_type as enum (
  'platform','workspace','portfolio','property','project','resource'
);

-- 2. Privilege registry -----------------------------------------------------
create table public.privilege_definitions (
  id text primary key,
  module text not null,
  resource text not null,
  action text not null,
  label text not null,
  description text not null,
  sensitivity text not null check (sensitivity in ('standard','elevated','critical')),
  allowed_scopes public.access_scope_type[] not null,
  dependencies text[] not null default '{}',
  state text not null default 'active' check (state in ('active','deprecated','retired')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint privilege_definitions_id_matches_parts check (id = module || '.' || resource || '.' || action),
  constraint privilege_definitions_allowed_scopes_nonempty check (cardinality(allowed_scopes) > 0)
);
create index privilege_definitions_module_idx on public.privilege_definitions (module, state);

-- 3. Five canonical roles ----------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique check (
    canonical_name in ('workspace_owner','administrator','manager','contributor','viewer')
  ),
  label text not null,
  description text not null,
  workspace_wide boolean not null,
  state text not null default 'active' check (state in ('active','retired')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Role composition (soft-versioned) ---------------------------------------
create table public.role_privileges (
  role_id uuid not null references public.roles(id),
  privilege_id text not null references public.privilege_definitions(id),
  version integer not null default 1,
  granted_at timestamptz not null default now(),
  superseded_at timestamptz,
  superseded_reason text,
  primary key (role_id, privilege_id, version)
);
create unique index role_privileges_active_idx
  on public.role_privileges (role_id, privilege_id) where superseded_at is null;
create index role_privileges_privilege_idx on public.role_privileges (privilege_id) where superseded_at is null;

-- 5. Scoped role assignments --------------------------------------------------
create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.profiles(id),
  role_id uuid not null references public.roles(id),
  workspace_id uuid not null references public.owners(id) on delete cascade,
  module text,
  scope_type public.access_scope_type not null default 'workspace',
  scope_id text,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  state text not null default 'active' check (state in ('active','revoked','expired')),
  assigner_id uuid not null references public.profiles(id),
  reason text not null check (length(trim(reason)) > 0),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint role_assignments_scope_id_required check (
    (scope_type in ('platform','workspace') and scope_id is null)
    or (scope_type not in ('platform','workspace') and scope_id is not null)
  ),
  -- >= rather than > : a revoke can legitimately land at the same instant
  -- as valid_from (now() is transaction-stable, so a create+revoke inside
  -- one transaction/statement can share an identical timestamp), meaning a
  -- zero-duration grant is valid, not a data error.
  constraint role_assignments_validity_order check (valid_until is null or valid_until >= valid_from)
);

-- AUTH-006: workspace-wide roles (Owner/Administrator) carry no module
-- restriction and are always workspace-scoped; module-scoped roles
-- (Manager/Contributor/Viewer) always require a module.
create or replace function public.pa001_role_assignment_shape_guard()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare wide boolean;
begin
  select workspace_wide into wide from public.roles where id = new.role_id;
  if wide and (new.module is not null or new.scope_type <> 'workspace') then
    raise exception 'PA_ROLE_ASSIGNMENT_SCOPE_INVALID_FOR_WORKSPACE_WIDE_ROLE';
  end if;
  if not wide and new.module is null then
    raise exception 'PA_ROLE_ASSIGNMENT_MODULE_REQUIRED';
  end if;
  return new;
end $$;
create trigger role_assignments_scope_shape_guard
before insert or update on public.role_assignments
for each row execute function public.pa001_role_assignment_shape_guard();

-- IAM-003: duplicate active assignments are idempotent -> exactly one
-- active row per (subject, role, workspace, module, scope) tuple.
create unique index role_assignments_active_tuple_idx on public.role_assignments (
  subject_id, role_id, workspace_id,
  coalesce(module, ''), scope_type, coalesce(scope_id, '')
) where state = 'active';

create index role_assignments_workspace_subject_idx on public.role_assignments (workspace_id, subject_id, state);
create index role_assignments_workspace_role_idx on public.role_assignments (workspace_id, role_id, state);
create index role_assignments_expiry_idx on public.role_assignments (valid_until) where state = 'active' and valid_until is not null;

-- 6. Idempotency ledger for the governed RPCs --------------------------------
create table public.role_assignment_command_receipts (
  idempotency_key text primary key,
  actor_id uuid not null references public.profiles(id),
  request_fingerprint text not null,
  result jsonb not null,
  completed_at timestamptz not null default now()
);

-- 7. Audit trail --------------------------------------------------------------
create table public.authorization_audit (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles(id),
  effective_subject_id uuid not null references public.profiles(id),
  workspace_id uuid references public.owners(id),
  privilege_id text references public.privilege_definitions(id),
  module text,
  resource text,
  scope_type public.access_scope_type,
  scope_id text,
  decision text not null check (decision in ('allow','deny')),
  reason_code text not null,
  matching_assignment_ids uuid[] not null default '{}',
  correlation_id uuid not null,
  context jsonb not null default '{}'
);
create index authorization_audit_workspace_idx on public.authorization_audit (workspace_id, occurred_at desc);
create index authorization_audit_subject_idx on public.authorization_audit (effective_subject_id, occurred_at desc);
create index authorization_audit_correlation_idx on public.authorization_audit (correlation_id);

create table public.access_change_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type in ('granted','revoked','modified','expired')),
  assignment_id uuid references public.role_assignments(id),
  subject_id uuid not null references public.profiles(id),
  role_id uuid not null references public.roles(id),
  workspace_id uuid not null references public.owners(id),
  module text,
  scope_type public.access_scope_type not null,
  scope_id text,
  assigner_id uuid not null references public.profiles(id),
  reason text not null check (length(trim(reason)) > 0),
  before_state jsonb not null default '{}',
  after_state jsonb not null default '{}',
  correlation_id uuid not null,
  idempotency_key text
);
create unique index access_change_events_idempotency_idx on public.access_change_events (idempotency_key) where idempotency_key is not null;
create index access_change_events_workspace_idx on public.access_change_events (workspace_id, occurred_at desc);
create index access_change_events_subject_idx on public.access_change_events (subject_id, occurred_at desc);

-- SEC-004: audit tables are append-only, even to their own owning role.
create or replace function public.pa001_reject_audit_mutation()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  raise exception 'PA_AUDIT_IMMUTABLE';
end $$;
create trigger authorization_audit_immutable
before update or delete on public.authorization_audit
for each row execute function public.pa001_reject_audit_mutation();
create trigger access_change_events_immutable
before update or delete on public.access_change_events
for each row execute function public.pa001_reject_audit_mutation();

-- 8. RLS ------------------------------------------------------------------
alter table public.privilege_definitions enable row level security;
alter table public.roles enable row level security;
alter table public.role_privileges enable row level security;
alter table public.role_assignments enable row level security;
alter table public.authorization_audit enable row level security;
alter table public.access_change_events enable row level security;
alter table public.role_assignment_command_receipts enable row level security;

-- Catalog tables: static, non-sensitive reference data, readable by any
-- authenticated user.
create policy "Authenticated read privilege definitions" on public.privilege_definitions for select to authenticated using (true);
create policy "Authenticated read roles" on public.roles for select to authenticated using (true);
create policy "Authenticated read active role privilege composition" on public.role_privileges for select to authenticated using (superseded_at is null);

-- role_assignments: a subject reads their own rows; workspace owners/admins
-- (via the EXISTING active_workspace_role helper, not the new evaluator --
-- gating these tables' own visibility with the evaluator being built on
-- top of them would be circular) or platform staff read everything.
create policy "Subjects and workspace admins read role assignments" on public.role_assignments for select to authenticated using (
  subject_id = auth.uid()
  or public.active_workspace_role(workspace_id) in ('owner','administrator')
  or public.is_admin()
);

-- Audit tables: workspace admins + platform staff only, matching the
-- existing admin_audit_events precedent. No self-read clause -- these are
-- administrative records, not personal ones.
create policy "Workspace admins read authorization audit" on public.authorization_audit for select to authenticated using (
  public.active_workspace_role(workspace_id) in ('owner','administrator') or public.is_admin()
);
create policy "Workspace admins read access change events" on public.access_change_events for select to authenticated using (
  public.active_workspace_role(workspace_id) in ('owner','administrator') or public.is_admin()
);
-- role_assignment_command_receipts: no select policy at all -- internal to
-- the governed RPCs, never read directly by any client.

grant select on public.privilege_definitions, public.roles, public.role_privileges,
  public.role_assignments, public.authorization_audit, public.access_change_events to authenticated;

-- The only write path to any of these seven tables is through the
-- security-definer RPCs added in the companion migration -- this is what
-- makes "RLS and RPCs enforce identical decisions" true by construction.
revoke all on public.authorization_audit, public.access_change_events,
  public.role_assignment_command_receipts from public, anon, authenticated;
revoke insert, update, delete on public.privilege_definitions, public.roles,
  public.role_privileges, public.role_assignments from public, anon, authenticated;

-- 9. Seed: privilege registry -------------------------------------------------
-- One row per action listed in the Platform Access Architecture spec §5,
-- module.resource.action, matching the exact bulk-VALUES + ON CONFLICT
-- convention already used for furnishing_product_categories.
insert into public.privilege_definitions (id, module, resource, action, label, description, sensitivity, allowed_scopes) values
('guidebooks.guidebook.view','guidebooks','guidebook','view','View guidebook','View a guidebook and its content.','standard','{workspace,portfolio,property,project}'),
('guidebooks.guidebook.create','guidebooks','guidebook','create','Create guidebook','Create a new guidebook.','elevated','{workspace,portfolio,property,project}'),
('guidebooks.guidebook.edit','guidebooks','guidebook','edit','Edit guidebook','Edit guidebook content.','elevated','{workspace,portfolio,property,project}'),
('guidebooks.guidebook.manage_media','guidebooks','guidebook','manage_media','Manage guidebook media','Add, replace, or remove guidebook media.','elevated','{workspace,portfolio,property,project}'),
('guidebooks.guidebook.submit','guidebooks','guidebook','submit','Submit guidebook for review','Submit a guidebook draft for review.','elevated','{workspace,portfolio,property,project}'),
('guidebooks.guidebook.review','guidebooks','guidebook','review','Review guidebook','Review a submitted guidebook.','critical','{workspace,portfolio,property,project}'),
('guidebooks.guidebook.approve','guidebooks','guidebook','approve','Approve guidebook','Approve a reviewed guidebook.','critical','{workspace,portfolio,property,project}'),
('guidebooks.guidebook.publish','guidebooks','guidebook','publish','Publish guidebook','Make an approved guidebook visible to guests.','critical','{workspace,portfolio,property,project}'),
('guidebooks.guidebook.unpublish','guidebooks','guidebook','unpublish','Unpublish guidebook','Remove a published guidebook from guest visibility.','critical','{workspace,portfolio,property,project}'),
('guidebooks.guidebook.archive','guidebooks','guidebook','archive','Archive guidebook','Archive a guidebook.','elevated','{workspace,portfolio,property,project}'),
('guidebooks.guidebook.share','guidebooks','guidebook','share','Share guidebook','Grant contextual access to a guidebook.','elevated','{workspace,portfolio,property,project}'),
('guidebooks.guidebook.export','guidebooks','guidebook','export','Export guidebook','Export guidebook content.','elevated','{workspace,portfolio,property,project}'),

('investments.opportunity.view','investments','opportunity','view','View investment opportunity','View an investment opportunity and its analysis.','standard','{workspace,portfolio,property,project}'),
('investments.opportunity.create','investments','opportunity','create','Create investment opportunity','Create a new investment opportunity.','elevated','{workspace,portfolio,property,project}'),
('investments.opportunity.edit_assumptions','investments','opportunity','edit_assumptions','Edit assumptions','Edit an investment opportunity''s underlying assumptions.','elevated','{workspace,portfolio,property,project}'),
('investments.opportunity.view_financing','investments','opportunity','view_financing','View financing detail','View financing detail for an investment opportunity.','elevated','{workspace,portfolio,property,project}'),
('investments.opportunity.edit_financing','investments','opportunity','edit_financing','Edit financing detail','Edit financing detail for an investment opportunity.','elevated','{workspace,portfolio,property,project}'),
('investments.opportunity.view_returns','investments','opportunity','view_returns','View investor returns','View investor-return detail.','elevated','{workspace,portfolio,property,project}'),
('investments.opportunity.approve','investments','opportunity','approve','Approve investment opportunity','Approve an investment opportunity.','critical','{workspace,portfolio,property,project}'),
('investments.opportunity.share','investments','opportunity','share','Share investment opportunity','Grant contextual access to an investment opportunity.','elevated','{workspace,portfolio,property,project}'),
('investments.opportunity.export','investments','opportunity','export','Export investment opportunity','Export an investment opportunity''s analysis.','elevated','{workspace,portfolio,property,project}'),
('investments.opportunity.archive','investments','opportunity','archive','Archive investment opportunity','Archive an investment opportunity.','elevated','{workspace,portfolio,property,project}'),

('actions.action.view','actions','action','view','View action','View an Action Center item.','standard','{workspace,portfolio,property,project}'),
('actions.action.assign','actions','action','assign','Assign action','Assign an Action Center item.','elevated','{workspace,portfolio,property,project}'),
('actions.action.comment','actions','action','comment','Comment on action','Comment on an Action Center item.','standard','{workspace,portfolio,property,project}'),
('actions.action.dismiss','actions','action','dismiss','Dismiss action','Dismiss an Action Center item.','critical','{workspace,portfolio,property,project}'),
('actions.action.execute','actions','action','execute','Execute action','Execute an Action Center item.','critical','{workspace,portfolio,property,project}'),
('actions.action.approve','actions','action','approve','Approve action','Approve an Action Center item.','critical','{workspace,portfolio,property,project}'),

('financials.summary.view_summary','financials','summary','view_summary','View financial summary','View a financial summary.','standard','{workspace,portfolio,property,project}'),
('financials.transaction.view_transactions','financials','transaction','view_transactions','View transactions','View financial transaction detail.','elevated','{workspace,portfolio,property,project}'),
('financials.transaction.reconcile','financials','transaction','reconcile','Reconcile transactions','Reconcile financial transactions.','critical','{workspace,portfolio,property,project}'),
('financials.transaction.categorize','financials','transaction','categorize','Categorize transactions','Categorize financial transactions.','elevated','{workspace,portfolio,property,project}'),
('financials.connection.connect_provider','financials','connection','connect_provider','Connect financial provider','Connect a financial data provider.','critical','{workspace}'),
('financials.connection.manage_connections','financials','connection','manage_connections','Manage financial connections','Manage existing financial provider connections.','critical','{workspace}'),
('financials.report.forecast','financials','report','forecast','Forecast','Produce a financial forecast.','elevated','{workspace,portfolio,property,project}'),
('financials.report.export','financials','report','export','Export financial report','Export a financial report.','elevated','{workspace,portfolio,property,project}'),

('revenue.strategy.view','revenue','strategy','view','View revenue strategy','View revenue strategy.','standard','{workspace,portfolio,property,project}'),
('revenue.strategy.edit_strategy','revenue','strategy','edit_strategy','Edit revenue strategy','Edit revenue strategy.','elevated','{workspace,portfolio,property,project}'),
('revenue.recommendation.create_recommendation','revenue','recommendation','create_recommendation','Create rate recommendation','Create a rate recommendation.','elevated','{workspace,portfolio,property,project}'),
('revenue.recommendation.approve','revenue','recommendation','approve','Approve rate recommendation','Approve a rate recommendation.','critical','{workspace,portfolio,property,project}'),
('revenue.rates.publish_rates','revenue','rates','publish_rates','Publish rates','Publish rates to external channels.','critical','{workspace,portfolio,property,project}'),
('revenue.integration.manage_integrations','revenue','integration','manage_integrations','Manage revenue integrations','Manage revenue channel integrations.','critical','{workspace}'),

('operations.task.view','operations','task','view','View operations task','View an operations task.','standard','{workspace,portfolio,property,project}'),
('operations.task.create','operations','task','create','Create operations task','Create an operations task.','elevated','{workspace,portfolio,property,project}'),
('operations.task.assign','operations','task','assign','Assign operations task','Assign an operations task.','elevated','{workspace,portfolio,property,project}'),
('operations.task.complete','operations','task','complete','Complete operations task','Complete an operations task.','elevated','{workspace,portfolio,property,project}'),
('operations.task.verify','operations','task','verify','Verify operations task','Verify a completed operations task.','critical','{workspace,portfolio,property,project}'),
('operations.task.reopen','operations','task','reopen','Reopen operations task','Reopen an operations task.','critical','{workspace,portfolio,property,project}'),
('operations.template.manage_templates','operations','template','manage_templates','Manage operations templates','Manage operations task templates.','critical','{workspace}'),

('automations.automation.view','automations','automation','view','View automation','View an automation definition.','standard','{workspace,portfolio,property,project}'),
('automations.automation.create','automations','automation','create','Create automation','Create an automation definition.','elevated','{workspace,portfolio,property,project}'),
('automations.automation.edit','automations','automation','edit','Edit automation','Edit an automation definition.','elevated','{workspace,portfolio,property,project}'),
('automations.automation.enable','automations','automation','enable','Enable automation','Enable an automation definition.','critical','{workspace,portfolio,property,project}'),
('automations.automation.approve','automations','automation','approve','Approve automation','Approve an automation definition.','critical','{workspace,portfolio,property,project}'),
('automations.automation.execute','automations','automation','execute','Execute automation','Manually execute an automation.','critical','{workspace,portfolio,property,project}'),
('automations.run.view_runs','automations','run','view_runs','View automation runs','View automation run history.','standard','{workspace,portfolio,property,project}'),
('automations.run.cancel_run','automations','run','cancel_run','Cancel automation run','Cancel an in-progress automation run.','critical','{workspace,portfolio,property,project}'),

('furnishing.catalog.catalog_manage','furnishing','catalog','catalog_manage','Manage furnishing catalog','Manage the furnishing product catalog.','critical','{workspace}'),
('furnishing.catalog.import_commit','furnishing','catalog','import_commit','Commit furnishing import','Commit a furnishing inventory import.','critical','{workspace}'),
('furnishing.package.package_edit','furnishing','package','package_edit','Edit furnishing package','Edit a furnishing room package.','elevated','{workspace,portfolio,property,project}'),
('furnishing.package.package_approve','furnishing','package','package_approve','Approve furnishing package','Approve a furnishing room package.','critical','{workspace,portfolio,property,project}'),
('furnishing.design.design_edit','furnishing','design','design_edit','Edit furnishing design','Edit a furnishing design workspace.','elevated','{workspace,portfolio,property,project}'),
('furnishing.budget.budget_approve','furnishing','budget','budget_approve','Approve furnishing budget','Approve a furnishing budget.','critical','{workspace,portfolio,property,project}'),
('furnishing.procurement.procurement_prepare','furnishing','procurement','procurement_prepare','Prepare furnishing procurement','Prepare a furnishing procurement plan.','elevated','{workspace,portfolio,property,project}'),
('furnishing.procurement.procurement_approve','furnishing','procurement','procurement_approve','Approve furnishing procurement','Approve a furnishing procurement plan.','critical','{workspace,portfolio,property,project}'),
('furnishing.procurement.purchase_authorize','furnishing','procurement','purchase_authorize','Authorize furnishing purchase','Authorize a live furnishing purchase.','critical','{workspace,portfolio,property,project}'),
('furnishing.installation.installation_update','furnishing','installation','installation_update','Update furnishing installation','Update a furnishing installation.','elevated','{workspace,portfolio,property,project}'),
('furnishing.installation.installation_complete','furnishing','installation','installation_complete','Complete furnishing installation','Mark a furnishing installation complete.','elevated','{workspace,portfolio,property,project}'),

('workspace.members.members_view','workspace','members','members_view','View workspace members','View workspace membership.','standard','{workspace}'),
('workspace.members.members_manage','workspace','members','members_manage','Manage workspace members','Invite, suspend, or remove workspace members.','critical','{workspace}'),
('workspace.roles.roles_view','workspace','roles','roles_view','View role assignments','View role assignments and effective access.','standard','{workspace}'),
('workspace.roles.roles_manage','workspace','roles','roles_manage','Manage role assignments','Grant or revoke role assignments.','critical','{workspace}'),
('workspace.property.properties_manage','workspace','property','properties_manage','Manage properties','Manage workspace properties.','critical','{workspace}'),
('workspace.entitlement.entitlements_view','workspace','entitlement','entitlements_view','View entitlements','View workspace module entitlements.','standard','{workspace}'),
('workspace.billing.billing_manage','workspace','billing','billing_manage','Manage billing','Manage workspace billing and ownership transfer.','critical','{workspace}'),
('workspace.audit.audit_view','workspace','audit','audit_view','View audit history','View workspace access-change and authorization audit history.','elevated','{workspace}')
on conflict (id) do update set
  label = excluded.label, description = excluded.description,
  sensitivity = excluded.sensitivity, allowed_scopes = excluded.allowed_scopes;

-- 10. Seed: five canonical roles ----------------------------------------------
insert into public.roles (canonical_name, label, description, workspace_wide) values
('workspace_owner', 'Workspace Owner', 'Complete workspace authority, ownership transfer, billing, and access management.', true),
('administrator', 'Administrator', 'Users, properties, configuration, and all entitled modules except owner-only actions.', true),
('manager', 'Manager', 'Create, edit, assign, approve, publish, and execute within assigned modules and scope.', false),
('contributor', 'Contributor', 'Create, edit, comment, and complete work within assigned modules and scope.', false),
('viewer', 'Viewer', 'Read-only access to permitted information within assigned modules and scope.', false)
on conflict (canonical_name) do update set label = excluded.label, description = excluded.description;

-- 11. Seed: default role composition, derived mechanically from the
-- role x capability matrix by bucketing each privilege's action.
with buckets as (
  select id,
    case
      when action = 'view' or action like 'view\_%' escape '\' or action like '%\_view' escape '\' then 'view'
      when action = 'billing_manage' then 'billing_ownership'
      when action in ('members_manage','roles_manage','manage_connections','manage_integrations','manage_templates','catalog_manage','properties_manage') then 'owner_admin_only'
      when action = 'assign' then 'assign_operational'
      when action = 'approve' or action like '%\_approve' escape '\' or action in ('review','verify','reopen','dismiss') then 'approve_internal'
      when action in ('publish','unpublish','execute','reconcile','connect_provider','publish_rates','purchase_authorize','import_commit','cancel_run','enable') then 'publish_execute_external'
      else 'create_edit'
    end as bucket
  from public.privilege_definitions
)
insert into public.role_privileges (role_id, privilege_id, version)
select r.id, b.id, 1
from buckets b
join public.roles r on
     (b.bucket = 'view')
  or (b.bucket = 'billing_ownership' and r.canonical_name = 'workspace_owner')
  or (b.bucket = 'owner_admin_only' and r.canonical_name in ('workspace_owner','administrator'))
  or (b.bucket = 'assign_operational' and r.canonical_name in ('workspace_owner','administrator','manager'))
  or (b.bucket = 'approve_internal' and r.canonical_name in ('workspace_owner','administrator','manager'))
  or (b.bucket = 'publish_execute_external' and r.canonical_name in ('workspace_owner','administrator','manager'))
  or (b.bucket = 'create_edit' and r.canonical_name in ('workspace_owner','administrator','manager','contributor'))
on conflict (role_id, privilege_id, version) do nothing;

-- 12. Backfill: bridge existing Owner/Administrator workspace_memberships
-- into role_assignments. Workspace-wide, no module ambiguity -- safe and
-- mechanical. Operator/Contributor/Viewer rows are deliberately NOT
-- bridged (see plan): mapping a legacy operator to a specific module needs
-- real product input and is out of scope for this foundation migration.
insert into public.role_assignments (subject_id, role_id, workspace_id, module, scope_type, scope_id, assigner_id, reason)
select m.profile_id, r.id, m.workspace_id, null, 'workspace', null, m.profile_id,
       'pa-001 backfill: bridged from workspace_memberships'
from public.workspace_memberships m
join public.roles r on r.canonical_name = case m.role when 'owner' then 'workspace_owner' else 'administrator' end
where m.role in ('owner','administrator') and m.status = 'active'
on conflict do nothing;

commit;
