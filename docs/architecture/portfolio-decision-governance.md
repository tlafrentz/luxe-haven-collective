# Portfolio Decision Governance

PI-001F consumes `PortfolioFindings` and does not recalculate risk, opportunity,
composition, or property contribution.

```text
PortfolioFindings
  -> PortfolioDecisionCandidate
  -> Recommendation review snapshot
  -> Human approval command
  -> Canonical Platform Decision
  -> Platform Action drafts
  -> Measurement plan
```

The canonical Platform Decision remains the immutable approved conclusion.
Mutable pre-approval state, alternatives, assumptions, dependencies, evidence
version, and optimistic revision live in the portfolio recommendation-review
extension. Approval preserves the reviewed snapshot rather than rewriting it.

Action Center remains the execution authority. Every generated action carries
the canonical decision and source-finding lineage. Action progress does not
automatically alter the approved decision.

Command receipts are scoped by workspace and idempotency key. Reuse with a
different payload is rejected. Updates require the expected revision.

