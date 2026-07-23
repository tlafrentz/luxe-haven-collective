# IA-002A.7.4 — Requirements & Closing Persistence

Operational state is persisted as normalized contingency, due-diligence, and requirement-history rows. Action, Evidence, and Document relationships are stored as identifier-only JSON arrays; no external capability state or file metadata is copied into the acquisition aggregate.

Requirement outcomes, waivers, concerns, and recorded actors/timestamps remain immutable snapshots. Closing facts remain on the pipeline row as route-discriminated JSON and are validated by the domain when the hydrated aggregate is restored. Readiness is not persisted.

The repository maps requirements and commercial state together before calling `AcquisitionPipeline.restore()`. Requirement rows are ordered by creation time and history by occurred time with stable IDs. Existing pipeline-version optimistic concurrency covers requirement changes; no independent requirement version is introduced.

Command receipts and production unit-of-work orchestration remain deferred to IA-002A.7.5. This slice only extends the repository bundle and persistence schema.
