# Income Statement Projection

## Canonical boundary

Presentation calls one boundary:

`GetIncomeStatement` → `IncomeStatementReader` → authorized FI-001A
`FinancialReadModel` → centralized profitability policy → `IncomeStatement`.

The page never queries accounts, transactions, ledger tables, bookings, or
providers. It performs formatting only; aggregation, NOI, margins, contribution,
variance, trends, drivers, rankings, evidence, and state are application outputs.

`IncomeStatementProjectionAdapter` resolves active Workspace membership,
`financial.profitability.view`, property assignment, inclusion, and reporting
eligibility before financial aggregation. Revenue and expense category arrays
are omitted at the application boundary unless their respective detail
capability is present.

## Reconciliation

Posted measured transactions are grouped through canonical Chart of Accounts
categories. Revenue and expense categories reconcile to their section totals.
Property results reconcile to Workspace or Portfolio totals. Market and
operating-model dimensions aggregate normalized property results rather than
introducing model-specific page calculations.

Cache keys include Workspace, authorized ordered property scope, revenue/expense
detail capability, period, comparison, accounting basis, reporting currency,
projection version, and evidence version. Backdated entries, reclassifications,
source synchronization, and permission changes invalidate affected periods.

Typed failures distinguish permission, currency, accounting basis, data quality,
unavailable, and unexpected states.
