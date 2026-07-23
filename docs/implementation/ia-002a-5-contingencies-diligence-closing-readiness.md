# IA-002A.5 implementation note

## Delivered

The acquisition domain now distinguishes contractual contingencies from due-diligence investigations through separate typed records sharing only requirement status, priority, waiver, and public reference contracts. Contingencies are route-aware and contract/operator sourced. Diligence items may reference one contingency without making completion automatically satisfy it.

Purchase and rental-arbitrage template sets use stable keys and versions and contain operational descriptions only. Action, Platform Evidence, and opaque document references are relationship records; no Action state, evidence payload, or document storage is copied into the pipeline.

The aggregate can add requirements and record explicit requirement outcomes while preserving aggregate versioning and activity. Waivers require explanation, actor, timestamp, and risk acknowledgement. `buildAcquisitionClosingReadiness()` is a pure projection returning blockers, warnings, satisfied conditions, counts, route, stage, and evaluated pipeline version. It uses recorded contract and requirement facts and intentionally does not claim legal or professional clearance.

## Deferred boundary

Persistence, application commands, UI, automatic Action creation, document storage, jurisdictional rules, Property creation, readiness overrides, full closing-preparation orchestration, and final `closeAcquisition` fact enforcement remain later integration work. The current milestone provides the domain vocabulary and projection inputs without introducing a second workflow framework.

## Next step

IA-002A.6 can add application orchestration and persistence mappings; it should preserve requirement outcome history and use the readiness version for optimistic freshness checks.
