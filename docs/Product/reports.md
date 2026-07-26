# Platform Reports

Platform Reporting converts authorization-aware feature projections into immutable, reproducible documents. It owns report definitions, requests, template versions, snapshots, rendering, artifacts, history, sharing, and generation operations. It does not query raw feature or provider tables and does not calculate feature metrics.

The initial definitions are Investment Decision, Property Performance, Portfolio Performance, and Financial Performance. Final generation requires the definition-specific Commerce entitlement. Generated reports preserve scope, period, source context, projection versions, template version, confidence, freshness, evidence, generator, and generation time.

Historical reports never refresh in place. Current data produces a new report version.
