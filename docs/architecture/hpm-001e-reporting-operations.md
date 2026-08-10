# HPM-001E — Reporting and Operations

HPM reporting is a read-oriented layer over HPM-001A–D. Ten immutable report definitions reference versioned metric definitions. The report service authorizes scope before aggregation, validates dates, time zones, filters and dimensions, and consumes the HPM lifecycle and attention projections. React receives only report-ready values and never implements metric formulas.

Reports preserve definition, metric-policy, source-contract, freshness, as-of, scope, coverage, caveat, and checksum metadata. Current source adapters cannot reconstruct arbitrary historical source state, so a report is reproducible only while its referenced source versions remain reconstructable; the report says so through source metadata and limitations.

CSV and print-ready exports are generated server-side from the same authorized report result. Export IDs are idempotent per run and format, filenames contain only stable report/date values, content is checksummed, and access is private/no-store. The v1 implementation returns exports synchronously because current report payloads are bounded; long-running export persistence and workers remain disabled.

The cache contract includes tenant, actor, roles, authorized properties, permission fingerprint, definition and metric versions, dates, time zone, filters, dimensions, comparison, locale/currency, and source fingerprint. The production composition does not enable a cross-request cache until a shared bounded adapter is configured.

Operational health exposes safe source, projection, report, export, cache, job, flag, and degraded-mode metadata. The provider-neutral operation admission service validates authority, bounded scope, reason, idempotency, dry-run, record limits, and duration limits. Production mutation routes remain disabled until HPM-001F supplies a durable job repository and audited worker; read-only operational health can be enabled independently.

Independent server flags default off:

- `HPM_STANDARD_REPORTS_ENABLED`
- `HPM_REPORT_EXPORTS_ENABLED`
- `HPM_OPERATIONAL_HEALTH_ENABLED`
- `HPM_OPERATIONAL_COMMANDS_ENABLED`

Disabling them leaves HPM and owning capability workspaces intact. This slice adds no persistence or migration and does not authorize production rollout.

Service-level objectives for Platform v1 rehearsal are: cached summary under 500 ms, uncached bounded summary under 3 seconds, 99% report success excluding source unavailability, 99% export success, and source freshness within each source policy. HPM-001F must collect representative non-production evidence before enablement.
