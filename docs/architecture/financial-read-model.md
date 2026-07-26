# Financial Read Model Architecture

## Canonical flow

`GetFinancialSnapshot` is the only presentation-facing financial query:

Workspace authorization → Financial identity → scoped Ledger → Accounts →
posted Transactions → Snapshot → Evidence / Confidence / Freshness.

Presentation must not query transaction, account, provider, budget, or forecast
repositories. Portfolio, Revenue, Investment, Reports, and Executive capabilities
consume bounded snapshots or summaries and do not aggregate finance independently.

`FinancialReadModel` supports Workspace, Portfolio, and Property scope without
changing its shape. Authorization is evaluated before any financial source read.
Adapters must reject cross-workspace and cross-property rows.

## Repository ports

- `FinancialSnapshotRepository`
- `LedgerRepository`
- `TransactionRepository`
- `BudgetRepository`
- `ForecastRepository`
- `FinancialReadModelRepository`

The computed repository rebuilds from current canonical facts. Provider adapters
convert currency before snapshot construction; mixed currencies fail closed.
Repository failures propagate and never manufacture zeros.

## Cache and observability

Keys contain Workspace, current period, comparison period, membership/capability
scope, property or portfolio scope, reporting currency, and projection version.
Workspace invalidation removes every derived key.

Each evaluation emits Workspace, reporting period, transaction count, transaction
evidence coverage, confidence, freshness, and duration. Product analytics may
record `financial_snapshot_viewed`, `financial_period_changed`, and
`financial_evidence_opened` at the presentation boundary.
