-- CA-001F controlled identity registration metadata contains opaque references only.
alter table public.controlled_verification_identities add column fingerprint text not null default '';
alter table public.controlled_verification_identities add column fixture_ownership_code text not null default 'UNCLASSIFIED';
alter table public.controlled_verification_identities add column retention_classification text not null default 'retain' check(retention_classification in('retain','cleanup_required'));
alter table public.controlled_verification_identities add column registered_by uuid references public.profiles(id);
alter table public.controlled_verification_identities add column registration_correlation_id text;
create unique index controlled_verification_identity_fingerprint_uidx on public.controlled_verification_identities(environment_code,opaque_auth_subject_reference,fingerprint);
create function public.prevent_controlled_identity_origin_mutation()returns trigger language plpgsql set search_path='' as $$begin if new.opaque_auth_subject_reference<>old.opaque_auth_subject_reference or new.identity_type_code<>old.identity_type_code or new.fingerprint<>old.fingerprint then raise exception'Controlled identity origin is immutable';end if;return new;end$$;
create trigger controlled_verification_identity_origin_immutable before update on public.controlled_verification_identities for each row execute function public.prevent_controlled_identity_origin_mutation();
