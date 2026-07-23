# IA-002A.4 implementation note

## Delivered

The Acquisition Pipeline now contains route-discriminated purchase and rental-arbitrage offer terms, validated offer IDs/sequences/statuses, immutable source-analysis references, draft editing/rebase behavior, submission, expiration, withdrawal, rejection, counteroffers, acceptance, and explicit agreement-basis lineage. Submitted commercial terms are replaced only by a new record; counterparty terms never overwrite operator-submitted terms.

Contracts are separate immutable records with purchase or rental agreement terms, accepted-offer/counteroffer/external sources, and explicit recorded status. External contracts can be recorded without synthesizing an offer and transition an offer-submitted or negotiating pipeline to under-contract. Contract recording does not start diligence.

Pure projections provide offer-analysis alignment, offer-contract differences, and commercial stage readiness. Materiality remains a supplied policy/default comparison; no underwriting or recommendation is recalculated.

## Boundary and lifecycle decisions

The aggregate owns commercial records and increments its version exactly once per successful operation. At most one draft/current offer is designated. Acceptance establishes an agreement basis but not a contract. Closing readiness, contingencies, diligence, Action Center, documents, persistence, and UI remain deferred. Existing IA-002A.2/A.3 stage and terminal policies remain authoritative.

## Validation and next step

Offer/contract tests cover route-specific validation, sequence/current-offer behavior, draft mutation and rebasing, atomic submission/stage coupling, counteroffer and acceptance lineage, rejection, external agreement recording, and contract separation. IA-002A.5 can add contingencies, diligence, and closing readiness against the accepted agreement and recorded contract without redefining commercial vocabulary.
