-- LHS-001 v2.0 fix: resolve payment_invitations for payment_intent.* events.
--
-- Found during Stripe sandbox verification: paying produces both
-- checkout.session.completed and payment_intent.succeeded. The latter carries
-- only the payment intent id, which isn't stored on the invitation until the
-- payment completes, so confirm_booking_from_payment could not find the
-- invitation and recorded a failed receipt plus an open
-- payment_invitation_not_found exception on every real payment. The booking
-- itself confirmed correctly (via the checkout.session.completed event); this
-- removes the false alarm by falling back to the request/quote ids in the
-- server-set payment metadata. Row locking on the invitation still serializes
-- the two events, so whichever arrives first confirms and the other is an
-- idempotent no-op.
begin;

create or replace function public.confirm_booking_from_payment(p_event jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_environment text := p_event->>'environment';
  v_event_type text := p_event->>'providerEventType';
  v_provider_event_id text := p_event->>'providerEventId';
  v_session_id text := nullif(p_event->>'providerCheckoutSessionId','');
  v_intent_id text := nullif(p_event->>'providerPaymentIntentId','');
  v_amount bigint := nullif(p_event->>'amountMinor','')::bigint;
  v_currency text := upper(nullif(p_event->>'currency',''));
  v_meta_request_id uuid := case when nullif(p_event->'metadata'->>'booking_request_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (p_event->'metadata'->>'booking_request_id')::uuid end;
  v_meta_quote_id uuid := case when nullif(p_event->'metadata'->>'quote_id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (p_event->'metadata'->>'quote_id')::uuid end;
  v_receipt_id uuid;
  v_existing_status text;
  v_invitation public.payment_invitations%rowtype;
  v_request public.booking_requests%rowtype;
  v_block public.calendar_blocks%rowtype;
  v_quote public.request_quotes%rowtype;
  v_guest public.booking_request_guests%rowtype;
  v_booking_id uuid;
  v_exception_id uuid;
begin
  insert into public.booking_payment_events(environment, provider_event_id, provider_event_type, provider_created_at, status, normalized_event)
  values (v_environment, v_provider_event_id, v_event_type, nullif(p_event->>'providerCreatedAt','')::timestamptz, 'received', p_event)
  on conflict (environment, provider_event_id) do nothing
  returning id into v_receipt_id;

  if v_receipt_id is null then
    select id, status into v_receipt_id, v_existing_status from public.booking_payment_events
      where environment = v_environment and provider_event_id = v_provider_event_id;
    if v_existing_status in ('processed','ignored') then
      return jsonb_build_object('status','duplicate','receiptId',v_receipt_id);
    end if;
  end if;

  if v_event_type not in ('checkout.completed','payment.succeeded','payment.failed','payment.cancelled','checkout.expired') then
    update public.booking_payment_events set status='ignored', processed_at=now() where id=v_receipt_id;
    return jsonb_build_object('status','ignored','receiptId',v_receipt_id);
  end if;

  select * into v_invitation from public.payment_invitations
    where environment = v_environment
      and (
        (v_session_id is not null and stripe_checkout_session_id = v_session_id)
        or (v_intent_id is not null and stripe_payment_intent_id = v_intent_id)
      )
    for update;

  -- Stripe sends payment_intent.* events whose intent id is not yet stored on
  -- the invitation (the intent only exists once the guest pays), so those
  -- events can't match by session/intent id. They do carry the server-set
  -- request/quote ids in metadata — resolve through that, still scoped to
  -- environment and the single live invitation for that request.
  if not found and v_meta_request_id is not null then
    select * into v_invitation from public.payment_invitations
      where environment = v_environment
        and booking_request_id = v_meta_request_id
        and (v_meta_quote_id is null or quote_id = v_meta_quote_id)
        and status in ('created','started','succeeded')
      order by created_at desc
      limit 1
      for update;
  end if;

  if not found then
    update public.booking_payment_events set status='failed', last_error_code='payment_invitation_not_found', processed_at=now() where id=v_receipt_id;
    insert into public.booking_exceptions(issue_type, status, provider_evidence, next_action)
      values ('payment_invitation_not_found', 'open', jsonb_build_object('providerEventId', v_provider_event_id, 'sessionId', v_session_id, 'intentId', v_intent_id), 'Reconcile against Stripe dashboard; no local invitation matched this event.')
      returning id into v_exception_id;
    return jsonb_build_object('status','review_required','receiptId',v_receipt_id,'exceptionId',v_exception_id);
  end if;

  -- Idempotent re-delivery of an already-succeeded invitation.
  if v_invitation.status = 'succeeded' then
    select id into v_booking_id from public.bookings where payment_invitation_id = v_invitation.id;
    update public.booking_payment_events set status='processed', related_payment_invitation_id=v_invitation.id, related_booking_request_id=v_invitation.booking_request_id, processed_at=now() where id=v_receipt_id;
    return jsonb_build_object('status','processed','receiptId',v_receipt_id,'bookingId',v_booking_id,'duplicate',true);
  end if;

  if v_event_type in ('payment.failed','payment.cancelled') then
    update public.payment_invitations set status='failed', stripe_payment_intent_id=coalesce(v_intent_id, stripe_payment_intent_id), updated_at=now() where id=v_invitation.id;
    update public.booking_requests set status='payment_failed', updated_at=now() where id=v_invitation.booking_request_id and status='awaiting_payment';
    update public.booking_payment_events set status='processed', related_payment_invitation_id=v_invitation.id, related_booking_request_id=v_invitation.booking_request_id, processed_at=now() where id=v_receipt_id;
    return jsonb_build_object('status','processed','receiptId',v_receipt_id,'outcome','payment_failed');
  end if;

  if v_event_type = 'checkout.expired' then
    update public.payment_invitations set status='expired', updated_at=now() where id=v_invitation.id and status in ('created','started');
    update public.booking_requests set status='expired', updated_at=now() where id=v_invitation.booking_request_id and status='awaiting_payment';
    update public.booking_payment_events set status='processed', related_payment_invitation_id=v_invitation.id, related_booking_request_id=v_invitation.booking_request_id, processed_at=now() where id=v_receipt_id;
    return jsonb_build_object('status','processed','receiptId',v_receipt_id,'outcome','expired');
  end if;

  -- checkout.completed / payment.succeeded: the confirmation path.
  if v_intent_id is not null then
    update public.payment_invitations set stripe_payment_intent_id = v_intent_id where id = v_invitation.id and stripe_payment_intent_id is null;
  end if;

  select * into v_request from public.booking_requests where id = v_invitation.booking_request_id for update;
  select * into v_block from public.calendar_blocks where id = v_invitation.calendar_block_id for update;
  select * into v_quote from public.request_quotes where id = v_invitation.quote_id;
  select * into v_guest from public.booking_request_guests where booking_request_id = v_request.id;

  -- Defense in depth: re-check the hard gate at confirmation time, not just
  -- invitation-creation time (LHS-CNF-001 "confirm eligibility").
  if v_request.status <> 'awaiting_payment'
     or v_block.status <> 'active'
     or v_block.expires_at <= now()
     or v_block.booking_request_id <> v_request.id
     or v_block.quote_id <> v_invitation.quote_id
     or (v_amount is not null and v_amount <> v_invitation.amount_minor)
     or (v_currency is not null and v_currency <> upper(v_invitation.currency))
  then
    update public.booking_payment_events set status='failed', last_error_code='gate_invalid_at_confirmation', processed_at=now() where id=v_receipt_id;
    insert into public.booking_exceptions(issue_type, property_id, booking_request_id, status, provider_evidence, next_action)
      values ('payment_verified_gate_invalid', v_request.property_id, v_request.id, 'open',
        jsonb_build_object('providerEventId', v_provider_event_id, 'requestStatus', v_request.status, 'blockStatus', v_block.status, 'eventAmount', v_amount, 'invitationAmount', v_invitation.amount_minor),
        'Payment was verified by Stripe but the calendar-block gate was no longer valid. Reconcile manually — do not confirm without re-establishing the block.')
      returning id into v_exception_id;
    return jsonb_build_object('status','review_required','receiptId',v_receipt_id,'exceptionId',v_exception_id);
  end if;

  insert into public.bookings(
    property_id, guest_id, check_in, check_out, guests, total_amount, currency, status,
    source, external_provider, booking_code, guest_full_name, guest_email, guest_phone,
    nightly_rate, cleaning_fee, taxes,
    payment_status, stripe_payment_intent_id, booking_request_id, payment_invitation_id
  ) values (
    v_request.property_id, null, v_request.arrival, v_request.departure, coalesce(v_request.guest_count, 1),
    v_invitation.amount_minor / 100.0, v_invitation.currency, 'confirmed',
    'Luxe Haven Direct', null, 'LHS-MESA-' || upper(substr(v_invitation.id::text, 1, 8)),
    v_guest.full_name, v_guest.email, v_guest.phone,
    coalesce(v_quote.nightly_rate_minor, 0) / 100.0, coalesce(v_quote.cleaning_fee_minor, 0) / 100.0, coalesce(v_quote.tax_minor, 0) / 100.0,
    'paid', v_intent_id, v_request.id, v_invitation.id
  ) returning id into v_booking_id;

  update public.payment_invitations set status='succeeded', updated_at=now() where id = v_invitation.id;
  update public.booking_requests set status='confirmed', updated_at=now() where id = v_request.id;
  update public.calendar_blocks set status='consumed' where id = v_block.id;
  update public.booking_payment_events set status='processed', related_payment_invitation_id=v_invitation.id, related_booking_request_id=v_request.id, processed_at=now() where id=v_receipt_id;

  return jsonb_build_object('status','processed','receiptId',v_receipt_id,'bookingId',v_booking_id,'outcome','confirmed');
exception when others then
  update public.booking_payment_events set status='failed', last_error_code=sqlerrm, last_error_message='Booking payment event requires operational review.', processed_at=now() where id=v_receipt_id;
  insert into public.booking_exceptions(issue_type, status, provider_evidence, next_action)
    values ('booking_confirmation_failed', 'open', jsonb_build_object('providerEventId', v_provider_event_id, 'sqlError', sqlerrm), 'A verified payment could not be atomically confirmed. Reconcile Stripe and the booking_requests/bookings tables manually.');
  return jsonb_build_object('status','failed','receiptId',v_receipt_id,'errorCode',sqlerrm);
end $$;
revoke all on function public.confirm_booking_from_payment(jsonb) from public,anon,authenticated;
grant execute on function public.confirm_booking_from_payment(jsonb) to service_role;

commit;
