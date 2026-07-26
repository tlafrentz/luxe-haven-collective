# FI-001A — Financial Domain

## Status

Implemented July 25, 2026.

Financial Intelligence is the canonical source of financial truth for a
Workspace. It is a peer consumer of operational facts from Portfolio
Intelligence and a bounded upstream source for Executive Intelligence.

## Identity and hierarchy

Every financial workspace declares its organization, reporting currency,
fiscal-year start, timezone, reporting standards, and cash or accrual accounting
method. Financial scope follows Workspace → Organization → Portfolio → Property
→ Account → Transaction. A value is never detached from its Workspace, period,
account, transaction source, and evidence.

## Canonical concepts

- Platform `Money` owns currency, minor-unit precision, arithmetic, comparison,
  formatting, and serialization. Cross-currency arithmetic fails explicitly.
- `FinancialPeriod` makes current and optional comparison ranges reusable and
  identifies calendar or fiscal reporting.
- The extensible Chart of Accounts provides revenue, cost of revenue, operating
  expense, capital expense, asset, liability, equity, and reserve roots.
- Posted `FinancialTransaction` values are immutable. Corrections require a new
  transaction or an explicit voiding workflow in a future command sprint.
- `Ledger` is the source boundary for accounts and transactions.
- `FinancialSnapshot` keeps measured, projected, forecast, and estimated values
  separate and carries evidence, confidence, and freshness.
- Budgets, forecasts, projections, observations, and evidence are first-class
  contracts, but FI-001A does not implement planning behavior.

## Product states

No posted revenue produces insufficient evidence and the empty message:
“Financial data unavailable. Connect financial sources or import transactions
to begin financial analysis.”

Incomplete expense, provider, or transaction coverage is represented as evidence
gaps and reduced confidence. Old or absent synchronization is stale or unknown;
it never becomes a zero-value assertion.

FI-001A creates no dashboard, P&L, cash-flow statement, budget, forecast, capital
plan, recommendation, or decision.
