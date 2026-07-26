# Report storage and sharing

Structured snapshots are stored in controlled JSONB with a two-megabyte limit. HTML and PDF artifacts use the private `report-artifacts` bucket. Storage paths are never public; authenticated downloads use five-minute signed URLs.

External shares store only SHA-256 token hashes. A share is scoped to one report, read-only, expiring, view-limited, and revocable. Access is resolved through a server boundary and logged. Financial reports reject external sharing by policy.
