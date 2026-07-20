# Market Intelligence compatibility models

`MarketObservation`, `MarketAnalysisEvidence`, `MarketAnalysisFinding`, `MarketIntelligenceReport`, legacy confidence labels/scores, and legacy trend direction remain temporarily because report, dashboard, and builder consumers still use them. They are behavior-preserving projections and inputs to Market-owned algorithms; they are not canonical reasoning artifacts.

Canonical conversion occurs through `mapMarketPlatformArtifacts` and `mapMarketAggregateIntelligence`. New consumers must use the Platform artifacts returned by those adapters.
