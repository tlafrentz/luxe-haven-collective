/**
 * Marker contract for feature-owned decision outcomes.
 *
 * Platform Decisions deliberately does not prescribe one universal outcome
 * enum. Investment, revenue, operations, and executive decisions each retain
 * their own business language while sharing the same Decision model.
 */
export type DecisionOutcome = string;
