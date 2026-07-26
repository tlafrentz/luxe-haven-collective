# Report rendering

Semantic HTML is the canonical visual artifact. It uses headings, definition lists, table headers, textual qualification, confidence, freshness, accessible descriptions, responsive online styles, and print CSS.

PDF rendering consumes the canonical HTML artifact. The initial deterministic fallback creates selectable text and document metadata without client rendering. A production-grade tagged-PDF renderer may replace it behind `ReportDocumentRenderer`.

Rendering never evaluates business metrics. Artifact checksums and renderer versions are persisted.
