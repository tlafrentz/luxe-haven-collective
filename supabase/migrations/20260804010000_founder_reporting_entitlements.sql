-- Provision the founding workspace with the governed reporting capabilities
-- that are already enabled for its production customer account.
with founding_customer as (
  select id, workspace_id, profile_id
  from public.commerce_customers
  where id = 'commerce-customer-todd-founder'
    and status = 'active'
    and workspace_id is not null
), reporting_entitlements(id_suffix, entitlement_key) as (
  values
    ('reports-generate', 'reports.generate'),
    ('investment-reports-generate', 'investment.reports.generate'),
    ('portfolio-reports-generate', 'portfolio.reports.generate'),
    ('financial-reports-generate', 'financial.reports.generate'),
    ('reports-download', 'reports.download'),
    ('reports-share', 'reports.share')
)
insert into public.commerce_entitlement_grants (
  id,
  entitlement_template_id,
  entitlement_key,
  scope_type,
  workspace_id,
  profile_id,
  source_type,
  source_id,
  environment,
  status,
  effective_from,
  activation_reason
)
select
  'commerce-grant-todd-' || entitlement.id_suffix,
  template.id,
  entitlement.entitlement_key,
  'workspace',
  customer.workspace_id,
  customer.profile_id,
  'founding-partner',
  'todd-founder-reporting-access',
  'live',
  'active',
  now(),
  'Founding workspace reporting access provisioned.'
from founding_customer customer
cross join reporting_entitlements entitlement
join public.commerce_entitlement_templates template
  on template.entitlement_key = entitlement.entitlement_key
 and template.status = 'active'
on conflict do nothing;
