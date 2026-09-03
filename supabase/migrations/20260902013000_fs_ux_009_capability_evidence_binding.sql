-- FS-UX-009 Production certification correction: bind authoritative
-- capability verification state to its immutable audit event atomically.
begin;

create or replace function public.fsux9_bind_capability_verification_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  capability_name text := new.after_state ->> 'capability';
  verification_result text := new.after_state ->> 'verification';
begin
  if new.event_type <> 'capability-verification-v2' then
    return new;
  end if;

  if capability_name is null
    or verification_result not in ('verified', 'failed')
  then
    raise exception 'FURNISHING_RELEASE_VERIFICATION_EVIDENCE_INVALID';
  end if;

  update public.furnishing_activation_capabilities capability
  set verification_event_id = new.id
  where capability.release_id = new.release_id
    and capability.capability = capability_name
    and capability.verification_state = verification_result
    and capability.verified_by = new.actor_id;

  if not found then
    raise exception 'FURNISHING_RELEASE_VERIFICATION_EVIDENCE_UNBOUND';
  end if;

  return new;
end;
$$;

revoke all on function public.fsux9_bind_capability_verification_evidence()
  from public, anon, authenticated, service_role;

drop trigger if exists fsux9_bind_capability_verification_evidence
  on public.furnishing_activation_audit_events;
create trigger fsux9_bind_capability_verification_evidence
after insert on public.furnishing_activation_audit_events
for each row
when (new.event_type = 'capability-verification-v2')
execute function public.fsux9_bind_capability_verification_evidence();

-- Bind already-completed authoritative v2 verifications deterministically.
with latest_evidence as (
  select distinct on (event.release_id, event.after_state ->> 'capability')
    event.release_id,
    event.after_state ->> 'capability' as capability,
    event.id,
    event.actor_id,
    event.after_state ->> 'verification' as verification
  from public.furnishing_activation_audit_events event
  where event.event_type = 'capability-verification-v2'
    and event.after_state ->> 'verification' in ('verified', 'failed')
  order by event.release_id,
    event.after_state ->> 'capability',
    event.occurred_at desc,
    event.id desc
)
update public.furnishing_activation_capabilities capability
set verification_event_id = evidence.id
from latest_evidence evidence
where capability.release_id = evidence.release_id
  and capability.capability = evidence.capability
  and capability.verification_state = evidence.verification
  and capability.verified_by = evidence.actor_id
  and capability.verification_event_id is null;

commit;
