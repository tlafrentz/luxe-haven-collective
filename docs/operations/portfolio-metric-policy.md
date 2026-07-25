# Portfolio Metric Policy

Policy version: `portfolio-overview-v1`.

- Gross Revenue is the sum of available authorized property revenue.
- ADR is qualifying portfolio revenue divided by total booked nights.
- Occupancy is total occupied nights divided by total available nights.
- RevPAR is qualifying portfolio revenue divided by available nights.
- Cancelled bookings are excluded.
- Missing financial values remain unavailable.
- Currency is formatted as USD only because current source records have one
  organizational reporting currency and no conversion is performed.
- Comparison periods use equal inclusive lengths; previous-year preserves the
  corresponding calendar boundary.
- Materiality thresholds live only in `PORTFOLIO_OVERVIEW_POLICY`.
- Occupancy changes are percentage-point changes; other relative changes are
  percentages when the comparison denominator is non-zero.
- Scope changes are disclosed and reported changes are not presented as
  like-for-like performance.

Property operating dates remain ISO local-date values. The source adapter does
not truncate booking dates through UTC timestamps.
