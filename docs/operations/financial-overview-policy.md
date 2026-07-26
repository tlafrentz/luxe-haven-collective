# Financial Overview Policy

Policy version: `financial-overview-policy-v1`.

Condition precedence is:

1. Insufficient Evidence when recognized revenue or material operating-expense
   coverage cannot support profitability.
2. At Risk for supported negative operating results or critical sourced
   liquidity.
3. Attention Needed for tight liquidity, adverse compatible plan variance,
   material expense escalation, or stale financial evidence.
4. Strong when supported margin is at least 25%, liquidity is strong, and no
   material limitation dominates.
5. Stable otherwise.

The policy degrades confidence for missing dimensions; unavailable dimensions
never count as healthy. Strong and At Risk always include drivers, limitations,
confidence, evidence references, and an inspection destination.

Profitability and liquidity are independent. NOI is recognized operating revenue
less cost of revenue and operating expense. Capital expense, debt principal,
owner distributions, and asset movement do not reduce NOI. Liquidity only uses a
bounded cash source with internal transfers removed.

Changes require at least $100 of absolute movement in v1. Comparisons below that
denominator use “new” or absolute movement rather than extreme percentages.
At most five changes appear, ordered by monetary magnitude.

The current and comparison periods must share accounting basis and reporting
currency. Currency conversion is an upstream adapter responsibility requiring an
approved rate source and effective date; FI-001B fails closed without it.
