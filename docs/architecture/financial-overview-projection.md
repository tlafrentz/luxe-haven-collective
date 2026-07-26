# Financial Overview Projection

## Boundary

Presentation calls one route application boundary:

`GetFinancialOverview` → `FinancialOverviewReader` → authorized FI-001A
`FinancialReadModel` / `FinancialSnapshot` → centralized policies →
`FinancialOverview`.

The page does not query ledger, transaction, booking, cash, budget, forecast,
obligation, Action, Decision, or provider tables. The production source currently
normalizes recognized, non-cancelled booking revenue into canonical posted
Financial Transactions. Until expense and cash sources are connected, production
correctly yields a revenue-only partial state.

## Composition ports

- Financial Read Model and Snapshot: authoritative recognized finance.
- Liquidity reader: authorized cash balance and transfer-eliminated movement.
- Planning variance reader: compatible approved Budget or Forecast.
- Obligation reader: known, dated cash obligations.
- Execution reader: canonical Platform Decisions and Actions.

Authorization and property inclusion resolve before finance aggregation.
Selected-property queries are passed into the FI-001A source; inaccessible rows
are rejected. Cash is omitted at the application boundary when
`financial.cash.view` is absent.

## Cache

Keys include Workspace, ordered authorized property scope, permission/cash
capability, period, comparison type, accounting basis, reporting currency,
projection version, and evidence source version. Backdated entries,
reclassifications, source synchronization, plan updates, and permission changes
invalidate affected projections. Results never cross capability scopes.

Typed errors distinguish permission, configuration, currency, accounting basis,
data quality, reconciliation, unavailable, conflict, and unexpected states.
