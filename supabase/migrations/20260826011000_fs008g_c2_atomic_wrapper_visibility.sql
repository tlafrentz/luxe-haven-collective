-- FS-008G-C2 correction: the atomic wrapper must perform its narrowly scoped
-- eligibility reads under the same database-owned boundary as the resolver.
-- Explicit authenticated Admin checks remain authoritative.
begin;

alter function public.apply_furnishing_activation_control_c2(jsonb,jsonb,jsonb,text) security definer;

revoke all on function public.apply_furnishing_activation_control_c2(jsonb,jsonb,jsonb,text) from public,anon;
grant execute on function public.apply_furnishing_activation_control_c2(jsonb,jsonb,jsonb,text) to authenticated;

commit;
