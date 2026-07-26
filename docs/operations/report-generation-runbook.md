# Report generation runbook

1. Review `/admin/reports/health`.
2. Inspect failed jobs at `/admin/reports/jobs`.
3. Retry only failures classified as retryable.
4. Reuse an existing immutable snapshot when only PDF or storage failed.
5. Never delete and recreate the source Scenario or feature projection.
6. Confirm HTML and PDF artifacts, checksums, storage paths, and activity.

Permission, entitlement, invalid scope, and invalid projection failures require correction rather than retry. A report is not Generated until required artifacts exist.
