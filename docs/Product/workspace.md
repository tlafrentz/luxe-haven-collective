# Workspace

## Product mission

Workspace is the canonical customer-facing home for configuring a hospitality business so the Luxe Haven HPM platform can operate correctly. Every part of the product answers: **How is my hospitality business configured?**

It is configuration, not operation, and is intentionally separate from the internal Admin experience. Workspace owns customer business identity and configuration. Admin owns support, system health, provider monitoring, infrastructure, audit, and service delivery.

## Primary users

- Hospitality business owner
- Portfolio operator
- Small hospitality team
- Later: property and operations managers

## Information architecture

The overview presents setup health first, followed by six primary sections. Advanced controls remain hidden until the customer's needs make them relevant.

### Organization

**Mission:** Describe the hospitality business.  
**Question:** Who are we?  
**Owns:** Organization and business name, brand, logo, website, timezone, currency, language, business address, and description.  
**Primary workflows:** Create or update business identity; set regional operating defaults; maintain customer-facing brand details.  
**Future roadmap:** Tax information and legal entities.

### Team

**Mission:** Manage who can access the workspace.  
**Question:** Who works here?  
**Owns:** Members, invitations, roles, permissions, default access, and property access.  
**Primary workflows:** Invite a member; assign a role; grant or revoke workspace and property access.  
**Future roadmap:** Teams, groups, SSO, and customer-facing access history.

### Properties

**Mission:** Configure which properties belong to the workspace.  
**Question:** What business assets belong here?  
**Owns:** Connected-property configuration, property permissions, portfolio inclusion, and default visibility. Property records remain owned by the Properties product.  
**Primary workflows:** Include imported properties; set portfolio visibility; configure member access.  
**Future roadmap:** Groups, tags, collections, and default owners.

### Connected Systems

**Mission:** Connect the external platforms that power the business.  
**Question:** What systems power my business?  
**Owns:** Customer connection configuration for PMS, channels, payments, Google, and email.  
**Primary workflows:** Connect or disconnect a system; review connection scope; choose import behavior. Operational health and provider monitoring remain in Admin.  
**Future roadmap:** QuickBooks, Wheelhouse, PriceLabs, OwnerRez, and Zapier.

### Notifications

**Mission:** Configure information flow.  
**Question:** How do I stay informed?  
**Owns:** Email, SMS, push, digest frequency, executive summaries, critical alerts, and learning summaries.  
**Primary workflows:** Select channels; subscribe to notification types; set digest cadence.  
**Future roadmap:** Slack, Teams, and webhooks.

### Preferences

**Mission:** Configure workspace behavior.  
**Question:** How should Luxe Haven work for me?  
**Owns:** Theme, default landing page, reporting currency, date format, measurement units, and dashboard preferences.  
**Primary workflows:** Set regional formats; choose a landing experience; adjust display and reporting defaults.  
**Future roadmap:** Layouts, saved filters, automation defaults, and experimental features.

## Progressive setup and onboarding

The permanent Workspace information architecture also supports onboarding without restructuring:

1. Configure Organization.
2. Connect a PMS.
3. Import Properties.
4. Invite the Team.
5. Begin Revenue Intelligence.

The overview should calculate configuration state from durable customer data. Until those read models are connected, interface status is representative and actions are non-mutating.

## Deferred scope

Billing, subscriptions, API keys, security, developer tooling, and automation are intentionally deferred. Internal support, platform health, provider monitoring, audits, infrastructure, and the service catalog must not appear in Workspace.

## Acceptance criteria

- Navigation and page language present Workspace as a customer product, not an administrative settings console.
- A configuration overview summarizes organization, team, properties, connections, notifications, and preferences.
- Each of the six sections communicates its mission through a customer question, actionable description, status, and primary action.
- Empty and incomplete states explain what the customer can configure and why it matters.
- The page exposes essential configuration first and defers advanced controls.
- The structure can become the permanent home of onboarding.
- Customer configuration is not duplicated in Admin, and internal operations are not exposed here.
