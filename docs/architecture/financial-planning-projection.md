# Financial Planning Projection

Presentation calls `GetFinancialPlanning` only. Authorization resolves workspace and property scope before the projection reads Financial Read Model actuals, approved budgets, forecast versions, or scenarios.

`Actuals + Approved Budget + Current Forecast + Scenarios → Policy Variance → Planning Health → FinancialPlanning`

Cache identity includes authorized scope, permissions, period, currency, budget and forecast versions, scenario versions, and projection version. Plan revisions, forecast updates, scenario updates, actual changes, assumptions, and permissions invalidate affected entries.
