# Market Intelligence v1 — Release Notes

Release candidate: Platform v1.2.0, Real Market-Backed Investment Intelligence.

## Delivered

- real provider-backed property resolution;
- sale and long-term-rent comparable acquisition;
- deterministic qualification, outlier handling, and weighting;
- canonical sale valuation and long-term-rent reporting;
- Investment-owned Market projection and User > Learning > Market > Default precedence;
- authenticated live purchase and rental-arbitrage workspace orchestration;
- bounded provider timeout/retry, process-local quota protection, caching, coalescing, safe errors, redacted logs, and admin health diagnostics.

STR ADR, occupancy, and annual revenue remain unsupported Market evidence. Operators supply them explicitly; the product never converts long-term rent into STR performance.

## User-visible limitations

- no saved analysis history in v1;
- process-local controls do not coordinate across serverless instances;
- ambiguous units require address refinement;
- provider outages may temporarily remove Market evidence while preserving entered assumptions;
- product analytics and portfolio-wide calibration are deferred.

## Release gate

Automated lint, typecheck, full Vitest, production build, architecture checks, and diff validation must pass. Preview smoke verification with authorized RentCast quota remains required before production promotion.

## Rollback

Set `MARKET_PROVIDER_ENABLED=false` to disable live Market calls, then verify the workspace reports Market analysis unavailable without synthetic values. If broader instability remains, promote the prior healthy Vercel deployment. Never restore fabricated Market evidence.
