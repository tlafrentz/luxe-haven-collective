# Cash Flow & Liquidity Projection

The presentation calls `GetCashFlowLiquidity` only:

`Financial Read Model + authorized balances + movements + obligations + reserve policies → classification and transfer matching → reconciled CashFlowLiquidityView → route`

Authorization resolves property and account scope before readers run. The builder eliminates matched transfers, preserves unmatched activity, reconciles opening cash plus classified movement to closing cash, and produces bounded summaries. Presentation performs no aggregation, matching, runway calculation, or liquidity evaluation.

Cache identity includes workspace, authorized properties and accounts, permissions, period, comparison, currency, policy versions, and projection version. Balance, transaction, classification, transfer, obligation, reserve, permission, currency, and reconciliation changes invalidate affected entries.
