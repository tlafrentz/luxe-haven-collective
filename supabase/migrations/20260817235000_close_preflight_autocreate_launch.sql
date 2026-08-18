update public.guidebook_controlled_extraction_launches l
set status='closed_failed',closed_at=now()
where l.correlation_id='714c2bff-bb4c-4d50-a608-c1a6b198d55b'
  and l.operation_code='controlled_guidebook_creation_journey_v1'
  and l.status='cleanup_required'
  and not exists(
    select 1 from public.production_verification_attempts a
    where a.idempotency_key_hash like '%:'||l.id::text
  );
