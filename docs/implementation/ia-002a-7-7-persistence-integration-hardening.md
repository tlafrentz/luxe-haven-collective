# IA-002A.7.7 — Persistence Integration Hardening

The production composition boundary now centralizes pipeline repository, receipt repository, unit of work, authorization, analysis/action/evidence readers, and event publisher dependencies. Handlers remain adapter-independent and no infrastructure is instantiated inside the application layer.

Configuration validation and a lightweight health probe provide fail-fast environment metadata. Structured observability hooks support command logs, counters, and duration timers without logging commercial terms or sensitive evidence. The operational runbook documents startup, migration, replay, concurrency, hydration, and post-commit publication recovery.

Remote RLS and end-to-end Supabase verification remain governed by the guarded IA-002A.7.6 harness. A reusable production outbox is not present, so event delivery durability remains deferred. The transaction-plan writer must be completed before claiming the full production execution flow is live.
