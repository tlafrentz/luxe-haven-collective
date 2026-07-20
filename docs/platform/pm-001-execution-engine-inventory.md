# PM-001.1 — Execution Engine Inventory and Classification

Baseline captured after the initial PF-009 compatibility extraction and before duplicate removal. The migration analyzer reported 15 production Execution Engine files, 8 Platform imports across 6 files, and 40% raw file adoption. The post-boundary structure contains 22 production files because compatibility and mapper responsibilities are now explicit; eligible adoption is tracked separately below.

## Export and file classification

| File/export | Classification | Disposition |
| --- | --- | --- |
| `domain/action-status.ts`: `ActionStatus`, `ACTION_STATUSES` | Platform re-export | Temporary package convenience; canonical source is `@/platform/actions` |
| `domain/action-priority.ts`: `ActionPriority`, `ACTION_PRIORITIES` | Platform re-export | Temporary package convenience |
| `domain/action-owner.ts`: `ActionOwner` | Platform re-export | Temporary package convenience |
| `domain/action-type.ts`: `ActionType` | Platform re-export | Temporary package convenience |
| `domain/action-type.ts`: `ACTION_TYPES` | Compatibility API | Deprecated alias for hospitality vocabulary |
| `domain/hospitality-action-types.ts` | Feature adapter | Hospitality-specific Action type vocabulary; remains in feature |
| `domain/action-outcome.ts`: `ActionOutcome` | Platform re-export | Temporary package convenience |
| `domain/action-outcome.ts`: `ActionMeasuredImpact` | Compatibility API | Deprecated projection of canonical Outcome metrics |
| `compatibility/executive-action.ts`: `ExecutiveAction` | Compatibility API | Explicit legacy persistence/view DTO; not an entity |
| `compatibility/legacy-action-mappers.ts` | Feature adapter | Converts compatibility DTOs to/from canonical `Action` |
| `application/mappers/executive-priority-mapper.ts` | Feature adapter | Hospitality mapping from Executive Intelligence vocabulary |
| `application/mappers/action-outcome-mapper.ts` | Feature adapter | Converts legacy measurement input to canonical `Outcome` and back to a temporary projection |
| `application/accept-executive-priority.ts` | Compatibility API | Creates and accepts canonical `Action`; preserves old return DTO |
| `application/start-action.ts` | Compatibility API | Delegates transition to canonical `Action.start` |
| `application/complete-action.ts` | Compatibility API | Delegates transition to canonical `Action.complete` |
| `application/measure-action.ts` | Compatibility API | `measureActionWithOutcome` produces canonical truth; deprecated `measureAction` returns only the legacy projection |
| `application/archive-action.ts` | Compatibility API | Delegates transition to canonical `Action.archive` |
| former local transition guards/status lists | Duplicate behavior | Removed; Platform Action now owns allowed lifecycle transitions |
| former `domain/executive-action.ts` definition | Duplicate-looking compatibility placement | Replaced with a deprecated forwarding type; primary DTO is visibly under `compatibility/` |
| `application/action-adapter.ts` | Compatibility API | Deprecated forwarding module retained for import compatibility |

No verified dead production code was found. Test-only compatibility imports remain intentionally excluded from adoption measurements.

## Consumer matrix

### Imports of `@/features/execution-engine`

After the Action Center boundary migration, no production module imports Execution Engine. `features/action-center/test-support/factories.ts` remains a test-only compatibility consumer.

### Direct Platform Action and Outcome consumers

| Consumer | Packages | Reason |
| --- | --- | --- |
| Execution Engine compatibility DTO and mappers | Actions | Compatibility translation and re-exports |
| Execution Engine lifecycle services | Actions | Canonical lifecycle execution |
| Execution Engine outcome mapper/measurement service | Actions, Outcomes | Canonical measurement truth and temporary projection |
| Action Center `build-action-center-view.ts` | Actions, Decisions, Evidence, Outcomes | Single Platform-to-read-model adapter |
| Dashboard Action Center page | Actions | Constructs canonical fixture Actions |

### Legacy lifecycle functions

| Function | Canonical behavior |
| --- | --- |
| `acceptExecutivePriority` | `Action.create(...).accept(...)` |
| `startAction` | `Action.start(...)` |
| `completeAction` | `Action.complete(...)` |
| `measureActionWithOutcome` | Creates `Outcome`, then uses `Action.measure(...)` only for compatibility status projection |
| `measureAction` | Deprecated wrapper returning the projected compatibility DTO |
| `archiveAction` | `Action.archive(...)` |

### Legacy outcomes and measured impact

`ActionMeasuredImpact` is the only legacy measured-impact type. It is now marked compatibility-only and maps to `Outcome.metrics`. Legacy `ActionOutcome` is a Platform Action re-export used by completion compatibility. Canonical measured truth retains action lineage, success, metrics, timing, notes, and the canonical Outcome identifier.

### Action Center dependencies

Production Action Center has one Platform adapter importing Actions, Decisions, Evidence, and Outcomes. Components consume only local read-model types. The former `recentlyLearned` field is renamed `recentlyMeasured`; no measured Outcome is represented as Platform Learning.

### Executive Intelligence dependencies

Execution Engine consumes `ExecutivePriority` only in the acceptance service and mapper. Opportunity action type and severity translation is isolated in `application/mappers/executive-priority-mapper.ts`. Executive Intelligence has no production import of Execution Engine.

## Adoption baseline and target

Initial raw adoption was 40% (6 of 15 files). After migration, direct adoption is 48% (11 of 23 responsibility-separated files) and effective adoption through the feature boundary is 91% (21 of 23). The two remaining files are feature-owned hospitality vocabulary or compatibility forwarding code and are not eligible Platform consumers. Eligible adoption is therefore complete while raw adoption intentionally remains below 100%.
