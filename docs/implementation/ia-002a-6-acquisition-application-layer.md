# IA-002A.6 — Acquisition Pipeline Application Layer

The acquisition application boundary now provides typed command context, capability authorization, owner-scoped reader ports, unit-of-work coordination, command receipts, and stable application projections. Domain aggregates remain the source of lifecycle and commercial policy; handlers only load, authorize, orchestrate, persist through ports, and translate failures.

## Conventions

- Mutating commands carry an explicit `AcquisitionCommandId` and expected aggregate versions.
- Receipt lookup precedes version checks, so a successful retry returns the original projection without replaying domain behavior.
- Pipeline and opportunity synchronization is coordinated through `AcquisitionUnitOfWork`.
- Analysis, Action, and Evidence access is represented by minimal reader ports; no provider repositories enter the domain.
- Readiness is rebuilt from the current aggregate. It is never accepted from a client as authority.
- Event publication is a post-commit port. The current in-memory adapter intentionally does not claim durable delivery guarantees.

## Sequence: activation

```mermaid
sequenceDiagram
  participant C as Command handler
  participant A as Authorization
  participant R as Analysis reader
  participant U as Unit of work
  participant P as Pipeline
  participant O as Opportunity
  C->>U: receipt lookup
  C->>A: authorize activate
  C->>R: verify completed analysis
  C->>P: activate
  C->>O: synchronize shortlisted
  C->>U: save both + receipt
  U-->>C: commit
```

## Sequence: offer acceptance

```mermaid
sequenceDiagram
  participant C as Command handler
  participant U as Unit of work
  participant P as Pipeline
  participant O as Opportunity
  C->>U: load pipeline and receipt
  C->>P: record acceptance
  P-->>C: under-contract projection
  C->>O: synchronize status
  C->>U: save both + receipt
```

## Sequence: closing

```mermaid
sequenceDiagram
  participant C as Close handler
  participant U as Unit of work
  participant R as Readiness projection
  participant P as Pipeline
  participant O as Opportunity
  C->>U: load current state
  C->>R: build fresh readiness
  C->>P: close with final facts
  C->>O: synchronize acquired
  C->>U: save both + receipt
  U-->>C: commit
  C-->>C: publish AcquisitionClosed after commit
```

The application layer is intentionally persistence- and UI-independent. Supabase adapters, production outbox behavior, server actions, and Property onboarding remain future work.
