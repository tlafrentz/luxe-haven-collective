# Outcome Review Lifecycle

Reviews move through Scheduled, Waiting, Ready, Measuring, In Review, and then Completed or Unable to Evaluate. Cancellation and supersession are explicit terminal paths.

Readiness is structured: it records execution state, window opening, settlement delay, missing measurements, due date, and policy version. An action that did not execute may yield Unable to Evaluate; it cannot be classified as an ineffective intervention.

Completed reviews never reopen. A correction creates a new revision with its actor, reason, corrected measurement selection, and a link to the superseded review.
