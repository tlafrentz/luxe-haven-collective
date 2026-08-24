-- Restore table privilege only; the existing workspace-property RLS policy
-- remains authoritative for tenant-scoped booking visibility.
grant select on public.bookings to authenticated;

alter table public.ps001d_verification_claims drop constraint ps001d_verification_claims_status_check;
alter table public.ps001d_verification_claims add constraint ps001d_verification_claims_status_check
  check(status in('acquired','consumed','verifying','cleaning','completed','failed','failed_cleaned','expired'));

create or replace function public.ps001d_guard_claim_change() returns trigger language plpgsql set search_path='' as $$begin
 if row(new.milestone,new.candidate_commit,new.deployment_id,new.tenant_id,new.correlation_id,new.operator_id,new.acquired_at,new.expires_at) is distinct from row(old.milestone,old.candidate_commit,old.deployment_id,old.tenant_id,old.correlation_id,old.operator_id,old.acquired_at,old.expires_at) then raise exception 'PS001D_CLAIM_BINDING_IMMUTABLE';end if;
 if old.status in('completed','failed','failed_cleaned','expired') then raise exception 'PS001D_CLAIM_TERMINAL';end if;
 if (old.status='acquired' and new.status not in('consumed','failed','expired')) or (old.status='consumed' and new.status not in('verifying','failed')) or (old.status='verifying' and new.status not in('cleaning')) or (old.status='cleaning' and new.status not in('completed','failed_cleaned')) then raise exception 'PS001D_CLAIM_TRANSITION_INVALID';end if;
 if old.mutation_started_at is not null and new.mutation_started_at is distinct from old.mutation_started_at then raise exception 'PS001D_CLAIM_CONSUMPTION_IMMUTABLE';end if;return new;end$$;

create or replace function public.begin_failed_ps001d_cleaning(p_actor_id uuid,p_claim_id uuid,p_failure_code text)
returns public.ps001d_verification_claims language plpgsql security definer set search_path='' as $$declare c public.ps001d_verification_claims;begin
 perform public.ps001d_assert_service_admin(p_actor_id);
 if p_failure_code!~'^[A-Z0-9_]{1,80}$' then raise exception 'PS001D_FAILURE_CODE_INVALID';end if;
 update public.ps001d_verification_claims set status='cleaning',stable_failure_code=p_failure_code where id=p_claim_id and status='verifying' returning*into c;
 if not found then raise exception 'PS001D_FAILED_CLEANING_NOT_READY';end if;
 insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code)values(c.id,c.correlation_id,p_actor_id,'ps001d_failed_cleaning_started',p_failure_code);
 return c;end$$;

create or replace function public.complete_failed_ps001d_cleanup(p_actor_id uuid,p_claim_id uuid)
returns public.ps001d_verification_claims language plpgsql security definer set search_path='' as $$declare c public.ps001d_verification_claims;begin
 perform public.ps001d_assert_service_admin(p_actor_id);select*into c from public.ps001d_verification_claims where id=p_claim_id for update;
 if not found or c.status<>'cleaning' or c.stable_failure_code is null or exists(select 1 from public.ps001d_verification_resource_ledger where claim_id=p_claim_id and status not in('cleaned','retained')) then raise exception 'PS001D_FAILED_RECONCILIATION_INCOMPLETE';end if;
 update public.ps001d_verification_identity_authorizations set revoked_at=coalesce(revoked_at,now())where correlation_id=c.correlation_id;
 update public.ps001d_verification_claims set status='failed_cleaned',completed_at=now()where id=p_claim_id returning*into c;
 insert into public.ps001d_verification_audit(claim_id,correlation_id,actor_id,event_type,outcome_code,safe_metadata)values(c.id,c.correlation_id,p_actor_id,'ps001d_failed_cleanup_completed',c.stable_failure_code,jsonb_build_object('ledgerResolved',true));return c;end$$;

revoke all on function public.begin_failed_ps001d_cleaning(uuid,uuid,text),public.complete_failed_ps001d_cleanup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_failed_ps001d_cleaning(uuid,uuid,text),public.complete_failed_ps001d_cleanup(uuid,uuid) to service_role;
