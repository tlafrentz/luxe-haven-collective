begin;

-- ProductDetail renders through the trusted server client. Keep its direct read
-- surface to the three columns needed to resolve one workspace-scoped adoption.
revoke all on table public.furnishing_product_adoptions from service_role;
grant select (workspace_id, source_product_id, workspace_product_id)
  on table public.furnishing_product_adoptions
  to service_role;

commit;
