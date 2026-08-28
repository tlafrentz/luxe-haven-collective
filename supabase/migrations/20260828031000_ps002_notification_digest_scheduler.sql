-- PS-002: invoke the protected digest worker without relying on Vercel Pro cron.
begin;

create extension if not exists pg_cron;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='ps002-notification-digests';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;

  perform cron.schedule(
    'ps002-notification-digests',
    '*/15 * * * *',
    $job$
      select net.http_get(
        url := 'https://luxehavencollective.co/api/internal/notifications/digests',
        headers := jsonb_build_object('Authorization','Bearer '||decrypted_secret),
        timeout_milliseconds := 30000
      )
      from vault.decrypted_secrets
      where name='notification_digest_scheduler_secret'
    $job$
  );
end $$;

revoke all on schema cron from public,anon,authenticated;

commit;
