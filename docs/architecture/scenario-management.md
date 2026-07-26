# Scenario Management Architecture

`getInvestmentScenarioWorkspace` is the sole presentation query.

```text
Investment Opportunity
  -> append-only Opportunity Analyses
  -> immutable Scenario Snapshots
  -> Scenario Workspace
  -> Comparison / Preferred Scenario
  -> Reports and Learning
```

Financial values are copied from saved analysis snapshots and never recalculated by the query or React. `compareInvestmentScenarios` compares only preserved values, supports two to four unique scenarios, and uses the first selected scenario as the explicit baseline.

Scenario identity includes calculation, engine, evidence, recommendation, score, and policy versions. Existing owner-scoped Opportunity repositories and RLS protect access before projection.
