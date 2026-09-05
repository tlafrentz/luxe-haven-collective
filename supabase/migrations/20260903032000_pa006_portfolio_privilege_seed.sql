begin;

insert into public.privilege_definitions (id, module, resource, action, label, description, sensitivity, allowed_scopes) values
('portfolio.decision.approve','portfolio','decision','approve','Approve portfolio decision','Approve a reviewed portfolio strategic decision.','critical','{workspace,portfolio,property,project}')
on conflict (id) do update set
  label = excluded.label, description = excluded.description,
  sensitivity = excluded.sensitivity, allowed_scopes = excluded.allowed_scopes;

-- canApprovePortfolioDecision only allows the literal legacy "owner" role
-- (not administrator/manager), so — unlike PA-001's mechanical
-- 'approve_internal' bucket (workspace_owner + administrator + manager) —
-- this privilege is deliberately granted to workspace_owner only, to keep
-- the seeded default composition consistent with the real check it will
-- eventually back.
insert into public.role_privileges (role_id, privilege_id, version)
select r.id, 'portfolio.decision.approve', 1
from public.roles r
where r.canonical_name = 'workspace_owner'
on conflict (role_id, privilege_id, version) do nothing;

commit;
