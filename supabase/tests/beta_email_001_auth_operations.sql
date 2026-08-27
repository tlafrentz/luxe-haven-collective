\set ON_ERROR_STOP on
begin;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('be000001-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','beta-email-admin@example.invalid',crypt('Local-BETA-EMAIL-Only!',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.profiles(id,email,full_name,role) values('be000001-0000-4000-8000-000000000001','beta-email-admin@example.invalid','BETA Email Admin','admin')
on conflict(id) do update set email=excluded.email,full_name=excluded.full_name,role=excluded.role;

do $$ begin
 if (select mode from public.auth_public_control where control_key='public_auth')<>'closed' then raise exception 'BETA_EMAIL_SAFE_DEFAULT_FAILED'; end if;
 if (select hourly_email_ceiling from public.auth_public_control where control_key='public_auth')<>30 then raise exception 'BETA_EMAIL_CEILING_FAILED'; end if;
end $$;

select set_config('request.jwt.claim.role','authenticated',true);
select set_config('request.jwt.claim.sub','be000001-0000-4000-8000-000000000001',true);
select public.set_public_auth_mode('invite_only',1,'Local governed transition','be000002-0000-4000-8000-000000000001','beta-email-mode-command-0001');
select public.set_public_auth_mode('invite_only',1,'Local governed transition','be000002-0000-4000-8000-000000000001','beta-email-mode-command-0001');
do $$ begin
 if (select count(*) from public.auth_public_control_audit where correlation_id='be000002-0000-4000-8000-000000000001')<>1 then raise exception 'BETA_EMAIL_MODE_REPLAY_DUPLICATED'; end if;
 begin
  perform public.set_public_auth_mode('broad_beta',1,'Stale transition denied','be000002-0000-4000-8000-000000000002','beta-email-mode-command-0002');
  raise exception 'BETA_EMAIL_STALE_VERSION_ALLOWED';
 exception when others then if sqlerrm='BETA_EMAIL_STALE_VERSION_ALLOWED' then raise; end if; end;
end $$;

insert into public.auth_email_requests(correlation_id,flow_type,recipient_digest,recipient_provider,provider_message_id)
values('be000002-0000-4000-8000-000000000003','recovery',repeat('a',64),'microsoft','message-001');
select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claim.sub','',true);
select public.process_resend_auth_event('event-001','email.delivered','message-001',now(),repeat('b',64),repeat('a',64),'microsoft',null);
select public.process_resend_auth_event('event-001','email.delivered','message-001',now(),repeat('b',64),repeat('a',64),'microsoft',null);
do $$ begin
 if (select count(*) from public.auth_email_webhook_receipts where provider_event_id='event-001')<>1 then raise exception 'BETA_EMAIL_WEBHOOK_REPLAY_DUPLICATED'; end if;
 if (select status from public.auth_email_requests where provider_message_id='message-001')<>'delivered' then raise exception 'BETA_EMAIL_DELIVERY_NOT_PROJECTED'; end if;
 begin
  perform public.process_resend_auth_event('event-001','email.delivered','message-001',now(),repeat('c',64),repeat('a',64),'microsoft',null);
  raise exception 'BETA_EMAIL_CHANGED_WEBHOOK_REPLAY_ALLOWED';
 exception when others then if sqlerrm='BETA_EMAIL_CHANGED_WEBHOOK_REPLAY_ALLOWED' then raise; end if; end;
end $$;

insert into public.auth_email_requests(correlation_id,flow_type,recipient_digest,recipient_provider,provider_message_id)
values('be000002-0000-4000-8000-000000000004','recovery',repeat('d',64),'other','message-002');
select public.process_resend_auth_event('event-002','email.bounced','message-002',now(),repeat('e',64),repeat('d',64),'other','permanent');
do $$ begin
 if (select count(*) from public.auth_email_suppressions where recipient_digest=repeat('d',64) and active)<>1 then raise exception 'BETA_EMAIL_HARD_BOUNCE_NOT_SUPPRESSED'; end if;
 if (select count(*) from public.auth_email_operational_alerts where alert_type='bounced_hard')<>1 then raise exception 'BETA_EMAIL_HARD_BOUNCE_NOT_ALERTED'; end if;
end $$;

set local role anon;
do $$ begin
 begin
  perform count(*) from public.auth_email_webhook_receipts;
  raise exception 'BETA_EMAIL_ANON_READ_ALLOWED';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
