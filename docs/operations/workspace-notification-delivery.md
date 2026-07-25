# Workspace Notification Delivery

In-app storage is canonical; email is a delivery channel. An email failure retains the in-app record and a bounded failed delivery attempt. Retry must use the same notification/channel uniqueness boundary to prevent duplicate delivery.

Quiet hours use an IANA timezone and may span midnight. Critical alerts bypass quiet hours. Non-critical immediate messages are deferred or included in the configured digest. Suspended and removed memberships are ineligible for ordinary generation and cannot read or update preferences.

Operations should monitor queued/failed delivery counts without exposing personal quiet hours, contact details, guest data, internal IDs, or raw provider errors.
