# Profitability Policy

Policy version: `profitability-policy-v1`.

Canonical v1 calculations:

- Operating Revenue: posted measured revenue accounts.
- Total Operating Costs: Cost of Revenue plus Operating Expense.
- Gross Profit: Operating Revenue minus Cost of Revenue, only when Cost of
  Revenue is explicitly modeled.
- NOI: Operating Revenue minus Total Operating Costs.
- Operating Margin: NOI divided by reliable non-zero Operating Revenue.
- Gross Margin: Gross Profit divided by reliable non-zero Operating Revenue.

NOI and margins require revenue evidence and at least 80% expense coverage.
Missing expenses never become zero. Capital expense, principal debt payments,
owner distributions, and asset movement never reduce NOI.

Margin health thresholds are Strong at 35% or above, Healthy at 20%, Moderate at
10%, Weak at zero or above, Negative below zero, and Unavailable without reliable
inputs. These describe operating margin only and are not recommendations.

Trend movement below 2% of a compatible prior value is Stable. Comparisons below
$100 do not emit percentage changes. Material category changes require at least
$100 of movement and no more than five appear, ordered by magnitude.

Current and comparison periods must use the same accounting basis, currency,
authorized scope, and compatible duration. Revenue and expense movement is
descriptive attribution; FI-001C does not infer pricing, occupancy, seasonality,
or management causation without bounded evidence.
