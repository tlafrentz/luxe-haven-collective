# Learning Operations Runbook

Review `/admin/learning` for health, alerts, and queue size. Investigate review backlog, evidence decline, contradiction growth, failed measurements, overdue calibration, and coverage gaps through their dedicated workspaces.

Retry only failures classified as transient. A retry appends a governance job and audit action; it does not edit the failed job or historical Learning record. Permission, scope, malformed evidence, and incompatible-policy failures require correction rather than retry.

For contradictions, preserve both lessons while evidence is compared. Resolve through refinement, merge, supersession, confirmed contradiction, or retirement. For calibration, publish a new lesson revision after approval.
