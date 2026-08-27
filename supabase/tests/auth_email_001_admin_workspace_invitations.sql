begin;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,
  crypt('Local-AUTH-EMAIL-001-Only!',gen_salt('bf')),now(),'{}','{}',now(),now()
from (values
  ('ae000001-0000-4000-8000-000000000001'::uuid,'admin-auth-email@example.invalid'),
  ('ae000001-0000-4000-8000-000000000002'::uuid,'existing-owner-auth-email@example.invalid'),
  ('ae000001-0000-4000-8000-000000000003'::uuid,'invitee-auth-email@example.invalid'),
  ('ae000001-0000-4000-8000-000000000004'::uuid,'wrong-auth-email@example.invalid')
) fixture(id,email);
insert into public.profiles(id,email,full_name,role) values
('ae000001-0000-4000-8000-000000000001','admin-auth-email@example.invalid','Admin','admin'),
('ae000001-0000-4000-8000-000000000002','existing-owner-auth-email@example.invalid','Existing Owner','owner'),
('ae000001-0000-4000-8000-000000000003','invitee-auth-email@example.invalid','Invitee','owner'),
('ae000001-0000-4000-8000-000000000004','wrong-auth-email@example.invalid','Wrong','owner')
on conflict(id) do update set email=excluded.email,full_name=excluded.full_name,role=excluded.role;
insert into public.owners(id,profile_id,company_name) values
('ae000002-0000-4000-8000-000000000001','ae000001-0000-4000-8000-000000000002','AUTH EMAIL Controlled');
insert into public.workspace_memberships(workspace_id,profile_id,role,status,property_access_mode,joined_at) values
('ae000002-0000-4000-8000-000000000001','ae000001-0000-4000-8000-000000000002','owner','active','all',now());

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','ae000001-0000-4000-8000-000000000001',true);

select public.create_admin_workspace_owner_invitation(
  'ae000002-0000-4000-8000-000000000001',
  ' INVITEE-AUTH-EMAIL@EXAMPLE.INVALID ',
  pg_catalog.encode(extensions.digest('controlled-token','sha256'),'hex'),
  now()+interval '1 day',
  'ae000003-0000-4000-8000-000000000001',
  'auth-email-command-0001',
  'Controlled owner verification'
);

-- Exact command replay returns the one authoritative pending invitation.
select public.create_admin_workspace_owner_invitation(
  'ae000002-0000-4000-8000-000000000001',
  'invitee-auth-email@example.invalid',
  repeat('0',64),
  now()+interval '2 days',
  'ae000003-0000-4000-8000-000000000001',
  'auth-email-command-0001',
  'Controlled owner verification'
);

do $$ begin
  if (select count(*) from public.workspace_invitations where correlation_id='ae000003-0000-4000-8000-000000000001')<>1 then
    raise exception 'AUTH_EMAIL_INVITATION_REPLAY_DUPLICATED';
  end if;
  if (select email from public.workspace_invitations where correlation_id='ae000003-0000-4000-8000-000000000001')<>'invitee-auth-email@example.invalid' then
    raise exception 'AUTH_EMAIL_INVITATION_EMAIL_NOT_NORMALIZED';
  end if;
end $$;

-- Changed replay is rejected.
do $$ begin
  perform public.create_admin_workspace_owner_invitation(
    'ae000002-0000-4000-8000-000000000001','invitee-auth-email@example.invalid',repeat('0',64),
    now()+interval '1 day','ae000003-0000-4000-8000-000000000001','auth-email-command-0001','Changed governed reason'
  );
  raise exception 'AUTH_EMAIL_CHANGED_REPLAY_ALLOWED';
exception when sqlstate '22023' then null; end $$;

-- Admin-owner invitations fail closed until the Auth user binding commits.
select set_config('request.jwt.claim.sub','ae000001-0000-4000-8000-000000000003',true);
do $$ begin
  perform public.accept_workspace_invitation('ae000002-0000-4000-8000-000000000001','controlled-token','accept-command-early');
  raise exception 'AUTH_EMAIL_UNBOUND_ACCEPT_ALLOWED';
exception when sqlstate '42501' then null; end $$;

