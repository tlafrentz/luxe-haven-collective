# Portfolio Findings Projection

The `PortfolioFindings` read model is built in the application layer:

```text
Authorized Portfolio Projection
  + Property Comparison
  + Composition & Concentration
  -> Risk engine / Opportunity engine
  -> Transparent priority ordering
  -> PortfolioFindings
```

Authorization and property inclusion are resolved before every upstream projection.
The findings engine cannot query repositories and presentation cannot calculate risk.
It consumes PI-001D concentration findings rather than recalculating distributions.

Cache identity includes workspace, authorized and included property sets, role,
capabilities, periods, and every upstream projection/policy version. This prevents
full-scope or financial findings from crossing authorization boundaries.

Risks and opportunities share evidence, impact, dependency, confidence, freshness,
and investigation structures while retaining distinct category and magnitude types.
No aggregate priority score is exposed.

