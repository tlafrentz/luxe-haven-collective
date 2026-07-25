# Portfolio Comparison Metric Policy

Policy version: `portfolio-property-comparison-v1`.

- Revenue, booking, available-night, workload, and revenue-change contribution
  use the same authorized portfolio denominator and reconcile to their totals.
- NOI contribution exists only when every included property has reliable NOI and
  the viewer has financial capability.
- Booked and available nights use canonical projection denominators.
- Momentum uses revenue, occupancy, ADR, RevPAR, and booking movement. Supported
  signals yield Improving, Declining, Mixed, or Stable; missing comparison yields
  New; inadequate evidence yields Insufficient Evidence.
- Efficiency metrics expose their numerator and denominator. There is no
  composite score.
- Degraded, partial-period, or missing metrics are ineligible for rankings.
- Values within 0.5% are effectively tied and retain the same position.
- Peer groups require at least two authorized properties with an explicit common
  dimension. A one-property peer group is unavailable.
- Median, weighted portfolio metric, and total are never treated as equivalent.
- Cross-currency aggregation is rejected by the projection adapter.
