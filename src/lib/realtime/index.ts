/**
 * Realtime Module Exports
 * 
 * Provides real-time subscription capabilities for jobs, ops, and points,
 * with built-in idempotency and deduplication guarantees.
 */

// Jobs subscription
export {
  subscribeToJobs,
  subscribeToJob,
  fetchJob,
  fetchActiveJobs,
  type Job,
  type JobStatus,
  type JobSubscription,
  type JobSubscriptionCallbacks,
} from './subscribeJobs';

// Ops subscription
export {
  subscribeToOps,
  fetchOps,
  fetchLatestSeq,
  recordsToOps,
  createOpsSubscriptionManager,
  type OpsDbRecord,
  type OpsSubscription,
  type OpsSubscriptionCallbacks,
} from './subscribeOps';

// Points subscription
export {
  subscribeToPoints,
  fetchUserProfile,
  createPointsSubscriptionManager,
  type PointsChangeEvent,
  type PointsSubscription,
  type PointsSubscriptionCallbacks,
} from './subscribePoints';

// Idempotency utilities
export {
  OpsExecutionTracker,
  JobRetryTracker,
  calculateBackoffDelay,
  generateIdempotencyKey,
  areOpsEquivalent,
  createSessionTracker,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from './idempotency';
