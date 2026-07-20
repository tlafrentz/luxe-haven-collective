# Platform Migration Tooling

These repository-local tools provide a consistent view of migration progress and enforce the frozen Platform v1 boundaries. They analyze production TypeScript under `src/`; tests and test-support files are intentionally excluded.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run migration:graph` | Aggregated feature and platform package dependency graph |
| `npm run migration:duplicates` | Symbols imported from multiple internal modules in the same file |
| `npm run migration:adoption` | Per-feature direct and effective (transitive) Platform adoption, package usage, and remaining feature dependencies |
| `npm run migration:features` | Compact feature dependency inventory |
| `npm run migration:lint` | Enforce frozen Platform v1 package and lifecycle rules |

Append `-- --json` to any command for machine-readable output.

The architecture lint fails when platform code imports a feature, a consumer deep-imports across a platform package boundary, a platform package violates lifecycle direction, or a platform package lacks a public `index.ts`. Feature-to-feature dependencies are reported by the analyzer rather than rejected during the compatibility migration.

The shared implementation lives in `scripts/platform-migration/analyzer.ts`. New migration rules should be added there so local reports, CI checks, and tests classify dependencies identically.

Raw adoption counts files with direct Platform imports. Effective adoption also counts files that consume a same-feature adapter or barrel which reaches Platform. Neither percentage is an eligibility target by itself; migration audits must document vocabulary, presentation, constants, and compatibility files that have no reason to consume Platform.
