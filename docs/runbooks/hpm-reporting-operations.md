# HPM reporting and operations runbook

## Report generation failure

Trigger: stable `HPM_REPORT_GENERATION_FAILED` or a report error-rate breach. Confirm actor-safe scope, correlation ID, report/metric versions, source freshness, and feature flags. Retry the read once only after verifying source availability. Do not edit source records or report history. Disable `HPM_STANDARD_REPORTS_ENABLED` if failures are systemic; escalate when the same bounded request fails twice.

## Source unavailable, stale, or incompatible

Trigger: source freshness is unavailable/stale or contract version unsupported. Inspect capability key, contract version, last successful as-of, and stable failure classification. Preserve partial authorized sections. Use the owning capability’s health checks; never substitute zero or raw provider data. Disable reporting only if a required source makes results unsafe.

## Partial, degraded, or reconciliation failure

Confirm coverage, unavailable source list, metric policy, authorized detail, and checksum. Do not compare restricted totals. For reconciliation failures, stop export generation and retain correlation/version metadata. Escalate before changing any metric policy.

## Export failure or backlog

Confirm report run, format, checksum stage, retention state, and safe classification. Retry only with the same idempotency key. Never expose partial files or signed URLs in logs. Disable `HPM_REPORT_EXPORTS_ENABLED` while preserving interactive reports if failures persist.

## Bounded refresh or projection rebuild

Require owner/administrator authority, explicit tenant/property target, reason, expected version where applicable, idempotency and correlation IDs, maximum 10,000 records, and maximum five minutes. Run dry-run first for portfolio rebuilds. Verify one admitted job, no source-domain mutations, unchanged historical runs, and refreshed projection version. Stop and escalate on a scope mismatch or a second terminal failure.

## Cache invalidation

Invalidate only an `hpm-report:` namespace derived from the authorized request. Verify the affected definition/source version and bounded entry count. Never clear an entire shared cache by default. Cache outage must fall back to authorized uncached composition.

## Queue, worker, or telemetry degradation

Disable `HPM_OPERATIONAL_COMMANDS_ENABLED` if durable jobs cannot be observed. Read-only health remains available. Telemetry failure must not change report values; use safe correlation metadata and application health logs. Never replay an operation without its original idempotency key.

## Feature disablement and HPM-001F rollback preparation

Disable exports, commands, health, then reports independently. Owning capability and HPM-001D routes remain available. This slice has no migration to roll back. Verify navigation removal, direct-route safe denial, unchanged source records, and clean report/export job state before the HPM-001F rollout or rollback point.
