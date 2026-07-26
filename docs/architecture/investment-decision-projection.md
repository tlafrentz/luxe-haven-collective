# Investment Decision Projection

The application boundary is `getInvestmentDecisionAnalysis`.

```text
Property resolution + Market Analysis
  -> Investment Market Context
  -> route-specific Investment lifecycle
  -> getInvestmentDecisionAnalysis
  -> Investment workspace presentation
```

The query embeds the immutable route-specific lifecycle result and adds identity, normalized recommendation status, transparent score components, evidence completeness, freshness, timeline, and platform lineage. React components render this projection and do not calculate underwriting values.

The server action resolves authorization before invoking providers. Market Intelligence is consumed through `InvestmentMarketContext`; canonical Platform Evidence, Recommendations, and Scoring artifacts are created by the existing workspace adapter. Opportunity saving uses a short-lived, actor-bound server token so the displayed result is preserved rather than regenerated.
