# Learning Read Models

`GetLearningWorkspace` is represented by the canonical `buildLearningWorkspace` projection. It consumes authorized lesson, review, relationship, candidate, and assumption metadata.

The application layer calculates search matches, filters, latest revisions, gaps, trends, coverage, freshness, evidence quality, completion, contradiction rate, maturity, confidence, and the knowledge-health score. Pages only render the result.

Read models omit raw provider payloads and private evidence contents. Cache identities must include workspace, permission version, query/filter state, and the latest lesson/review lineage versions.
