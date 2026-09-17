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

// LHS-AN-001: the Mesa direct-booking funnel.
export type DirectBookingEvent =
  | "stay_property_viewed"
  | "stay_availability_interaction"
  | "stay_quote_shown"
  | "stay_checkout_launched"
  | "stay_booking_verified"
  | "stay_booking_cancelled";

export type TrackedEvent = CommerceOnboardingEvent | DirectBookingEvent;

export function track(event: TrackedEvent, props?: Record<string, unknown>) {
  console.log("[track]", event, props ?? {});
}
