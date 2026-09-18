export type CommerceOnboardingEvent =
  | "homepage_action"
  | "plan_selected"
  | "workspace_configuration_completed"
  | "account_created"
  | "checkout_started"
  | "checkout_completed"
  | "purchase_completed"
  | "activation_started"
  | "workspace_setup_started"
  | "workspace_settings_completed"
  | "pms_connection_selected"
  | "property_import_completed"
  | "portfolio_verified"
  | "team_invited"
  | "team_step_skipped"
  | "workspace_setup_completed";

// LHS-AN-001: the Mesa direct-booking-REQUEST funnel (v2.0). Superseded
// v1's Hospitable-Direct-checkout funnel (stay_checkout_launched,
// stay_booking_verified) with the request/review/block/payment lifecycle.
export type DirectBookingEvent =
  | "property_viewed"
  | "request_started"
  | "request_submitted"
  | "alternate_proposed"
  | "request_approved"
  | "block_recorded"
  | "payment_invited"
  | "payment_started"
  | "payment_verified"
  | "booking_confirmed"
  | "request_declined"
  | "request_withdrawn"
  | "request_expired";

export type TrackedEvent = CommerceOnboardingEvent | DirectBookingEvent;

export function track(event: TrackedEvent, props?: Record<string, unknown>) {
  console.log("[track]", event, props ?? {});
}