select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','',true);
select public.bind_admin_workspace_invitation_auth_user(
  (select id from public.workspace_invitations where correlation_id='ae000003-0000-4000-8000-000000000001'),
  'ae000001-0000-4000-8000-000000000003','ae000003-0000-4000-8000-000000000001'
);

-- A wrong authenticated recipient cannot consume the bound invitation.
select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','ae000001-0000-4000-8000-000000000004',true);
do $$ begin
  perform public.issue_invitation_password_setup_grant(
    'ae000002-0000-4000-8000-000000000001','controlled-token',repeat('1',64),now()+interval '10 minutes'
  );
  raise exception 'AUTH_EMAIL_WRONG_RECIPIENT_GRANTED';
exception when sqlstate '42501' then null; end $$;

-- Intended setup changes the password, creates exactly one authorized owner membership,
-- consumes the invitation, and appends its audit in one transaction.
select set_config('request.jwt.claim.sub','ae000001-0000-4000-8000-000000000003',true);
select public.issue_invitation_password_setup_grant(
  'ae000002-0000-4000-8000-000000000001','controlled-token',
  pg_catalog.encode(extensions.digest('password-grant-token','sha256'),'hex'),now()+interval '10 minutes'
);
select public.claim_password_setup_grant('password-grant-token','invitation');
update auth.users
set encrypted_password=extensions.crypt('Changed-AUTH-EMAIL-001-Password!',extensions.gen_salt('bf')),updated_at=now()
where id='ae000001-0000-4000-8000-000000000003';
do $$ begin
  if (select count(*) from public.workspace_memberships where workspace_id='ae000002-0000-4000-8000-000000000001' and profile_id='ae000001-0000-4000-8000-000000000003' and role='owner' and status='active')<>1 then
    raise exception 'AUTH_EMAIL_OWNER_MEMBERSHIP_MISSING';
  end if;
  if not exists(select 1 from public.workspace_invitations where correlation_id='ae000003-0000-4000-8000-000000000001' and status='accepted' and consumed_by_profile_id='ae000001-0000-4000-8000-000000000003') then
    raise exception 'AUTH_EMAIL_INVITATION_NOT_CONSUMED';
  end if;
  if not exists(select 1 from public.auth_password_setup_grants where flow='invitation' and status='consumed' and auth_user_id='ae000001-0000-4000-8000-000000000003') then
    raise exception 'AUTH_EMAIL_PASSWORD_GRANT_NOT_CONSUMED';
  end if;
  if not exists(select 1 from auth.users where id='ae000001-0000-4000-8000-000000000003' and encrypted_password=extensions.crypt('Changed-AUTH-EMAIL-001-Password!',encrypted_password)) then
    raise exception 'AUTH_EMAIL_PASSWORD_NOT_UPDATED';
  end if;
  if (select count(*) from public.workspace_access_activity where target_invitation_id=(select id from public.workspace_invitations where correlation_id='ae000003-0000-4000-8000-000000000001') and action='invitation-accepted')<>1 then
    raise exception 'AUTH_EMAIL_ACCEPTANCE_AUDIT_INCORRECT';
  end if;
end $$;

-- Grant replay cannot change the password, duplicate membership, or mutate the accepted invitation.
do $$ begin
  perform public.claim_password_setup_grant('password-grant-token','invitation');
  raise exception 'AUTH_EMAIL_GRANT_REPLAY_ALLOWED';
exception when sqlstate '42501' then null; end $$;
do $$ begin
  if (select count(*) from public.workspace_memberships where workspace_id='ae000002-0000-4000-8000-000000000001' and profile_id='ae000001-0000-4000-8000-000000000003')<>1 then
    raise exception 'AUTH_EMAIL_MEMBERSHIP_DUPLICATED';
  end if;
  if not exists(select 1 from auth.users where id='ae000001-0000-4000-8000-000000000003' and encrypted_password=extensions.crypt('Changed-AUTH-EMAIL-001-Password!',encrypted_password)) then
    raise exception 'AUTH_EMAIL_REPLAY_CHANGED_PASSWORD';
  end if;
end $$;

rollback;
