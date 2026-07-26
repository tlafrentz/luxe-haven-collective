# Platform Reporting architecture

`src/platform/reporting` contains provider-independent domain contracts, application policies, renderer boundaries, and presentation components.

Feature domains expose serializable report-ready projections through bounded ports. Reporting validates scope, entitlement, definition, template, lineage, and required sections before snapshot creation. The projection is cloned and deeply frozen, persisted once, and rendered without feature calculations.

Infrastructure owns private storage, checksums, signed access, job leases, and share-token hashing. PDF engines can replace the fallback renderer through `ReportDocumentRenderer` without changing report snapshots.
