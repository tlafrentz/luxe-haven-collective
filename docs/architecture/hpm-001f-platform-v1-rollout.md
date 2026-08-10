# HPM-001F — Platform v1 rollout architecture

HPM-001F adds a release-control boundary around HPM-001A–E. It does not add a lifecycle aggregate, report, metric, business command, or autonomous mutation path.

The release kernel defines an explicit append-oriented state machine, stable failure vocabulary, deterministic secret-free manifest, configuration-name parity, fail-closed server feature dependencies, bounded cohorts, immutable thresholds, immediate safety halts, and an autonomy guard. State transitions require active release authority, expected version, correlation and idempotency keys; production promotion transitions additionally require an explicit approval record.

The kernel is provider-neutral. Vercel, Supabase, monitoring, flag-provider, and notification adapters may execute reviewed rollout operations, but provider payloads do not become canonical release policy. No durable release repository or production adapter is introduced in this slice because ordinary application persistence is not an appropriate substitute for an approved release-control system and environment access evidence.

HPM feature definitions default off. Dependency resolution and kill switches are server-authoritative but independent of normal authorization. Lifecycle command routing still reauthorizes against its owning capability immediately before dispatch.

The local completion boundary is release tooling, policies, tests, evidence templates, and runbooks. Production completion requires the external rehearsal, RLS, lifecycle, rollback, security, accessibility, smoke, cohort, monitoring, stabilization, approval, record, and tag gates described in the rollout requirements. Local tests or a successful deployment cannot satisfy those gates.
