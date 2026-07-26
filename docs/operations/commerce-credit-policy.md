# Commerce Credit Policy

Credits follow Available → Reserved → Consumed. A failed downstream creation releases Reserved credit. Every reservation is unique by Grant and command ID.

Reservation locks the Grant, verifies scope and status, and prevents negative balances. Consumption and release append audit history. Repeated commands return the existing consumption.

Unused-credit refunds follow the Product rule. Consumed-credit refunds require manual review unless an explicit reversible policy exists.
