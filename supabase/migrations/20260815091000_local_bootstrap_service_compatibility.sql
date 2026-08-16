-- The deleted production baseline left fresh local bootstraps without the
-- server-owned privileges used by established administrative repositories.
-- Preserve RLS for ordinary clients while restoring only service-role access.
grant all on public.workspace_memberships, public.workspace_member_property_access to service_role;
grant all on public.guidebooks to service_role;
grant all on public.property_workspace_configuration to service_role;
grant all on public.guidebook_creation_jobs, public.guidebook_creation_attempts,
  public.guidebook_creation_sources, public.guidebook_creation_facts,
  public.guidebook_creation_confirmations, public.guidebook_creation_artifacts,
  public.guidebook_creation_events, public.guidebook_creation_work_items
  to service_role;
grant usage, select on sequence public.guidebook_creation_events_id_seq
  to service_role;
