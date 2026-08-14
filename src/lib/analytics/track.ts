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

export function track(event: CommerceOnboardingEvent, props?: Record<string, unknown>) {
  console.log("[track]", event, props ?? {});
}
