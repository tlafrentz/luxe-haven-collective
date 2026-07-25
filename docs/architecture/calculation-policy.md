# Calculation Policy

Status: Canonical  
Version: `pi-ux-002a-v1`

## Purpose

All operator-facing revenue, occupancy, ADR, RevPAR, aggregation, and comparison calculations must use `src/platform/calculations`. Feature code may format or explain a result, but must not redefine its formula.

## Canonical formulas

- Occupied nights: reservation nights overlapping the reporting interval. The end date is exclusive.
- Available nights: active properties multiplied by nights in the reporting interval.
- Occupancy: `occupied nights / available nights`, constrained to 0–100%. Overbooking is a separate operational condition and must never inflate occupancy.
- ADR: recognized room revenue divided by occupied nights.
- RevPAR: recognized room revenue divided by available nights.
- Portfolio ADR and RevPAR: weighted from portfolio revenue and canonical night totals, never averaged from property percentages.
- Revenue: provider-synchronized monetary evidence. A missing provider amount is unavailable, not zero.

## Availability

Zero is a valid measurement only when the source supplied sufficient evidence that the measured value is zero. Missing, contradictory, disconnected, or unsynchronized evidence produces an unavailable state and an explanation.

The analytics compatibility model remains numeric internally, but presentation consumers must suppress revenue when bookings and room-rate evidence contradict a zero gross amount.

## Comparisons

Comparisons expose current period, comparison period, and basis. A percentage is emitted only for a meaningful non-zero baseline.

- Previous zero and current positive: `New measurement`
- Near-zero baseline: `Comparison unavailable`
- Missing or invalid inputs: `Comparison unavailable`
- Occupancy: absolute percentage-point change
- Other supported metrics: `(current - previous) / abs(previous)`

Consumers must preserve comparison status; they may not convert unavailable or new-measurement states into 0% or 100%.

## Invariants

- Occupancy is never greater than 100%.
- ADR × occupied nights reconciles to recognized room revenue within rounding tolerance.
- RevPAR × available nights reconciles to recognized room revenue within rounding tolerance.
- Aggregation is weighted from canonical totals.
- Page-specific calculation helpers are prohibited.

