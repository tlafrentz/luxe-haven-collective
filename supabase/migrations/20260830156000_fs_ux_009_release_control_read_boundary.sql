-- FS-UX-009 bounded correction: authenticated Release Controls capability projection.
-- The browser uses the existing workspace-bound resolver as its sole read contract.
begin;

revoke all on table public.furnishing_activation_capabilities from anon;
revoke select on table public.furnishing_activation_capabilities from authenticated;
revoke all on function public.resolve_furnishing_activation_control(text,text,text) from public, anon;
grant execute on function public.resolve_furnishing_activation_control(text,text,text) to authenticated, service_role;

commit;
