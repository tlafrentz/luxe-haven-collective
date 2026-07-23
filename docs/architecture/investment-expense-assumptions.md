# Investment expense assumptions (II-009)

## Decision

II-009 retains the current canonical expense taxonomy and makes its limitations explicit. The Investment model currently supports one property-management percentage, fixed monthly utilities, fixed annual insurance, taxes, cleaning, software and supplies, plus maintenance and capital reserves as percentages of projected accommodation revenue. Rental arbitrage adds the fixed monthly lease; purchase adds annual taxes and debt service outside operating expenses.

The management percentage is based on projected accommodation revenue. It means a manager or co-host fee. It does not mean a booking-channel or payment-processing fee. The current canonical input schema has no separate platform/channel fee, processing fee, guest-paid cleaning revenue, per-stay cleaning model, or Market-rent input. Those concepts will not be introduced as presentation-only state because doing so would create economics that the domain, analysis snapshots, and reanalysis workflow cannot preserve.

## Calculation bases

| Category | Current basis | Routes | Source |
|---|---|---|---|
| Property management | Percentage of projected accommodation revenue | Both | User draft; provenance preserved by analysis context |
| Utilities | Fixed monthly, annualized | Both; zero for rental when landlord includes utilities | User draft |
| Insurance | Fixed annual | Both | User draft |
| Property taxes | Fixed annual | Purchase | User draft |
| Cleaning expense | Fixed annual | Both | User draft |
| Software | Fixed annual | Both | User draft |
| Supplies | Fixed annual | Both | User draft |
| Maintenance reserve | Percentage of projected accommodation revenue | Both | User draft |
| Capital reserve | Percentage of projected accommodation revenue | Both | User draft |
| Lease obligation | Fixed monthly, annualized; excluded from NOI-before-lease | Rental arbitrage | User draft |
| Debt service | Amortized financing calculation; excluded from NOI | Purchase | User draft and canonical financing calculation |

Cleaning is an operator-paid annual expense. Guest-paid cleaning revenue is not modeled and therefore cannot offset it. Guidance explicitly prevents treating the two as interchangeable. Furnishing, security deposit, closing costs, and other startup costs are one-time initial-cash items and are not recurring operating expenses.

## Compatibility and versioning

Historical lifecycle results and Opportunity snapshots remain unchanged. No migration is required because this milestone does not change a durable canonical assumption schema. Reanalysis continues to hydrate only the existing user-provided assumption keys, so economics are not silently reinterpreted.

A future split of platform, processing, cleaning-revenue, or per-stay cleaning assumptions requires a new canonical input-schema version, calculation support, source provenance, snapshot support, legacy mapping, and a forward migration where drafts are durable. Until that complete vertical change is approved, the analyzer states that booking-platform and processing fees are not separately modeled instead of implying they are included in management.
