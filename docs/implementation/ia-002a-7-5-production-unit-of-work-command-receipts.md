# IA-002A.7.5 — Production Unit of Work and Command Receipts

This slice adds the production infrastructure contracts for durable command identity: versioned receipt rows, owner-scoped lookup, immutable receipt insertion, deterministic `v1` fingerprints, and a Supabase RPC client/result boundary. Fingerprints canonicalize object keys and exclude server timestamps unless supplied as semantic payload.

Receipt lookup is designed to happen before expected-version enforcement. A matching receipt replays the stored compact result; a conflicting command type or fingerprint fails closed. Receipt rows include the owner, command, fingerprint, resource identity, completion time, and replay result.

The transaction RPC is versioned and maps SQLSTATE conflicts to stable infrastructure errors. The application unit-of-work remains adapter independent. A reusable production outbox was not present, so event publication remains post-commit and its delivery durability is explicitly deferred.

The next hardening slice must replace the RPC’s plan-execution placeholder with the complete normalized mutation-plan writer and connect staged repositories to that RPC. No UI, server action, Action write, Evidence write, or Property onboarding is introduced here.
